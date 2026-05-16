import { describe, it, expect, vi, beforeEach } from "vitest"

const mockSelectChain = vi.fn()
vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => mockSelectChain(),
        }),
      }),
    }),
  },
}))

import { getAppConfig } from "./app"

beforeEach(() => { vi.clearAllMocks() })

describe("getAppConfig", () => {
  it("returns ownerEmail = parent1Email for both parents (D-07)", async () => {
    mockSelectChain.mockResolvedValue([{
      id: 1, parent1Id: "father", parent1Name: "A", parent1Email: "a@x.com",
      parent1CalendarId: "cal1", parent2Id: "mother", parent2Name: "B",
      parent2Email: "b@x.com", parent2CalendarId: "cal2",
      children: ["Kid"], startDate: "2026-01-05", firstParent: "father",
      createdAt: new Date(), updatedAt: new Date(),
    }])
    const cfg = await getAppConfig()
    expect(cfg.parents[0].ownerEmail).toBe("a@x.com")
    expect(cfg.parents[1].ownerEmail).toBe("a@x.com")
  })

  it("throws when no row exists", async () => {
    mockSelectChain.mockResolvedValue([])
    await expect(getAppConfig()).rejects.toThrow(/Family config not found/)
  })

  it("returns 2 parents with correct ids", async () => {
    mockSelectChain.mockResolvedValue([{
      id: 1, parent1Id: "father", parent1Name: "A", parent1Email: "a@x.com",
      parent1CalendarId: "c1", parent2Id: "mother", parent2Name: "B",
      parent2Email: "b@x.com", parent2CalendarId: "c2",
      children: ["X"], startDate: "2026-01-05", firstParent: "father",
      createdAt: new Date(), updatedAt: new Date(),
    }])
    const cfg = await getAppConfig()
    expect(cfg.parents).toHaveLength(2)
    expect(cfg.parents[0].id).toBe("father")
    expect(cfg.parents[1].id).toBe("mother")
  })

  it("passes children array through unchanged", async () => {
    mockSelectChain.mockResolvedValue([{
      id: 1, parent1Id: "father", parent1Name: "A", parent1Email: "a@x.com",
      parent1CalendarId: "c1", parent2Id: "mother", parent2Name: "B",
      parent2Email: "b@x.com", parent2CalendarId: "c2",
      children: ["Anna","Ben","Cara"], startDate: "2026-01-05", firstParent: "father",
      createdAt: new Date(), updatedAt: new Date(),
    }])
    const cfg = await getAppConfig()
    expect(cfg.children).toEqual(["Anna","Ben","Cara"])
  })

  it("returns startDate and firstParent verbatim", async () => {
    mockSelectChain.mockResolvedValue([{
      id: 1, parent1Id: "father", parent1Name: "A", parent1Email: "a@x.com",
      parent1CalendarId: "c1", parent2Id: "mother", parent2Name: "B",
      parent2Email: "b@x.com", parent2CalendarId: "c2",
      children: ["X"], startDate: "2026-06-01", firstParent: "mother",
      createdAt: new Date(), updatedAt: new Date(),
    }])
    const cfg = await getAppConfig()
    expect(cfg.startDate).toBe("2026-06-01")
    expect(cfg.firstParent).toBe("mother")
  })
})
