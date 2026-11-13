import { db } from "@/db"
import { gcalEvents, scheduleEntries, children as childrenTable } from "@/db/schema/domain"
import { eq, and, gte, lte, inArray } from "drizzle-orm"
import { addDays, parseISO, format } from "date-fns"
import { getWindowBounds } from "@/lib/schedule/generate-default"
import { getAppConfig } from "@/config/app"
import { buildGCalClient } from "@/lib/gcal/client"

// Combined insert pacing across all parents: one request per 125ms ≈ 8 QPS.
const INSERT_INTERVAL_MS = 125

// Google Calendar signals short-term rate limiting with these reasons, usually on
// an HTTP 403 (sometimes 429). 'quotaExceeded' (daily calendar usage limit) is
// deliberately NOT retried — waiting seconds won't help.
const RETRYABLE_REASONS = new Set(["rateLimitExceeded", "userRateLimitExceeded"])

/**
 * True for errors worth retrying with backoff: HTTP 429 / 503, or a 403 whose
 * reason is a rate limit. googleapis (gaxios 7) exposes the HTTP status on
 * `err.status` and the reasons only in `err.response.data.error.errors`.
 */
export function isRetryableGCalError(err: unknown): boolean {
  const e = err as {
    code?: number | string
    status?: number
    errors?: Array<{ reason?: string }>
    response?: { status?: number; data?: { error?: { errors?: Array<{ reason?: string }> } } }
  } | null
  const status = e?.status ?? e?.response?.status ?? (typeof e?.code === "number" ? e.code : Number(e?.code))
  if (status === 429 || status === 503) return true
  const reasons = [
    ...(e?.errors ?? []),
    ...(e?.response?.data?.error?.errors ?? []),
  ].map(x => x?.reason)
  return reasons.some(r => r !== undefined && RETRYABLE_REASONS.has(r))
}

/**
 * Retries an async operation on rate-limit errors (see isRetryableGCalError).
 * Backoff: 2^attempt * 1000ms + random jitter up to 1000ms, max 5 retries.
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 5): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err: unknown) {
      if (!isRetryableGCalError(err) || attempt === maxRetries) throw err

      const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000
      console.log(`[GCal sync] Rate limit hit — retry ${attempt + 1}/${maxRetries} in ${Math.round(delay)}ms`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  // TypeScript needs this; unreachable in practice
  throw new Error('withRetry exhausted')
}

export interface ParentSyncResult {
  parentId: string
  created: number
  deleted: number
  error?: string
}

export interface SyncResult {
  success: boolean
  parentResults: ParentSyncResult[]
}

/**
 * Full-window calendar reconciliation triggered after a successful publishDraft.
 *
 * Scope: all schedule_entries with status='published' within getWindowBounds().
 * Per parent:
 *   1. Delete orphaned gcal_events (entries now assigned to the other parent)
 *   2. Create missing gcal_events (published entries with no existing mirror row)
 *
 * Both parents run concurrently via Promise.allSettled.
 * A failure for one parent does not affect the other. (per D-05)
 * The database publish is NOT rolled back on sync failure. (per D-05)
 */
