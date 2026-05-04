import { describe, it, expect, vi, afterEach } from "vitest"
import { format } from "date-fns"

// Mock config dependency so tests run without real DB/config
vi.mock("@/config/app", () => ({
  default: {
    startDate: "2024-01-01",
    firstParent: "father",
    children: ["Emma", "Olivia"],
    parents: [
      { id: "father", name: "Isä", email: "father@example.com", calendarId: "cal1" },
      { id: "mother", name: "Äiti", email: "mother@example.com", calendarId: "cal2" },
    ],
  },
}))

import { getWindowBounds } from "../generate-default"

function toLocalDateStr(d: Date): string {
  return format(d, "yyyy-MM-dd")
}

describe("getWindowBounds", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  describe("when called with no argument (default behavior)", () => {
    it("returns Monday of current week as start", () => {
      // Fix today to a known Wednesday (2026-04-29)
      vi.useFakeTimers()
      vi.setSystemTime(new Date("2026-04-29T12:00:00Z"))

      const { start } = getWindowBounds()
      // Monday of 2026-04-29's week is 2026-04-27
      expect(toLocalDateStr(start)).toBe("2026-04-27")
    })

    it("returns end date 83 days after start (84-day window)", () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date("2026-04-29T12:00:00Z"))

      const { start, end } = getWindowBounds()
      const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      expect(diffDays).toBe(83) // 84 days inclusive = 83-day diff
    })
  })

  describe("when called with a specific startDate string", () => {
    it("uses the provided date as start (Monday passed directly)", () => {
      const { start } = getWindowBounds("2026-04-28")
      expect(toLocalDateStr(start)).toBe("2026-04-28")
    })

    it("uses Wednesday when passed directly (caller snapped, function trusts value)", () => {
      const { start } = getWindowBounds("2026-04-29")
      expect(toLocalDateStr(start)).toBe("2026-04-29")
    })

    it("returns end date 83 days after the provided startDate", () => {
      const { start, end } = getWindowBounds("2026-04-28")
      const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      expect(diffDays).toBe(83)
    })

    it("ignores today and uses the provided date, even when today is different", () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date("2026-01-01T12:00:00Z"))

      const { start } = getWindowBounds("2026-04-28")
      expect(toLocalDateStr(start)).toBe("2026-04-28")
    })
  })
})
