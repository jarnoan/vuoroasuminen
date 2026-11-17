// The displayed date range is a per-device preference. It is kept in a cookie (not
// localStorage) so the dashboard's server render can read it and render the saved range
// straight away, with no flash of the default window. Only explicitly chosen bounds are
// stored; the default window (no bounds) clears the cookie. Whatever is read back is
// re-validated by validateViewStart/validateViewEnd, so a stale or tampered value is harmless.
export const VIEW_RANGE_COOKIE = "vuoroasuminen-view-range"
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365

export interface ViewRange {
  viewStart?: string
  viewEnd?: string
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function asDate(value: unknown): string | undefined {
  return typeof value === "string" && ISO_DATE.test(value) ? value : undefined
}

// Accepts the raw cookie value: "<start>_<end>", either part may be empty.
export function parseViewRange(raw: string | undefined): ViewRange {
  if (!raw) return {}
  const [start, end] = raw.split("_")
  return { viewStart: asDate(start), viewEnd: asDate(end) }
}

// Client-only: called after a range has loaded.
export function saveViewRange(range: ViewRange) {
  try {
    if (range.viewStart || range.viewEnd) {
      const value = `${range.viewStart ?? ""}_${range.viewEnd ?? ""}`
      document.cookie = `${VIEW_RANGE_COOKIE}=${value}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax`
    } else {
      document.cookie = `${VIEW_RANGE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
    }
  } catch {
    // Cookies unavailable — the range just isn't remembered.
  }
}
