import { db } from "@/db"
import { scheduleEntries, children, schedules } from "@/db/schema/domain"
import { and, gte, lte } from "drizzle-orm"
import { format, addDays, isToday as isTodayFn } from "date-fns"
import { fi } from "date-fns/locale"
import config from "@/config/app"
import { generateDefaultEntries, getWindowBounds } from "./generate-default"
import type { ScheduleDay, DateWindow, ScheduleCell, ParentId } from "./types"

export async function getScheduleWindow(): Promise<DateWindow> {
  const { start, end } = getWindowBounds()
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
    const defaults = generateDefaultEntries(start, end, config.children)

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

  // Build days array
  const days: ScheduleDay[] = []
  let current = start
  for (let i = 0; i < 84; i++) {
    const dateStr = format(current, "yyyy-MM-dd")
    const dayEntries = entryMap.get(dateStr)
    const firstEntry = dayEntries?.values().next().value

    const cells: ScheduleCell[] = orderedChildren.map(child => {
      const entry = dayEntries?.get(child.id)
      return {
        entryId: entry?.id ?? null,
        childId: child.id,
        childName: child.name,
        parentId: (entry?.parentId ?? config.firstParent) as ParentId,
        status: (entry?.status ?? "draft") as "draft" | "published",
      }
    })

    days.push({
      date: dateStr,
      dayLabel: format(current, "EEEEEE d.M.", { locale: fi }),
      isToday: isTodayFn(current),
      isWeekStart: current.getDay() === 1,  // Monday
      cells,
      notes: firstEntry?.notes ?? "",
      notesEntryId: firstEntry?.id ?? null,
    })

    current = addDays(current, 1)
  }

  return { startDate: startStr, endDate: endStr, days }
}
