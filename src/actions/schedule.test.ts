/**
 * Tests for the extendSchedule Server Action.
 *
 * Mocks:
 * - @/db — vi.mock to capture inserted rows without a live database
 * - @/auth — vi.mock to control session state
 *
 * All 8 test cases from the plan's <behavior> section are covered.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// --- Mock @/auth ---
vi.mock("@/auth", () => ({
  auth: vi.fn(),
}))

// --- Mock @/db ---
// Use a factory that creates stable mock functions (no top-level variable references)
vi.mock("@/db", () => {
  return {
    db: {
      insert: vi.fn(),
      select: vi.fn(),
    },
  }
})

// --- Mock next/headers (needed by "use server" module boundary) ---
vi.mock("next/headers", () => ({
  headers: () => new Headers(),
  cookies: () => ({ get: () => undefined }),
}))

// Import after mocks are declared
import { extendSchedule } from "./schedule"
import { auth } from "@/auth"
import { db } from "@/db"

const mockAuth = vi.mocked(auth)
const mockDb = vi.mocked(db)

// ─── Session helpers ────────────────────────────────────────────────────────

function setAuthorizedSession() {
  // "father@example.com" matches the example config used by vitest alias
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockAuth.mockResolvedValue({ user: { email: "father@example.com" } } as any)
}

function setNoSession() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockAuth.mockResolvedValue(null as any)
}

function setUnauthorizedSession() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockAuth.mockResolvedValue({ user: { email: "stranger@example.com" } } as any)
}

// ─── DB mock helpers ─────────────────────────────────────────────────────────
//
// db.select().from(children) → [{ id: "c1", name: "Child1" }, { id: "c2", name: "Child2" }]
//   (example config has children: ["Child1", "Child2"])
//
// db.insert(schedules).values({}).returning() → [{ id: "fake-schedule-id" }]
//
// db.insert(scheduleEntries).values([...]).onConflictDoNothing() → undefined
//
// We capture the array passed to scheduleEntries.values() for boundary assertions.

let capturedEntryValues: Array<{ day: string; childId: string; parentId: string; status: string; scheduleId: string }> | null = null
let insertCallCount = 0

function setupDbMocks() {
  capturedEntryValues = null
  insertCallCount = 0

  // db.select().from(children) → children list
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockDb.select.mockReturnValue({
    from: vi.fn().mockResolvedValue([
      { id: "c1", name: "Child1" },
      { id: "c2", name: "Child2" },
    ]),
  } as any)

  // db.insert() is called twice:
  //   1st call: schedules — returns { returning: () => [{ id }] }
  //   2nd call: scheduleEntries — captures values, returns { onConflictDoNothing: () => undefined }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockDb.insert.mockImplementation((): any => {
    insertCallCount++
    if (insertCallCount === 1) {
      // schedules insert
      return {
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "fake-schedule-id" }]),
        }),
      }
    } else {
      // scheduleEntries insert
      return {
        values: vi.fn((vals: typeof capturedEntryValues) => {
          capturedEntryValues = vals
          return {
            onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
          }
        }),
      }
    }
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  setupDbMocks()
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("extendSchedule", () => {
  // Test 1: successful week-count extension
  it("Test 1 — week-count mode: inserts 12*7*children entries and returns newStartDate", async () => {
    setAuthorizedSession()

    const result = await extendSchedule({
      scheduleEndDate: "2026-06-07", // Sunday
      weeks: 12,
    })

    expect(result).toEqual({ success: true, newStartDate: "2026-06-08" })
    expect(capturedEntryValues).not.toBeNull()

    const rows = capturedEntryValues!
    // 12 weeks × 7 days × 2 children = 168 rows
    expect(rows).toHaveLength(12 * 7 * 2)

    const days = [...new Set(rows.map(r => r.day))].sort()
    expect(days[0]).toBe("2026-06-08")
    expect(days[days.length - 1]).toBe("2026-08-30")
  })

  // Test 2: explicit end date extension
  it("Test 2 — end-date mode: inserts entries from scheduleEndDate+1 through endDate", async () => {
    setAuthorizedSession()

    const result = await extendSchedule({
      scheduleEndDate: "2026-06-07",
      endDate: "2026-08-30", // Sunday
    })

    expect(result).toEqual({ success: true, newStartDate: "2026-06-08" })
    expect(capturedEntryValues).not.toBeNull()

    const days = [...new Set(capturedEntryValues!.map(r => r.day))].sort()
    expect(days[0]).toBe("2026-06-08")
    expect(days[days.length - 1]).toBe("2026-08-30")
  })

  // Test 3: overlapping range (onConflictDoNothing — no error, no exception)
  it("Test 3 — calling again with same range returns success (onConflictDoNothing idempotency)", async () => {
    setAuthorizedSession()

    const r1 = await extendSchedule({ scheduleEndDate: "2026-06-07", weeks: 12 })
    expect(r1.success).toBe(true)

    setupDbMocks() // reset for second call
    setAuthorizedSession()

    const r2 = await extendSchedule({ scheduleEndDate: "2026-06-07", weeks: 12 })
    expect(r2.success).toBe(true)
    if (r2.success) expect(r2.newStartDate).toBe("2026-06-08")
  })

  // Test 4a: no session → throws "Not authenticated"
  it("Test 4a — throws 'Not authenticated' when no session", async () => {
    setNoSession()

    await expect(
      extendSchedule({ scheduleEndDate: "2026-06-07", weeks: 12 })
    ).rejects.toThrow("Not authenticated")
  })

  // Test 4b: non-parent email → throws "Forbidden"
  it("Test 4b — throws 'Forbidden' when caller is not a parent", async () => {
    setUnauthorizedSession()

    await expect(
      extendSchedule({ scheduleEndDate: "2026-06-07", weeks: 12 })
    ).rejects.toThrow("Forbidden")
  })

  // Test 5a: weeks = 0 → validation error mentioning weeks
  it("Test 5a — weeks = 0 returns { success: false, error } mentioning weeks", async () => {
    setAuthorizedSession()

    const result = await extendSchedule({ scheduleEndDate: "2026-06-07", weeks: 0 })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toMatch(/viikk/i)
    }
  })

  // Test 5b: weeks = 53 → validation error
  it("Test 5b — weeks = 53 returns { success: false, error } mentioning weeks", async () => {
    setAuthorizedSession()

    const result = await extendSchedule({ scheduleEndDate: "2026-06-07", weeks: 53 })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toMatch(/viikk/i)
    }
  })

  // Test 6: endDate > 730 days → validation error
  it("Test 6 — endDate more than 730 days after scheduleEndDate returns validation error", async () => {
    setAuthorizedSession()

    const result = await extendSchedule({
      scheduleEndDate: "2026-06-07",
      endDate: "2028-07-08", // 761 days ahead — exceeds 730
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.length).toBeGreaterThan(0)
    }
  })

  // Test 7a: malformed scheduleEndDate
  it("Test 7a — scheduleEndDate = 'not-a-date' returns validation error", async () => {
    setAuthorizedSession()

    const result = await extendSchedule({ scheduleEndDate: "not-a-date", weeks: 12 })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.length).toBeGreaterThan(0)
    }
  })

  // Test 7b: empty scheduleEndDate
  it("Test 7b — scheduleEndDate = '' returns validation error", async () => {
    setAuthorizedSession()

    const result = await extendSchedule({ scheduleEndDate: "", weeks: 12 })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.length).toBeGreaterThan(0)
    }
  })

  // Test 8: newStartDate is always the day after scheduleEndDate
  it("Test 8 — newStartDate = scheduleEndDate + 1 day in both week-count and end-date modes", async () => {
    setAuthorizedSession()
    const r1 = await extendSchedule({ scheduleEndDate: "2026-06-07", weeks: 4 })

    setupDbMocks()
    setAuthorizedSession()
    const r2 = await extendSchedule({ scheduleEndDate: "2026-06-07", endDate: "2026-07-05" })

    expect(r1.success).toBe(true)
    expect(r2.success).toBe(true)
    if (r1.success) expect(r1.newStartDate).toBe("2026-06-08")
    if (r2.success) expect(r2.newStartDate).toBe("2026-06-08")
  })
})