export async function syncCalendarsAfterPublish(viewStart?: string, viewEnd?: string): Promise<SyncResult> {
  const config = await getAppConfig()
  const { start, end } = getWindowBounds(viewStart, viewEnd)
  const startStr = format(start, "yyyy-MM-dd")
  const endStr = format(end, "yyyy-MM-dd")

  // Load all published entries in the window with their child names
  const publishedEntries = await db
    .select({
      id: scheduleEntries.id,
      day: scheduleEntries.day,
      parentId: scheduleEntries.parentId,
      childId: scheduleEntries.childId,
    })
    .from(scheduleEntries)
    .where(
      and(
        eq(scheduleEntries.status, "published"),
        gte(scheduleEntries.day, startStr),
        lte(scheduleEntries.day, endStr),
      )
    )

  console.log("[GCal sync] Published entries in window:", publishedEntries.length)

  if (publishedEntries.length === 0) {
    console.log("[GCal sync] No published entries — skipping sync")
    return {
      success: true,
      parentResults: config.parents.map(p => ({
        parentId: p.id,
        created: 0,
        deleted: 0,
      })),
    }
  }

  const entryIds = publishedEntries.map(e => e.id)

  // Load existing gcal_events rows for all published entries
  const existingGcalRows = await db
    .select()
    .from(gcalEvents)
    .where(inArray(gcalEvents.scheduleEntryId, entryIds))

  // Load child name lookup (static import — no lazy dynamic import needed)
  const childRows = await db
    .select({ id: childrenTable.id, name: childrenTable.name })
    .from(childrenTable)
  const childNameMap = new Map(childRows.map(c => [c.id, c.name]))

  // Run both parents concurrently; isolate failures per parent
  // Both calendars are typically written with the same owner's token, so the
  // Google per-user limit (~10 QPS) is shared: split the budget across parents.
  const throttleMs = INSERT_INTERVAL_MS * Math.max(config.parents.length, 1)

  const settledResults = await Promise.allSettled(
    config.parents.map(parent =>
      syncParentCalendar(parent, publishedEntries, existingGcalRows, childNameMap, throttleMs)
    )
  )

  const parentResults: ParentSyncResult[] = settledResults.map((result, i) => {
    const parent = config.parents[i]
    if (result.status === "fulfilled") {
      return result.value
    }
    return {
      parentId: parent.id,
      created: 0,
      deleted: 0,
      error: String(result.reason),
    }
  })

  const success = parentResults.every(r => !r.error)
  console.log("[GCal sync] Sync complete:", JSON.stringify({ success, parentResults }, null, 2))
  return { success, parentResults }
}

type PublishedEntry = {
  id: string
  day: string
  parentId: string | null   // null = cleared entry; orphan filter naturally sweeps these
  childId: string
}

type GcalRow = {
  id: string
  scheduleEntryId: string
  googleEventId: string
  calendarId: string
  syncedAt: Date
}

async function syncParentCalendar(
  parent: { id: string; name: string; email: string; calendarId: string; ownerEmail: string },
  publishedEntries: PublishedEntry[],
  existingGcalRows: GcalRow[],
  childNameMap: Map<string, string>,
  throttleMs: number,
): Promise<ParentSyncResult> {
  const calendar = await buildGCalClient(parent.ownerEmail)
  let created = 0
  let deleted = 0

  const parentEntryCount = publishedEntries.filter(e => e.parentId === parent.id).length
  console.log(`[GCal sync] ${parent.name}: ${parentEntryCount} entries assigned, checking orphans and missing events`)

  // --- Step 1: Orphan cleanup ---
  // A gcal_events row is orphaned when the entry's current parentId no longer
  // matches this parent's calendarId. (per D-08)
  const orphans = existingGcalRows.filter(row => {
    if (row.calendarId !== parent.calendarId) return false
    const entry = publishedEntries.find(e => e.id === row.scheduleEntryId)
    if (!entry) return false // entry not in window — leave alone
    return entry.parentId !== parent.id
  })

  for (const orphan of orphans) {
    await withRetry(async () => {
      try {
        await calendar.events.delete({
          calendarId: orphan.calendarId,
          eventId: orphan.googleEventId,
        })
      } catch (err: unknown) {
        // 404 / 410 = already deleted in Google Calendar — treat as success (per Q7)
        const code = (err as { code?: number })?.code
        if (code !== 404 && code !== 410) {
          throw err
        }
      }
    })
    // Always remove local mirror row, regardless of GCal 404/410
    await db.delete(gcalEvents).where(eq(gcalEvents.id, orphan.id))
    deleted++
  }

  console.log(`[GCal sync] ${parent.name}: deleted ${deleted} orphaned events`)

  // --- Step 2: Create missing events ---
  // Entries assigned to this parent that have no gcal_events row for this calendarId.
  const parentEntries = publishedEntries.filter(e => e.parentId === parent.id)
  const syncedEntryIds = new Set(
    existingGcalRows
      .filter(row => row.calendarId === parent.calendarId)
      .map(row => row.scheduleEntryId)
  )
  // Remove orphans we just deleted from the synced set
  for (const orphan of orphans) {
    syncedEntryIds.delete(orphan.scheduleEntryId)
  }

  const entriesToCreate = parentEntries.filter(e => !syncedEntryIds.has(e.id))

  // Serialize inserts within a single parent to keep retry logic simple
  // (Promise.allSettled per parent pair already provides enough concurrency)
  for (const entry of entriesToCreate) {
    const childName = childNameMap.get(entry.childId) ?? entry.childId
    // All-day event: end date is EXCLUSIVE — must be the day after start (per D-10, RESEARCH Q2)
    const endDate = format(addDays(parseISO(entry.day), 1), "yyyy-MM-dd")

    const response = await withRetry(() =>
      calendar.events.insert({
        calendarId: parent.calendarId,
        requestBody: {
          summary: `${childName} @ ${parent.name}`,  // e.g. "Emma @ Isä" (per D-09)
          start: { date: entry.day },
          end: { date: endDate },
        },
      })
    )

    const googleEventId = response.data.id!

    // Insert mirror row — UNIQUE constraint (schedule_entry_id, calendar_id) prevents
    // duplicates at DB level even if sync is called concurrently (per D-06, D-07)
    await db.insert(gcalEvents).values({
      scheduleEntryId: entry.id,
      googleEventId,
      calendarId: parent.calendarId,
    })

    created++
    // Throttle so all parents combined stay at ~8 QPS (below the 10 QPS per-user limit)
    await new Promise(resolve => setTimeout(resolve, throttleMs))
  }

  console.log(`[GCal sync] ${parent.name}: created ${created} new events`)
  return { parentId: parent.id, created, deleted }
}

