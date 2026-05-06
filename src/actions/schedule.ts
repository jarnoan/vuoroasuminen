"use server"

import { db } from "@/db"
import { scheduleEntries, schedules, children } from "@/db/schema/domain"
import { and, eq, gte, lte } from "drizzle-orm"
import { auth } from "@/auth"
import type { ParentId } from "@/config/app"
import config from "@/config/app"
import { getWindowBounds, generateDefaultEntries } from "@/lib/schedule/generate-default"
import { addDays, addWeeks, endOfWeek, format, parseISO, isValid, differenceInCalendarDays } from "date-fns"
import { syncCalendarsAfterPublish } from "@/lib/gcal/sync"
import type { SyncResult } from "@/lib/gcal/sync"

const VALID_PARENT_IDS: ParentId[] = ["father", "mother"]

async function requireAuthorizedParent() {
  const session = await auth()
  const email = session?.user?.email
  if (!email) throw new Error("Not authenticated")
  const isAuthorized = config.parents.some((p) => p.email === email)
  if (!isAuthorized) throw new Error("Forbidden")
  return { session, email }
}

export async function toggleCell(entryId: string, newParentId: ParentId) {
  await requireAuthorizedParent()

  if (!VALID_PARENT_IDS.includes(newParentId)) {
    throw new Error("Invalid parentId")
  }

  await db.update(scheduleEntries)
    .set({ parentId: newParentId, status: "draft" })
    .where(eq(scheduleEntries.id, entryId))

  return { success: true }
}

export async function saveNotes(entryId: string, notes: string) {
  await requireAuthorizedParent()

  if (typeof notes !== "string") throw new Error("Invalid notes")
  if (notes.length > 500) throw new Error("Notes too long (max 500 characters)")

  await db.update(scheduleEntries)
    .set({ notes })
    .where(eq(scheduleEntries.id, entryId))

  return { success: true }
}

export async function publishSchedule(): Promise<
  | { success: true; count: number }
  | { success: false; error: string }
> {
  await requireAuthorizedParent()

  const { start, end } = getWindowBounds()
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

export async function syncCalendars(): Promise<SyncResult> {
  await requireAuthorizedParent()
  let syncResult: SyncResult
  try {
    syncResult = await syncCalendarsAfterPublish()
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
  return syncResult
}

export async function extendSchedule(input: {
  scheduleEndDate: string   // ISO YYYY-MM-DD — current schedule's last day (inclusive)
  weeks?: number            // EXTEND-01: number of weeks to add (default 12)
  endDate?: string          // EXTEND-03: explicit ISO end date (already snapped to Sunday by client)
}): Promise<
  | { success: true; newStartDate: string }
  | { success: false; error: string }
> {
  await requireAuthorizedParent()

  // --- Input validation ---
  if (input.endDate !== undefined && input.weeks !== undefined) {
    return { success: false, error: "Anna joko viikot tai päättymispäivä, ei molempia" }
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
  const defaults = generateDefaultEntries(rangeStart, rangeEnd, config.children)
  const insertValues = defaults.map(d => ({
    scheduleId: schedule.id,
    childId: childNameToId.get(d.childName)!,
    day: d.day,
    parentId: d.parentId,
    status: "draft" as const,
  }))

  // --- Batch insert; unique index (childId, day) makes this idempotent ---
  await db.insert(scheduleEntries).values(insertValues).onConflictDoNothing()

  return { success: true, newStartDate }
}
