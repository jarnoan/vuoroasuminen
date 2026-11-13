"use server"

import { db } from "@/db"
import { scheduleEntries, schedules, children, dayNotes } from "@/db/schema/domain"
import { and, eq, gte, isNull, lte, sql } from "drizzle-orm"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { ParentId } from "@/config/app"
import { getAppConfig } from "@/config/app"
import { getWindowBounds, generateDefaultEntries } from "@/lib/schedule/generate-default"
import { addDays, addWeeks, endOfWeek, format, parseISO, isValid, differenceInCalendarDays } from "date-fns"
import { syncCalendarsAfterPublish, revertUnsyncedEntriesToDraft } from "@/lib/gcal/sync"
import type { SyncResult } from "@/lib/gcal/sync"
import { getScheduleWindow } from "@/lib/schedule/queries"
import type { DateWindow, DayNote } from "@/lib/schedule/types"
import { validateNoteInput, type NoteInput } from "@/lib/schedule/notes"
import { validateViewStart, validateViewEnd } from "@/lib/schedule/view-range"

const VALID_PARENT_IDS: ParentId[] = ["father", "mother"]

async function requireAuthorizedParent() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email
  if (!email) throw new Error("Not authenticated")
  const config = await getAppConfig()
  const isAuthorized = config.parents.some((p) => p.email === email)
  if (!isAuthorized) throw new Error("Forbidden")
  return { user, email }
}

export async function toggleCell(entryId: string, newParentId: ParentId) {
  await requireAuthorizedParent()

  if (!entryId) throw new Error("Missing entryId")

  if (!VALID_PARENT_IDS.includes(newParentId)) {
    throw new Error("Invalid parentId")
  }

  await db.update(scheduleEntries)
    .set({ parentId: newParentId, status: "draft" })
    .where(eq(scheduleEntries.id, entryId))

  return { success: true }
}

type NoteResult = { success: true; note: DayNote } | { success: false; error: string }

export async function createNote(input: NoteInput): Promise<NoteResult> {
  await requireAuthorizedParent()
  const checked = validateNoteInput(input)
  if (!checked.ok) return { success: false, error: checked.error }
  const [row] = await db.insert(dayNotes).values(checked.value).returning({
    id: dayNotes.id, startDay: dayNotes.startDay, endDay: dayNotes.endDay, text: dayNotes.text,
  })
  return { success: true, note: row }
}

export async function updateNote(id: string, input: NoteInput): Promise<NoteResult> {
  await requireAuthorizedParent()
  if (!id || typeof id !== "string") return { success: false, error: "Muistiinpanoa ei löydy" }
  const checked = validateNoteInput(input)
  if (!checked.ok) return { success: false, error: checked.error }
  const [row] = await db.update(dayNotes)
    .set({ ...checked.value, updatedAt: new Date() })
    .where(eq(dayNotes.id, id))
    .returning({ id: dayNotes.id, startDay: dayNotes.startDay, endDay: dayNotes.endDay, text: dayNotes.text })
  if (!row) return { success: false, error: "Muistiinpanoa ei löydy — se on ehkä poistettu" }
  return { success: true, note: row }
}

export async function deleteNote(id: string): Promise<{ success: true } | { success: false; error: string }> {
  await requireAuthorizedParent()
  if (!id || typeof id !== "string") return { success: false, error: "Muistiinpanoa ei löydy" }
  await db.delete(dayNotes).where(eq(dayNotes.id, id))
  return { success: true }
}

export async function publishSchedule(viewStart?: string, viewEnd?: string): Promise<
  | { success: true; count: number }
  | { success: false; error: string }
> {
  await requireAuthorizedParent()

  const { start, end } = getWindowBounds(viewStart, viewEnd)
  const startStr = format(start, "yyyy-MM-dd")
  const endStr = format(end, "yyyy-MM-dd")

  const result = await db.update(scheduleEntries)
    .set({ status: "published" })
    .where(
      and(
        eq(scheduleEntries.status, "draft"),
        gte(scheduleEntries.day, startStr),
        lte(scheduleEntries.day, endStr),
      )
    )
    .returning({ id: scheduleEntries.id })

  return { success: true, count: result.length }
}

