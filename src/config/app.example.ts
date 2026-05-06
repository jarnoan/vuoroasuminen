export type ParentId = "father" | "mother"

export interface AppConfig {
  parents: Array<{
    id: ParentId
    name: string
    email: string       // Google account email — used to look up tokens in accounts table (per D-01)
    calendarId: string  // Target Google Calendar ID — placeholder, deployer must replace (per D-02)
  }>
  children: string[]
  startDate: string    // ISO date string: first Monday of the alternating pattern
  firstParent: ParentId
}

const config: AppConfig = {
  parents: [
    {
      id: "father",
      name: "Father",
      email: process.env.PARENT_FATHER_EMAIL!,
      calendarId: process.env.PARENT_FATHER_CALENDAR_ID!,
    },
    {
      id: "mother",
      name: "Mother",
      email: process.env.PARENT_MOTHER_EMAIL!,
      calendarId: process.env.PARENT_MOTHER_CALENDAR_ID!,
    },
  ],
  children: ["Child1", "Child2"],
  startDate: "2026-01-05",  // First Monday of the alternating pattern
  firstParent: "father",
}

export default config
