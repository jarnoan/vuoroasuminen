import { db } from "@/db"
import { gcalEvents, scheduleEntries, children as childrenTable } from "@/db/schema/domain"
import { eq, and, gte, lte, inArray } from "drizzle-orm"
import { addDays, parseISO, format } from "date-fns"
import { getWindowBounds } from "@/lib/schedule/generate-default"
import { getAppConfig } from "@/config/app"
import { buildGCalClient } from "@/lib/gcal/client"

/**
 * Retries an async operation on 429 / 503 rate-limit errors.
 * Backoff: 2^attempt * 1000ms + random jitter up to 1000ms, max 5 retries.
 * googleapis surfaces rate-limit errors as objects where:
 *   (err as any).code === 429
 *   OR (err as any).status === 429 / 503
 *   OR (err as any).errors?.[0]?.domain === 'usageLimits'
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 5): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err: unknown) {
      const e = err as { code?: number; status?: number; errors?: Array<{ domain?: string }> }
      const isRateLimit =
        e?.code === 429 ||
        e?.status === 429 ||
        e?.status === 503 ||
        e?.errors?.[0]?.domain === 'usageLimits'

      if (!isRateLimit || attempt === maxRetries) throw err

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
export async function syncCalendarsAfterPublish(viewStart?: string): Promise<SyncResult> {
  const config = await getAppConfig()
  const { start, end } = getWindowBounds(viewStart)
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
  const settledResults = await Promise.allSettled(
    config.parents.map(parent =>
      syncParentCalendar(parent, publishedEntries, existingGcalRows, childNameMap)
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
  childNameMap: Map<string, string>
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
    // Throttle to ~9 QPS (below the 10 QPS per-user limit) even with 2 parents concurrent
    await new Promise(resolve => setTimeout(resolve, 110))
  }

  console.log(`[GCal sync] ${parent.name}: created ${created} new events`)
  return { parentId: parent.id, created, deleted }
}
