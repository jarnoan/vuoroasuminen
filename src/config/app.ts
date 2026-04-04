export type ParentId = "father" | "mother"

export interface AppConfig {
  parents: Array<{ id: ParentId; name: string }>
  children: string[]
  startDate: string // ISO date string: first Monday of the alternating pattern
  firstParent: ParentId // which parent starts week 1
}

const config: AppConfig = {
  parents: [
    { id: "father", name: "Isä" },
    { id: "mother", name: "Äiti" },
  ],
  children: ["Emma", "Olivia"],
  startDate: "2026-01-05",
  firstParent: "father",
}

export default config
