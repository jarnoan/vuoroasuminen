import { db } from "@/db"
import { scheduleEntries, children, schedules, dayNotes } from "@/db/schema/domain"
import { and, asc, gte, isNotNull, lte, max, min } from "drizzle-orm"
import { format, addDays, parseISO, startOfWeek, endOfWeek, differenceInCalendarDays, isToday as isTodayFn } from "date-fns"
import { fi } from "date-fns/locale"
import { getAppConfig } from "@/config/app"
import { generateDefaultEntries, getWindowBounds } from "./generate-default"
import type { ScheduleDay, DateWindow, ScheduleCell, ParentId, DayNote } from "./types"

export async function getScheduleWindow(startDate?: string, endDate?: string): Promise<DateWindow> {
  const config = await getAppConfig()
  const { start, end } = getWindowBounds(startDate, endDate)
  const startStr = format(start, "yyyy-MM-dd")
  const endStr = format(end, "yyyy-MM-dd")

  // Fetch children from DB (ordered by config order)
  const allChildren = await db.select().from(children)
  const childOrder = config.children
  const orderedChildren = childOrder
    .map(name => allChildren.find(c => c.name === name))
    .filter((c): c is typeof allChildren[number] => c != null)

  // Fetch existing entries for the window
  let entries = await db.select().from(scheduleEntries)
    .where(and(gte(scheduleEntries.day, startStr), lte(scheduleEntries.day, endStr)))

  // If no entries exist for this window, seed with defaults
  if (entries.length === 0) {
    // Create a schedule record
    const [schedule] = await db.insert(schedules).values({}).returning()
    const defaults = generateDefaultEntries(start, end, config.children, config.startDate, config.firstParent)

    // Map child names to IDs
    const childNameToId = new Map(orderedChildren.map(c => [c.name, c.id]))

    const insertValues = defaults.map(d => ({
      scheduleId: schedule.id,
      childId: childNameToId.get(d.childName)!,
      day: d.day,
      parentId: d.parentId,
      status: "draft" as const,
    }))

    // Batch insert (Drizzle supports bulk insert)
    await db.insert(scheduleEntries).values(insertValues).onConflictDoNothing()

    // Re-fetch to get IDs
    entries = await db.select().from(scheduleEntries)
      .where(and(gte(scheduleEntries.day, startStr), lte(scheduleEntries.day, endStr)))
  }

  // Build a lookup: day -> childId -> entry
  const entryMap = new Map<string, Map<string, typeof entries[number]>>()
  for (const entry of entries) {
    if (!entryMap.has(entry.day)) entryMap.set(entry.day, new Map())
    entryMap.get(entry.day)!.set(entry.childId, entry)
  }

  // Build days array — skip dates with no DB rows (rolling window tail)
  const days: ScheduleDay[] = []
  const dayCount = differenceInCalendarDays(end, start) + 1
  let current = start
  for (let i = 0; i < dayCount; i++) {
    const dateStr = format(current, "yyyy-MM-dd")
    const dayEntries = entryMap.get(dateStr)
    if (!dayEntries) {
      current = addDays(current, 1)
      continue
    }

    const cells: ScheduleCell[] = orderedChildren.map(child => {
      const entry = dayEntries?.get(child.id)
      return {
        entryId: entry?.id ?? null,
        childId: child.id,
        childName: child.name,
        parentId: (entry ? (entry.parentId as ParentId | null) : config.firstParent) as ParentId | null,
        status: (entry?.status ?? "draft") as "draft" | "published",
      }
    })

    days.push({
      date: dateStr,
      dayLabel: format(current, "EEEEEE d.M.", { locale: fi }),
      isToday: isTodayFn(current),
      isWeekStart: current.getDay() === 1,  // Monday
      cells,
    })

    current = addDays(current, 1)
  }

  const notes = await getNotesOverlapping(startStr, endStr)
  return { startDate: startStr, endDate: endStr, days, notes }
}

// Notes whose range overlaps [startStr, endStr] (both inclusive ISO dates)
export async function getNotesOverlapping(startStr: string, endStr: string): Promise<DayNote[]> {
  const rows = await db.select({
    id: dayNotes.id,
    startDay: dayNotes.startDay,
    endDay: dayNotes.endDay,
    text: dayNotes.text,
  }).from(dayNotes)
    .where(and(lte(dayNotes.startDay, endStr), gte(dayNotes.endDay, startStr)))
    .orderBy(asc(dayNotes.startDay), asc(dayNotes.createdAt))
  return rows
}

// Returns the actual last day that has schedule entries in the DB.
// Used by ExtendPanel so the extend base is the real data end, not the view window end.
// Last assigned day of the schedule, snapped forward to that week's Sunday, so "add weeks"
// always starts on a Monday. Cleared (blank) days at the tail don't count: extending
// re-fills them. With nothing assigned at all, it's the day before the first stored day.
export async function getScheduleEndDate(): Promise<string | null> {
  const lastAssigned = await getLastAssignedDay()
  if (lastAssigned) return format(endOfWeek(parseISO(lastAssigned), { weekStartsOn: 1 }), "yyyy-MM-dd")
  const [row] = await db.select({ minDay: min(scheduleEntries.day) }).from(scheduleEntries)
  if (!row?.minDay) return null
  return format(addDays(startOfWeek(parseISO(row.minDay), { weekStartsOn: 1 }), -1), "yyyy-MM-dd")
}

async function getLastAssignedDay(): Promise<string | null> {
  const [row] = await db.select({ maxDay: max(scheduleEntries.day) })
    .from(scheduleEntries)
    .where(isNotNull(scheduleEntries.parentId))
  return row?.maxDay ?? null
}

// Returns the parent of the most recent assigned week (its first assigned day) — used by
// ExtendPanel to default the new range's starting parent to the opposite one, continuing
// the alternating pattern from whatever actually ended up in the DB (not the config formula,
// since past weeks may have been edited manually and no longer strictly alternate).
export async function getLastWeekStartParent(): Promise<ParentId | null> {
  const lastAssigned = await getLastAssignedDay()
  if (!lastAssigned) return null

  const monday = format(startOfWeek(parseISO(lastAssigned), { weekStartsOn: 1 }), "yyyy-MM-dd")
  const [entry] = await db.select({ parentId: scheduleEntries.parentId })
    .from(scheduleEntries)
    .where(and(
      gte(scheduleEntries.day, monday),
      lte(scheduleEntries.day, lastAssigned),
      isNotNull(scheduleEntries.parentId),
    ))
    .orderBy(asc(scheduleEntries.day))
    .limit(1)

  return (entry?.parentId as ParentId | null) ?? null
}
