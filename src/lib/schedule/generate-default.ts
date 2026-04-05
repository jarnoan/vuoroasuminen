import { addDays, differenceInCalendarWeeks, startOfToday, startOfWeek, format } from "date-fns"
import config from "@/config/app"
import type { ParentId } from "./types"

/**
 * Generate default schedule entries for the 12-week rolling window.
 * Uses the alternating-week pattern from AppConfig:
 * - config.startDate is the first Monday of the pattern
 * - config.firstParent gets week 1, the other parent gets week 2, alternating
 * - Each child gets the same parent for the full week (Mon-Sun)
 *
 * Returns an array of { childName, day, parentId } objects ready for DB insert.
 */
export function generateDefaultEntries(
  windowStart: Date,
  windowEnd: Date,
  childNames: string[]
): Array<{ childName: string; day: string; parentId: ParentId }> {
  const patternStart = new Date(config.startDate)
  const otherParent: ParentId = config.firstParent === "father" ? "mother" : "father"
  const entries: Array<{ childName: string; day: string; parentId: ParentId }> = []

  let current = windowStart
  while (current <= windowEnd) {
    const weekOffset = differenceInCalendarWeeks(current, patternStart, { weekStartsOn: 1 })
    const parentForWeek: ParentId = weekOffset % 2 === 0 ? config.firstParent : otherParent

    const dayStr = format(current, "yyyy-MM-dd")
    for (const childName of childNames) {
      entries.push({ childName, day: dayStr, parentId: parentForWeek })
    }
    current = addDays(current, 1)
  }

  return entries
}

/**
 * Compute the 12-week rolling window starting from the Monday of the current week.
 */
export function getWindowBounds(): { start: Date; end: Date } {
  const today = startOfToday()
  const start = startOfWeek(today, { weekStartsOn: 1 }) // Monday
  const end = addDays(start, 12 * 7 - 1) // 84 days, inclusive
  return { start, end }
}
