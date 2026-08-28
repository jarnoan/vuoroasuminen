// Continuous row-zoom level for the schedule table — 0 is fully pinched-in (most compact,
// smallest rows) and 1 is the default comfortable size.
export const MIN_ZOOM = 0
export const MAX_ZOOM = 1
export const DEFAULT_ZOOM = 1
export const ZOOM_STEP = 0.2 // used by the +/- buttons; pinch itself is stepless

export function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
}

function lerp(min: number, max: number, t: number): number {
  return min + (max - min) * t
}

// CSS custom properties for row sizing, keyed by zoom level. Applied once on the schedule
// table's wrapper element; every row references them via var(...) in inline styles, so
// updating them — even via direct DOM mutation during a pinch gesture, bypassing React —
// instantly resizes every row without a re-render. That's what keeps a pinch smooth across
// a table with hundreds of cells.
export function computeZoomVars(zoom: number): Record<string, string> {
  const z = clampZoom(zoom)
  return {
    "--cell-min-h": `${lerp(18, 40, z)}px`,
    "--cell-font": `${lerp(10, 14, z)}px`,
    "--row-py": `${lerp(0, 4, z)}px`,
    "--date-py": `${lerp(0, 8, z)}px`,
    "--header-py": `${lerp(4, 8, z)}px`,
    "--week-pt": `${lerp(6, 12, z)}px`,
  }
}

const ZOOM_STORAGE_KEY = "vuoroasuminen-row-zoom"
// Row zoom is a per-device display preference, kept in localStorage rather than the URL or
// DB. The native "storage" event only fires in *other* tabs, so we dispatch this one
// ourselves whenever the value changes in this tab (button click or pinch gesture end).
const ZOOM_CHANGE_EVENT = "vuoroasuminen-row-zoom-change"

export function subscribeToRowZoom(callback: () => void) {
  window.addEventListener(ZOOM_CHANGE_EVENT, callback)
  window.addEventListener("storage", callback)
  return () => {
    window.removeEventListener(ZOOM_CHANGE_EVENT, callback)
    window.removeEventListener("storage", callback)
  }
}

export function getRowZoomSnapshot(): number {
  const raw = localStorage.getItem(ZOOM_STORAGE_KEY)
  const n = raw === null ? NaN : Number(raw)
  return Number.isFinite(n) ? clampZoom(n) : DEFAULT_ZOOM
}

export function getRowZoomServerSnapshot(): number {
  return DEFAULT_ZOOM
}

export function setRowZoom(value: number) {
  localStorage.setItem(ZOOM_STORAGE_KEY, String(clampZoom(value)))
  window.dispatchEvent(new Event(ZOOM_CHANGE_EVENT))
}
