import type { ScheduleDay, ParentId } from "./types"
import { parseISO, getDay } from "date-fns"

export interface ChildStats {
  childName: string
  father: number       // total days with father
  mother: number       // total days with mother
  soloFather: number   // days child is alone with father (no other children present with father)
  soloMother: number   // days child is alone with mother
}

export interface ParentFreeStats {
  parentId: ParentId
  parentName: string
  childFreeDays: number      // days with zero children
  childFreeWeekends: number  // full Sat+Sun weekends with zero children
}

export interface ScheduleStats {
  childStats: ChildStats[]
  parentFreeStats: ParentFreeStats[]
}

export function computeStats(
  days: ScheduleDay[],
  parents: Array<{ id: ParentId; name: string }>,
): ScheduleStats {
  // Derive child names from first day's cells
  const childNames = days[0]?.cells.map((c) => c.childName) ?? []

  // Per-child: count days with each parent and solo days
  const childStatsMap = new Map<
    string,
    { father: number; mother: number; soloFather: number; soloMother: number }
  >()
  for (const name of childNames) {
    childStatsMap.set(name, { father: 0, mother: 0, soloFather: 0, soloMother: 0 })
  }

  // Per-parent: track which dates are child-free
  const parentFreeDatesMap = new Map<ParentId, Set<string>>()
  for (const p of parents) {
    parentFreeDatesMap.set(p.id, new Set())
  }

  for (const day of days) {
    // Which children are with which parent on this day
    const withFather = day.cells
      .filter((c) => c.parentId === "father")
      .map((c) => c.childName)
    const withMother = day.cells
      .filter((c) => c.parentId === "mother")
      .map((c) => c.childName)

    // STAT-01: days per child per parent (no status filtering — per STAT-05)
    for (const cell of day.cells) {
      const stats = childStatsMap.get(cell.childName)!
      stats[cell.parentId]++
    }

    // STAT-02: solo days — child is the only child with that parent on this day
    if (withFather.length === 1) {
      childStatsMap.get(withFather[0])!.soloFather++
    }
    if (withMother.length === 1) {
      childStatsMap.get(withMother[0])!.soloMother++
    }

    // STAT-03: child-free days — zero children with that parent
    if (withFather.length === 0) {
      parentFreeDatesMap.get("father")!.add(day.date)
    }
    if (withMother.length === 0) {
      parentFreeDatesMap.get("mother")!.add(day.date)
    }
  }

  // STAT-04: child-free weekends — full Sat+Sun where parent has zero children
  // Find all Saturdays in the window and check if that Sunday is also child-free
  function countChildFreeWeekends(freeDates: Set<string>): number {
    let count = 0
    for (const dateStr of freeDates) {
      const date = parseISO(dateStr)
      if (getDay(date) === 6) {
        // Saturday — look for the next day (Sunday) also in freeDates
        const sunday = days.find((d) => {
          const dDate = parseISO(d.date)
          return getDay(dDate) === 0 && dDate.getTime() - date.getTime() === 86400000
        })
        if (sunday && freeDates.has(sunday.date)) {
          count++
        }
      }
    }
    return count
  }

  const childStats: ChildStats[] = childNames.map((name) => ({
    childName: name,
    ...childStatsMap.get(name)!,
  }))

  const parentFreeStats: ParentFreeStats[] = parents.map((p) => ({
    parentId: p.id,
    parentName: p.name,
    childFreeDays: parentFreeDatesMap.get(p.id)!.size,
    childFreeWeekends: countChildFreeWeekends(parentFreeDatesMap.get(p.id)!),
  }))

  return { childStats, parentFreeStats }
}
