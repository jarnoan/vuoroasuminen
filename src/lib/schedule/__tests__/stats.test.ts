import { describe, it, expect } from "vitest"
import { computeStats } from "../stats"
import type { ScheduleDay, ScheduleCell } from "../types"
import type { ParentId } from "@/config/app"

const parents = [
  { id: "father" as ParentId, name: "Isä" },
  { id: "mother" as ParentId, name: "Äiti" },
]

const children = ["Emma", "Olivia"]

function makeDay(date: string, assignments: Record<string, ParentId>): ScheduleDay {
  const cells: ScheduleCell[] = children.map((childName) => ({
    entryId: `entry-${date}-${childName}`,
    childId: childName.toLowerCase(),
    childName,
    parentId: assignments[childName] ?? "father",
    status: "published" as const,
  }))
  return {
    date,
    dayLabel: date,
    isToday: false,
    isWeekStart: false,
    cells,
    notes: "",
    notesEntryId: null,
  }
}

describe("computeStats", () => {
  it("STAT-01: counts days per child per parent correctly", () => {
    const days = [
      makeDay("2026-04-06", { Emma: "father", Olivia: "father" }), // Mon
      makeDay("2026-04-07", { Emma: "father", Olivia: "father" }), // Tue
      makeDay("2026-04-08", { Emma: "father", Olivia: "mother" }), // Wed
      makeDay("2026-04-09", { Emma: "father", Olivia: "mother" }), // Thu
      makeDay("2026-04-10", { Emma: "mother", Olivia: "mother" }), // Fri
      makeDay("2026-04-11", { Emma: "mother", Olivia: "mother" }), // Sat
      makeDay("2026-04-13", { Emma: "mother", Olivia: "mother" }), // Mon
    ]
    const stats = computeStats(days, parents)
    const emmaStats = stats.childStats.find((c) => c.childName === "Emma")!
    const oliviaStats = stats.childStats.find((c) => c.childName === "Olivia")!

    expect(emmaStats.father).toBe(4)
    expect(emmaStats.mother).toBe(3)
    expect(oliviaStats.father).toBe(2)
    expect(oliviaStats.mother).toBe(5)
  })

  it("STAT-02: counts solo days (child alone with parent) correctly", () => {
    const days = [
      // Emma with father, Olivia with mother → solo for both
      makeDay("2026-04-06", { Emma: "father", Olivia: "mother" }),
      // Both with father → no solo for either
      makeDay("2026-04-07", { Emma: "father", Olivia: "father" }),
      // Both with mother → no solo for either
      makeDay("2026-04-08", { Emma: "mother", Olivia: "mother" }),
      // Emma with mother, Olivia with father → solo for both
      makeDay("2026-04-09", { Emma: "mother", Olivia: "father" }),
    ]
    const stats = computeStats(days, parents)
    const emmaStats = stats.childStats.find((c) => c.childName === "Emma")!
    const oliviaStats = stats.childStats.find((c) => c.childName === "Olivia")!

    expect(emmaStats.soloFather).toBe(1)
    expect(emmaStats.soloMother).toBe(1)
    expect(oliviaStats.soloFather).toBe(1)
    expect(oliviaStats.soloMother).toBe(1)
  })

  it("STAT-03: counts child-free days per parent", () => {
    const days = [
      // All with mother → father is child-free
      makeDay("2026-04-06", { Emma: "mother", Olivia: "mother" }),
      // All with father → mother is child-free
      makeDay("2026-04-07", { Emma: "father", Olivia: "father" }),
      // Split → neither is child-free
      makeDay("2026-04-08", { Emma: "father", Olivia: "mother" }),
      // All with mother again → father is child-free
      makeDay("2026-04-09", { Emma: "mother", Olivia: "mother" }),
    ]
    const stats = computeStats(days, parents)
    const fatherFree = stats.parentFreeStats.find((p) => p.parentId === "father")!
    const motherFree = stats.parentFreeStats.find((p) => p.parentId === "mother")!

    expect(fatherFree.childFreeDays).toBe(2)
    expect(motherFree.childFreeDays).toBe(1)
  })

  it("STAT-04: counts child-free weekends (both Sat AND Sun must be free)", () => {
    // 2026-04-04 = Saturday, 2026-04-05 = Sunday
    const days = [
      makeDay("2026-04-04", { Emma: "mother", Olivia: "mother" }), // Sat - father free
      makeDay("2026-04-05", { Emma: "mother", Olivia: "mother" }), // Sun - father free
    ]
    const stats = computeStats(days, parents)
    const fatherFree = stats.parentFreeStats.find((p) => p.parentId === "father")!

    expect(fatherFree.childFreeWeekends).toBe(1)
  })

  it("STAT-04: does NOT count weekend if only one day is child-free", () => {
    // 2026-04-04 = Saturday, 2026-04-05 = Sunday
    const days = [
      makeDay("2026-04-04", { Emma: "mother", Olivia: "mother" }), // Sat - father free
      makeDay("2026-04-05", { Emma: "father", Olivia: "mother" }), // Sun - father NOT free (Emma is with father)
    ]
    const stats = computeStats(days, parents)
    const fatherFree = stats.parentFreeStats.find((p) => p.parentId === "father")!

    expect(fatherFree.childFreeWeekends).toBe(0)
  })

  it("STAT-05: stats include both draft and published entries (no filtering by status)", () => {
    const days: ScheduleDay[] = [
      {
        date: "2026-04-06",
        dayLabel: "Mon 6 Apr",
        isToday: false,
        isWeekStart: true,
        notes: "",
        notesEntryId: null,
        cells: [
          { entryId: "1", childId: "emma", childName: "Emma", parentId: "father", status: "draft" },
          { entryId: "2", childId: "olivia", childName: "Olivia", parentId: "mother", status: "published" },
        ],
      },
    ]
    const stats = computeStats(days, parents)
    const emmaStats = stats.childStats.find((c) => c.childName === "Emma")!
    const oliviaStats = stats.childStats.find((c) => c.childName === "Olivia")!

    // Both draft and published are counted
    expect(emmaStats.father).toBe(1)
    expect(oliviaStats.mother).toBe(1)
  })
})
