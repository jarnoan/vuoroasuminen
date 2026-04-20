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
      email: "father@example.com",              // Replace with father's real Google account email
      calendarId: "YOUR_FATHER_CALENDAR_ID@group.calendar.google.com",  // Replace with father's calendar ID
    },
    {
      id: "mother",
      name: "Mother",
      email: "mother@example.com",              // Replace with mother's real Google account email
      calendarId: "YOUR_MOTHER_CALENDAR_ID@group.calendar.google.com",  // Replace with mother's calendar ID
    },
  ],
  children: ["Child1", "Child2"],
  startDate: "2026-01-05",  // First Monday of the alternating pattern
  firstParent: "father",
}

export default config
