import { parseISO, isValid, startOfWeek, endOfWeek, startOfToday, differenceInCalendarDays, format } from "date-fns"

/** Snaps a requested view start to the Monday of its week; undefined if missing/invalid. */
export function validateViewStart(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const parsed = parseISO(raw)
  if (!isValid(parsed)) return undefined
  // Snap to Monday of that week (weekStartsOn: 1 = Monday, Finnish convention)
  const monday = startOfWeek(parsed, { weekStartsOn: 1 })
  return format(monday, "yyyy-MM-dd")
}

// EXTEND-03/D-07 convention: end dates snap to Sunday (weekStartsOn: 1 → end of week)
export function validateViewEnd(raw: string | undefined, validatedStart: string | undefined): string | undefined {
  if (!raw) return undefined
  const parsed = parseISO(raw)
  if (!isValid(parsed)) return undefined
  const sunday = endOfWeek(parsed, { weekStartsOn: 1 })

  const start = validatedStart
    ? parseISO(validatedStart)
    : startOfWeek(startOfToday(), { weekStartsOn: 1 })

  const daysDelta = differenceInCalendarDays(sunday, start)
  // Ignore an end date that doesn't leave at least one day, or is unreasonably far out
  // (same 2-year cap as extendSchedule/clearRange in actions/schedule.ts)
  if (daysDelta < 1 || daysDelta > 730) return undefined

  return format(sunday, "yyyy-MM-dd")
}
