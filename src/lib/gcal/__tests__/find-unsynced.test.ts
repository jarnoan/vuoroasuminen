import { describe, it, expect, vi } from "vitest"

vi.mock("@/db", () => ({ db: {} }))
vi.mock("@/lib/gcal/client", () => ({ buildGCalClient: vi.fn() }))
vi.mock("@/config/app", () => ({ getAppConfig: vi.fn() }))

import { findUnsyncedEntryIds } from "@/lib/gcal/sync"

const parents = [
  { id: "father", calendarId: "cal-f" },
  { id: "mother", calendarId: "cal-m" },
]

describe("findUnsyncedEntryIds", () => {
  it("treats an entry with a row in its parent's calendar as synced", () => {
    expect(
      findUnsyncedEntryIds([{ id: "e1", parentId: "father" }], [{ scheduleEntryId: "e1", calendarId: "cal-f" }], parents)
    ).toEqual([])
  })

  it("flags an entry missing from its parent's calendar (create failed)", () => {
    expect(findUnsyncedEntryIds([{ id: "e1", parentId: "father" }], [], parents)).toEqual(["e1"])
  })

  it("flags an entry still present in the other parent's calendar (orphan delete failed)", () => {
    expect(
      findUnsyncedEntryIds(
        [{ id: "e1", parentId: "mother" }],
        [
          { scheduleEntryId: "e1", calendarId: "cal-m" },
          { scheduleEntryId: "e1", calendarId: "cal-f" },
        ],
        parents,
      )
    ).toEqual(["e1"])
  })

  it("flags a cleared entry that still has a calendar event", () => {
    expect(
      findUnsyncedEntryIds([{ id: "e1", parentId: null }], [{ scheduleEntryId: "e1", calendarId: "cal-f" }], parents)
    ).toEqual(["e1"])
    expect(findUnsyncedEntryIds([{ id: "e2", parentId: null }], [], parents)).toEqual([])
  })

  it("ignores rows for calendars not belonging to configured parents", () => {
    expect(
      findUnsyncedEntryIds(
        [{ id: "e1", parentId: "father" }],
        [
          { scheduleEntryId: "e1", calendarId: "cal-f" },
          { scheduleEntryId: "e1", calendarId: "old-cal" },
        ],
        parents,
      )
    ).toEqual([])
  })
})
