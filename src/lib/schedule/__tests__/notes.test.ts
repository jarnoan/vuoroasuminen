import { describe, it, expect } from "vitest"
import { layoutNotes, validateNoteInput, noteDayCount } from "../notes"
import type { DayNote } from "../types"

const note = (id: string, startDay: string, endDay: string): DayNote => ({ id, startDay, endDay, text: id })
const dates = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => `2026-11-${String(from + i).padStart(2, "0")}`)

describe("validateNoteInput", () => {
  it("trims text and accepts a single day", () => {
    expect(validateNoteInput({ startDay: "2026-11-09", endDay: "2026-11-09", text: "  Leiri " }))
      .toEqual({ ok: true, value: { startDay: "2026-11-09", endDay: "2026-11-09", text: "Leiri" } })
  })
  it("rejects empty text, reversed ranges, bad dates and over-long spans", () => {
    expect(validateNoteInput({ startDay: "2026-11-09", endDay: "2026-11-09", text: "   " }).ok).toBe(false)
    expect(validateNoteInput({ startDay: "2026-11-10", endDay: "2026-11-09", text: "x" }).ok).toBe(false)
    expect(validateNoteInput({ startDay: "2026-13-01", endDay: "2026-13-01", text: "x" }).ok).toBe(false)
    expect(validateNoteInput({ startDay: "9.11.2026", endDay: "2026-11-09", text: "x" }).ok).toBe(false)
    expect(validateNoteInput({ startDay: "2026-01-01", endDay: "2027-01-02", text: "x" }).ok).toBe(false)
    expect(validateNoteInput({ startDay: "2026-11-09", endDay: "2026-11-09", text: "x".repeat(501) }).ok).toBe(false)
  })
})

describe("noteDayCount", () => {
  it("counts inclusive days across a month boundary", () => {
    expect(noteDayCount({ startDay: "2026-11-30", endDay: "2026-12-02" })).toBe(3)
  })
})

describe("layoutNotes", () => {
  it("puts a lone note in lane 0 with one lane", () => {
    const l = layoutNotes([note("a", "2026-11-09", "2026-11-11")], dates(9, 12))
    expect(l.byDate.get("2026-11-09")).toEqual([{ note: expect.objectContaining({ id: "a" }), lane: 0, part: "start" }])
    expect(l.byDate.get("2026-11-10")![0].part).toBe("mid")
    expect(l.byDate.get("2026-11-11")![0].part).toBe("end")
    expect(l.byDate.get("2026-11-12")).toEqual([])
    expect(l.laneCount.get("2026-11-10")).toBe(1)
    expect(l.laneCount.get("2026-11-12")).toBe(0)
  })

  it("gives overlapping notes separate lanes and keeps the lane count for the whole group", () => {
    const l = layoutNotes([note("b", "2026-11-12", "2026-11-14"), note("a", "2026-11-11", "2026-11-13")], dates(10, 15))
    expect(l.laneOf.get("a")).toBe(0)
    expect(l.laneOf.get("b")).toBe(1)
    // Group spans 11–14: two lanes even on days where only one note is present
    for (const d of ["2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14"]) expect(l.laneCount.get(d)).toBe(2)
    expect(l.laneCount.get("2026-11-10")).toBe(0)
    expect(l.byDate.get("2026-11-12")!.map(s => s.note.id)).toEqual(["a", "b"])
  })

  it("reuses a lane once a note has ended and puts longer notes first on the same start", () => {
    const l = layoutNotes([
      note("short", "2026-11-09", "2026-11-09"),
      note("long", "2026-11-09", "2026-11-12"),
      note("later", "2026-11-11", "2026-11-11"),
    ], dates(9, 12))
    expect(l.laneOf.get("long")).toBe(0)
    expect(l.laneOf.get("short")).toBe(1)
    expect(l.laneOf.get("later")).toBe(1)
    expect(l.byDate.get("2026-11-09")!.find(s => s.note.id === "short")!.part).toBe("single")
  })

  it("starts a new group after a gap", () => {
    const l = layoutNotes([note("a", "2026-11-09", "2026-11-10"), note("b", "2026-11-09", "2026-11-09"), note("c", "2026-11-12", "2026-11-12")], dates(9, 12))
    expect(l.laneCount.get("2026-11-10")).toBe(2)
    expect(l.laneCount.get("2026-11-12")).toBe(1)
    expect(l.laneOf.get("c")).toBe(0)
  })
})