export async function syncCalendars(
  viewStart?: string,
  viewEnd?: string,
): Promise<SyncResult & { revertedEntryIds: string[] }> {
  await requireAuthorizedParent()
  let syncResult: SyncResult
  try {
    syncResult = await syncCalendarsAfterPublish(viewStart, viewEnd)
  } catch (err) {
    // Log the error but still return a result object — sync is best-effort
    console.error("[syncCalendars] GCal sync threw unexpectedly:", err)
    syncResult = {
      success: false,
      parentResults: [
        { parentId: "unknown", created: 0, deleted: 0, error: String(err) },
      ],
    }
  }

  console.log("[syncCalendars] syncResult:", JSON.stringify(syncResult, null, 2))

  // On failure, entries that did not make it into Google Calendar must not stay
  // marked as published — flip them back to draft so the UI is truthful and the
  // next publish retries them.
  let revertedEntryIds: string[] = []
  if (!syncResult.success) {
    try {
      revertedEntryIds = await revertUnsyncedEntriesToDraft(viewStart, viewEnd)
    } catch (err) {
      console.error("[syncCalendars] Failed to revert unsynced entries to draft:", err)
    }
  }

  return { ...syncResult, revertedEntryIds }
}

export async function extendSchedule(input: {
  scheduleEndDate: string   // ISO YYYY-MM-DD — current schedule's last day (inclusive)
  weeks?: number            // EXTEND-01: number of weeks to add (default 12)
  endDate?: string          // EXTEND-03: explicit ISO end date (already snapped to Sunday by client)
  firstParent?: ParentId    // which parent's week the new range starts with (defaults to the config pattern)
}): Promise<
  | { success: true; newStartDate: string }
  | { success: false; error: string }
> {
  await requireAuthorizedParent()

  // --- Input validation ---
  if (input.endDate !== undefined && input.weeks !== undefined) {
    return { success: false, error: "Anna joko viikot tai päättymispäivä, ei molempia" }
  }

  if (input.firstParent !== undefined && !VALID_PARENT_IDS.includes(input.firstParent)) {
    return { success: false, error: "Virheellinen vanhempi" }
  }

  const endParsed = parseISO(input.scheduleEndDate)
  if (!input.scheduleEndDate || !isValid(endParsed)) {
    return { success: false, error: "Virheellinen aikataulun päättymispäivä" }
  }

  let rangeEnd: Date
  if (input.endDate !== undefined) {
    const picked = parseISO(input.endDate)
    if (!isValid(picked)) {
      return { success: false, error: "Virheellinen päättymispäivä" }
    }
    const daysDelta = differenceInCalendarDays(picked, endParsed)
    if (daysDelta < 1) {
      return { success: false, error: "Päättymispäivän on oltava aikataulun loppupäivän jälkeen" }
    }
    if (daysDelta > 730) {
      return { success: false, error: "Päättymispäivä on liian kaukana (max 2 vuotta)" }
    }
    rangeEnd = picked
  } else {
    const weeks = input.weeks ?? 12
    if (!Number.isInteger(weeks) || weeks < 1 || weeks > 52) {
      return { success: false, error: "Viikkojen määrän on oltava 1–52" }
    }
    const rangeStartTmp = addDays(endParsed, 1)
    // weekStartsOn: 1 means Monday starts the week → Sunday ends it (D-07: snap to Sunday)
    rangeEnd = endOfWeek(addWeeks(rangeStartTmp, weeks - 1), { weekStartsOn: 1 })
  }

  const rangeStart = addDays(endParsed, 1)
  const newStartDate = format(rangeStart, "yyyy-MM-dd")

  // --- Build child name → id map (mirrors queries.ts pattern) ---
  const config = await getAppConfig()
  const allChildren = await db.select().from(children)
  const orderedChildren = config.children
    .map(name => allChildren.find(c => c.name === name))
    .filter((c): c is typeof allChildren[number] => c != null)
  const childNameToId = new Map(orderedChildren.map(c => [c.name, c.id]))

  // --- Create a schedules row (same as seeding logic in queries.ts) ---
  const [schedule] = await db.insert(schedules).values({}).returning()

  // --- Verify all configured children exist in DB ---
  const missingChildren = config.children.filter(name => !childNameToId.has(name))
  if (missingChildren.length > 0) {
    return {
      success: false,
      error: `Lapsia ei löydy tietokannasta: ${missingChildren.join(", ")}`,
    }
  }

  // --- Generate alternating-default entries for the new range ---
  // When an explicit firstParent is given, anchor the alternating pattern to rangeStart
  // itself so the new range starts with exactly that parent, instead of continuing the
  // config's original startDate-based formula.
  const defaults = input.firstParent
    ? generateDefaultEntries(rangeStart, rangeEnd, config.children, format(rangeStart, "yyyy-MM-dd"), input.firstParent)
    : generateDefaultEntries(rangeStart, rangeEnd, config.children, config.startDate, config.firstParent)
  const insertValues = defaults.map(d => ({
    scheduleId: schedule.id,
    childId: childNameToId.get(d.childName)!,
    day: d.day,
    parentId: d.parentId,
    status: "draft" as const,
  }))

  // --- Batch upsert on the unique index (childId, day) ---
  // Days that already exist are only filled in when blank (cleared); assigned days are kept,
  // so re-running the same extend is still idempotent.
  await db.insert(scheduleEntries).values(insertValues).onConflictDoUpdate({
    target: [scheduleEntries.childId, scheduleEntries.day],
    set: { parentId: sql`excluded.parent_id`, status: "draft" },
    setWhere: isNull(scheduleEntries.parentId),
  })

  return { success: true, newStartDate }
}

