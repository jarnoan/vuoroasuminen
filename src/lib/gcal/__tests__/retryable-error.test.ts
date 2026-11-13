import { describe, it, expect, vi } from "vitest"

vi.mock("@/db", () => ({ db: {} }))
vi.mock("@/lib/gcal/client", () => ({ buildGCalClient: vi.fn() }))
vi.mock("@/config/app", () => ({ getAppConfig: vi.fn() }))

import { isRetryableGCalError } from "@/lib/gcal/sync"

function gaxiosLike(status: number, reason?: string) {
  return {
    status,
    response: { status, data: { error: { errors: reason ? [{ reason, domain: "usageLimits" }] : [] } } },
  }
}

describe("isRetryableGCalError", () => {
  it("retries Calendar's 403 rateLimitExceeded", () => {
    expect(isRetryableGCalError(gaxiosLike(403, "rateLimitExceeded"))).toBe(true)
    expect(isRetryableGCalError(gaxiosLike(403, "userRateLimitExceeded"))).toBe(true)
  })

  it("retries 429 and 503", () => {
    expect(isRetryableGCalError(gaxiosLike(429))).toBe(true)
    expect(isRetryableGCalError(gaxiosLike(503))).toBe(true)
    expect(isRetryableGCalError({ code: 429 })).toBe(true)
  })

  it("does not retry plain 403 forbidden or daily quotaExceeded", () => {
    expect(isRetryableGCalError(gaxiosLike(403, "forbidden"))).toBe(false)
    expect(isRetryableGCalError(gaxiosLike(403, "quotaExceeded"))).toBe(false)
  })

  it("does not retry non-HTTP errors", () => {
    expect(isRetryableGCalError(new Error("boom"))).toBe(false)
    expect(isRetryableGCalError(null)).toBe(false)
  })
})
