/**
 * Tests for saveWizardConfig and listCalendars Server Actions.
 * 9 test cases from the plan's <behavior> section.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// --- Mock @/lib/supabase/server ---
const mockGetUser = vi.fn()
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}))

// --- Mock @/db ---
// Use vi.mock factory with no top-level variable references (hoisting safe)
vi.mock("@/db", () => ({
  db: {
    insert: vi.fn(),
  },
}))

// --- Mock @/lib/gcal/client ---
const mockCalendarListList = vi.fn()
vi.mock("@/lib/gcal/client", () => ({
  buildGCalClient: vi.fn(),
}))

// --- Mock next/headers (needed by "use server" module boundary) ---
vi.mock("next/headers", () => ({
  headers: () => new Headers(),
  cookies: () => ({ get: () => undefined }),
}))

// Import after mocks are declared
import { saveWizardConfig, listCalendars } from "./setup"
import { db } from "@/db"
import { buildGCalClient } from "@/lib/gcal/client"

const mockDb = vi.mocked(db)
const mockBuildGCalClient = vi.mocked(buildGCalClient)

// ─── Capture helpers ──────────────────────────────────────────────────────────

let capturedConflictSet: Record<string, unknown> | null = null
let capturedInsertValues: Record<string, unknown> | null = null

function setupInsertMock() {
  capturedConflictSet = null
  capturedInsertValues = null
  mockDb.insert.mockImplementation((): unknown => ({
    values: vi.fn((v: Record<string, unknown>) => {
      capturedInsertValues = v
      return {
        onConflictDoUpdate: vi.fn((opts: { set: Record<string, unknown> }) => {
          capturedConflictSet = opts.set
          return Promise.resolve()
        }),
      }
    }),
  }))
}

// ─── Session helpers ──────────────────────────────────────────────────────────

function setAuthenticatedSession(email = "parent@example.com") {
  mockGetUser.mockResolvedValue({
    data: { user: { email } },
    error: null,
  })
}

function setNoSession() {
  mockGetUser.mockResolvedValue({
    data: { user: null },
    error: null,
  })
}

// ─── Valid wizard input ───────────────────────────────────────────────────────
// June 1, 2026 is a Monday — valid startDate
const validInput = {
  parent1Name: "Father",
  parent1Email: "father@example.com",
  parent1CalendarId: "cal1@group.calendar.google.com",
  parent2Name: "Mother",
  parent2Email: "mother@example.com",
  parent2CalendarId: "cal2@group.calendar.google.com",
  children: ["Kid1", "Kid2"],
  startDate: "2026-06-01",
  firstParent: "father" as const,
}

beforeEach(() => {
  vi.clearAllMocks()
  setupInsertMock()
})

// ─── saveWizardConfig tests ───────────────────────────────────────────────────

describe("saveWizardConfig", () => {
  it("Test 1: returns { success: false, error: 'Ei kirjautunut' } when no session", async () => {
    setNoSession()
    const result = await saveWizardConfig(validInput)
    expect(result).toEqual({ success: false, error: "Ei kirjautunut" })
    expect(mockDb.insert).not.toHaveBeenCalled()
  })

  it("Test 2: writes to family_config with onConflictDoUpdate and sets updatedAt", async () => {
    setAuthenticatedSession()
    const result = await saveWizardConfig(validInput)
    expect(result).toEqual({ success: true })
    expect(mockDb.insert).toHaveBeenCalled()
    expect(capturedInsertValues).not.toBeNull()
    const vals = capturedInsertValues!
    expect(vals.parent1Email).toBe("father@example.com")
    expect(vals.parent2Email).toBe("mother@example.com")
    expect(capturedConflictSet).not.toBeNull()
    const set = capturedConflictSet!
    expect(set.updatedAt).toBeInstanceOf(Date)
    expect(set.parent2Email).toBe("mother@example.com")
    expect(set.firstParent).toBe("father")
  })

  it("Test 3: rejects input where parent1Email === parent2Email", async () => {
    setAuthenticatedSession()
    const input = { ...validInput, parent2Email: validInput.parent1Email }
    const result = await saveWizardConfig(input)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.length).toBeGreaterThan(0)
    }
    expect(mockDb.insert).not.toHaveBeenCalled()
  })

  it("Test 4: rejects input where children array is empty", async () => {
    setAuthenticatedSession()
    const input = { ...validInput, children: [] }
    const result = await saveWizardConfig(input)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.length).toBeGreaterThan(0)
    }
    expect(mockDb.insert).not.toHaveBeenCalled()
  })

  it("Test 5: rejects input where startDate is not a Monday", async () => {
    setAuthenticatedSession()
    // 2026-06-02 is a Tuesday
    const input = { ...validInput, startDate: "2026-06-02" }
    const result = await saveWizardConfig(input)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toMatch(/maanantai/i)
    }
    expect(mockDb.insert).not.toHaveBeenCalled()
  })

  it("Test 6: rejects input where firstParent is not 'father' or 'mother'", async () => {
    setAuthenticatedSession()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const input = { ...validInput, firstParent: "unknown" as any }
    const result = await saveWizardConfig(input)
    expect(result.success).toBe(false)
    expect(mockDb.insert).not.toHaveBeenCalled()
  })
})

// ─── listCalendars tests ──────────────────────────────────────────────────────

describe("listCalendars", () => {
  it("Test 7: returns { success: false, error: 'Ei kirjautunut' } when no session", async () => {
    setNoSession()
    const result = await listCalendars()
    expect(result).toEqual({ success: false, error: "Ei kirjautunut" })
    expect(mockBuildGCalClient).not.toHaveBeenCalled()
  })

  it("Test 8: returns { success: true, calendars } with id and summary from calendarList.list", async () => {
    setAuthenticatedSession("parent@example.com")
    mockBuildGCalClient.mockResolvedValue({
      calendarList: { list: mockCalendarListList },
    } as never)
    mockCalendarListList.mockResolvedValue({
      data: {
        items: [
          { id: "cal1@group.calendar.google.com", summary: "Calendar One" },
          { id: "cal2@group.calendar.google.com", summary: "Calendar Two" },
        ],
      },
    })
    const result = await listCalendars()
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.calendars).toHaveLength(2)
      expect(result.calendars[0]).toEqual({ id: "cal1@group.calendar.google.com", summary: "Calendar One" })
      expect(result.calendars[1]).toEqual({ id: "cal2@group.calendar.google.com", summary: "Calendar Two" })
    }
  })

  it("Test 9: returns { success: false, error } when calendarList.list throws", async () => {
    setAuthenticatedSession("parent@example.com")
    mockBuildGCalClient.mockResolvedValue({
      calendarList: { list: mockCalendarListList },
    } as never)
    mockCalendarListList.mockRejectedValue(new Error("API quota exceeded"))
    const result = await listCalendars()
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain("API quota exceeded")
    }
  })
})
