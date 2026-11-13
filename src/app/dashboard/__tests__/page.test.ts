/**
 * Tests for the view-range validation used by getScheduleView (dashboard range picker).
 */
import { describe, it, expect } from "vitest"
import { validateViewStart } from "@/lib/schedule/view-range"

describe("validateViewStart", () => {
  it("returns undefined when raw is undefined", () => {
    expect(validateViewStart(undefined)).toBeUndefined()
  })

  it("returns undefined when raw is empty string", () => {
    expect(validateViewStart("")).toBeUndefined()
  })

  it("returns undefined for non-ISO string", () => {
    expect(validateViewStart("not-a-date")).toBeUndefined()
  })

  it("returns undefined for partial date string", () => {
    expect(validateViewStart("2026-13-01")).toBeUndefined()
  })

  it("returns Monday string for a Monday input (no snap needed)", () => {
    // 2026-04-27 is a Monday
    const result = validateViewStart("2026-04-27")
    expect(result).toBe("2026-04-27")
  })

  it("snaps Wednesday to the Monday of that week", () => {
    // 2026-04-29 is a Wednesday → snaps to 2026-04-27 (Monday)
    const result = validateViewStart("2026-04-29")
    expect(result).toBe("2026-04-27")
  })

  it("snaps Sunday to the Monday of that week (weekStartsOn: 1)", () => {
    // 2026-05-03 is a Sunday → snaps to 2026-04-27 (Monday, same ISO week)
    const result = validateViewStart("2026-05-03")
    expect(result).toBe("2026-04-27")
  })

  it("snaps Saturday to the Monday of that week", () => {
    // 2026-05-02 is a Saturday → snaps to 2026-04-27 (Monday)
    const result = validateViewStart("2026-05-02")
    expect(result).toBe("2026-04-27")
  })

  it("returns valid Monday string for future date", () => {
    // 2026-07-06 is a Monday
    const result = validateViewStart("2026-07-06")
    expect(result).toBe("2026-07-06")
  })

  it("returns valid Monday string for past date", () => {
    // 2024-01-01 is a Monday
    const result = validateViewStart("2024-01-01")
    expect(result).toBe("2024-01-01")
  })
})
