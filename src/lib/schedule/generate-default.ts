import { addDays, differenceInCalendarWeeks, startOfToday, startOfWeek, format, parseISO } from "date-fns"
import type { ParentId } from "./types"

/**
 * Generate default schedule entries for the 12-week rolling window.
 * Uses the alternating-week pattern from caller-supplied parameters
 * (Phase 12 D-16 — accepts config as parameters rather than reading
 * a module-scope singleton, so the function is unit-testable and
 * compatible with the async DB-backed config).
 *
 * - startDate is the first Monday of the alternating pattern
 * - firstParent gets week 1; the other parent gets week 2, alternating
 * - Each child gets the same parent for the full week (Mon-Sun)
 *
 * Returns an array of { childName, day, parentId } objects ready for DB insert.
 */
export function generateDefaultEntries(
  windowStart: Date,
  windowEnd: Date,
  childNames: string[],
  startDate: string,
  firstParent: ParentId,
): Array<{ childName: string; day: string; parentId: ParentId }> {
  const patternStart = new Date(startDate)
  const otherParent: ParentId = firstParent === "father" ? "mother" : "father"
  const entries: Array<{ childName: string; day: string; parentId: ParentId }> = []

  let current = windowStart
  while (current <= windowEnd) {
    const weekOffset = differenceInCalendarWeeks(current, patternStart, { weekStartsOn: 1 })
    const parentForWeek: ParentId = weekOffset % 2 === 0 ? firstParent : otherParent

    const dayStr = format(current, "yyyy-MM-dd")
    for (const childName of childNames) {
      entries.push({ childName, day: dayStr, parentId: parentForWeek })
    }
    current = addDays(current, 1)
  }

  return entries
}

/**
 * Compute the displayed schedule window.
 * - When startDate is provided (pre-validated ISO string from page.tsx), use it directly.
 * - When omitted, defaults to Monday of the current week.
 * - When endDate is provided (pre-validated ISO string, already after start), use it directly.
 * - When omitted, defaults to the 12-week (84-day) rolling window.
 */
export function getWindowBounds(startDate?: string, endDate?: string): { start: Date; end: Date } {
  let start: Date
  if (startDate) {
    // startDate already validated and snapped to Monday by page.tsx validateViewStart
    start = parseISO(startDate)
  } else {
    const today = startOfToday()
    start = startOfWeek(today, { weekStartsOn: 1 }) // Monday
  }
  // endDate already validated and snapped to Sunday by page.tsx validateViewEnd
  const end = endDate ? parseISO(endDate) : addDays(start, 12 * 7 - 1) // default: 84 days, inclusive
  return { start, end }
}
