// Row density levels for the schedule table's "zoom out" control — 0 is the default
// comfortable size, higher numbers pack more rows into the same viewport height.
export type Density = 0 | 1 | 2

export const MAX_DENSITY: Density = 2

export const CELL_BUTTON_CLASS: Record<Density, string> = {
  0: "min-h-[40px] text-sm",
  1: "min-h-[26px] text-xs",
  2: "min-h-[18px] text-[10px] leading-tight",
}

export const DATE_CELL_PADDING_CLASS: Record<Density, string> = {
  0: "py-2",
  1: "py-0.5",
  2: "py-0",
}

export const DATA_CELL_PADDING_CLASS: Record<Density, string> = {
  0: "px-1 py-1",
  1: "px-1 py-0.5",
  2: "px-1 py-0",
}

export const HEADER_PADDING_CLASS: Record<Density, string> = {
  0: "py-2",
  1: "py-1",
  2: "py-0.5",
}

export const WEEK_SEPARATOR_PADDING_CLASS: Record<Density, string> = {
  0: "pt-3 pb-1",
  1: "pt-1.5 pb-1",
  2: "pt-1 pb-0.5",
}

export function parseDensity(raw: string | null): Density {
  const n = Number(raw)
  if (n === 1) return 1
  if (n === 2) return 2
  return 0
}