export async function clearCell(entryId: string): Promise<
  | { success: true }
  | { success: false; error: string }
> {
  await requireAuthorizedParent()

  if (!entryId) return { success: false, error: "Missing entryId" }

  await db.update(scheduleEntries)
    .set({ parentId: null, status: "draft" })
    .where(eq(scheduleEntries.id, entryId))

  return { success: true }
}

export async function clearRange(input: {
  startDate: string  // ISO YYYY-MM-DD (inclusive)
  endDate: string    // ISO YYYY-MM-DD (inclusive)
}): Promise<
  | { success: true; clearedCount: number }
  | { success: false; error: string }
> {
  await requireAuthorizedParent()

  const start = parseISO(input.startDate)
  const end = parseISO(input.endDate)

  if (!isValid(start) || !isValid(end)) {
    return { success: false, error: "Virheellinen päivämäärä" }
  }

  const daysDelta = differenceInCalendarDays(end, start)
  if (daysDelta < 0) {
    return { success: false, error: "Päättymispäivän on oltava alkamispäivän jälkeen" }
  }
  if (daysDelta > 730) {
    return { success: false, error: "Aikaväli on liian pitkä (max 2 vuotta)" }
  }

  const result = await db.update(scheduleEntries)
    .set({ parentId: null, status: "draft" })
    .where(
      and(
        gte(scheduleEntries.day, input.startDate),
        lte(scheduleEntries.day, input.endDate),
      )
    )
    .returning({ id: scheduleEntries.id })

  return { success: true, clearedCount: result.length }
}

// Full refresh of the displayed window (days and notes) — used by realtime recovery
export async function getScheduleData(viewStart?: string, viewEnd?: string): Promise<DateWindow> {
  await requireAuthorizedParent()
  return getScheduleWindow(viewStart, viewEnd)
}

/**
 * Loads the schedule for a client-chosen view range. Inputs are validated/snapped
 * (Monday start, Sunday end, 2-year cap); the effective bounds are returned so the
 * client keeps exactly what the server used.
 */
export async function getScheduleView(viewStart?: string, viewEnd?: string): Promise<{
  viewStart?: string
  viewEnd?: string
  window: DateWindow
}> {
  await requireAuthorizedParent()
  const start = validateViewStart(viewStart)
  const end = validateViewEnd(viewEnd, start)
  const window = await getScheduleWindow(start, end)
  return { viewStart: start, viewEnd: end, window }
}
