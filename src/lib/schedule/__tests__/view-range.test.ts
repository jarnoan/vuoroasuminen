import { describe, expect, it } from "vitest"
import { shiftViewRange } from "../view-range"

describe("shiftViewRange", () => {
  it("moves a 12-week range forward by 12 weeks", () => {
    expect(shiftViewRange("2026-11-16", "2027-02-07", 1)).toEqual({
      viewStart: "2027-02-08",
      viewEnd: "2027-05-02",
    })
  })

  it("moves a range backward by its length", () => {
    expect(shiftViewRange("2026-11-02", "2026-11-15", -1)).toEqual({
      viewStart: "2026-10-19",
      viewEnd: "2026-11-01",
    })
  })

  it("rounds a partial-week length up to full weeks", () => {
    // 10 days → shifted by 14, keeping Monday start
    expect(shiftViewRange("2026-11-02", "2026-11-11", 1)).toEqual({
      viewStart: "2026-11-16",
      viewEnd: "2026-11-25",
    })
  })
})