/**
 * Decides which published entries are NOT correctly mirrored in Google Calendar.
 *
 * An entry is in sync when:
 *   - assigned to a parent: it has a gcal_events row for that parent's calendar,
 *     and no row for any other configured parent's calendar (no orphan left behind)
 *   - cleared (parentId null): it has no row in any configured parent's calendar
 */
export function findUnsyncedEntryIds(
  entries: Array<{ id: string; parentId: string | null }>,
  gcalRows: Array<{ scheduleEntryId: string; calendarId: string }>,
  parents: Array<{ id: string; calendarId: string }>,
): string[] {
  const parentCalendarIds = new Set(parents.map(p => p.calendarId))
  const calendarByParent = new Map(parents.map(p => [p.id, p.calendarId]))
  const rowsByEntry = new Map<string, Set<string>>()
  for (const row of gcalRows) {
    if (!parentCalendarIds.has(row.calendarId)) continue
    let set = rowsByEntry.get(row.scheduleEntryId)
    if (!set) rowsByEntry.set(row.scheduleEntryId, (set = new Set()))
    set.add(row.calendarId)
  }

  return entries
    .filter(entry => {
      const calendars = rowsByEntry.get(entry.id) ?? new Set<string>()
      if (entry.parentId === null) return calendars.size > 0
      const expected = calendarByParent.get(entry.parentId)
      if (!expected) return false // unknown parent — nothing we can sync to
      return !calendars.has(expected) || calendars.size > 1
    })
    .map(entry => entry.id)
}

/**
 * After a failed (or partially failed) sync, flips every published entry in the
 * window that is not actually reflected in Google Calendar back to 'draft', so the
 * UI does not claim it is published and the next publish retries it.
 * Returns the ids that were reverted.
 */
export async function revertUnsyncedEntriesToDraft(viewStart?: string, viewEnd?: string): Promise<string[]> {
  const config = await getAppConfig()
  const { start, end } = getWindowBounds(viewStart, viewEnd)
  const startStr = format(start, "yyyy-MM-dd")
  const endStr = format(end, "yyyy-MM-dd")

  const entries = await db
    .select({ id: scheduleEntries.id, parentId: scheduleEntries.parentId })
    .from(scheduleEntries)
    .where(
      and(
        eq(scheduleEntries.status, "published"),
        gte(scheduleEntries.day, startStr),
        lte(scheduleEntries.day, endStr),
      )
    )
  if (entries.length === 0) return []

  const rows = await db
    .select({ scheduleEntryId: gcalEvents.scheduleEntryId, calendarId: gcalEvents.calendarId })
    .from(gcalEvents)
    .where(inArray(gcalEvents.scheduleEntryId, entries.map(e => e.id)))

  const unsynced = findUnsyncedEntryIds(entries, rows, config.parents)
  if (unsynced.length === 0) return []

  await db.update(scheduleEntries)
    .set({ status: "draft" })
    .where(and(inArray(scheduleEntries.id, unsynced), eq(scheduleEntries.status, "published")))

  console.log(`[GCal sync] Reverted ${unsynced.length} unsynced entries to draft`)
  return unsynced
}
