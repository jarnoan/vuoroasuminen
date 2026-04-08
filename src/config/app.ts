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
      name: "Isä",
      email: "father@example.com",              // Replace with real Google account email
      calendarId: "father-calendar-id@group.calendar.google.com",  // Replace with real calendar ID
    },
    {
      id: "mother",
      name: "Äiti",
      email: "mother@example.com",              // Replace with real Google account email
      calendarId: "mother-calendar-id@group.calendar.google.com",  // Replace with real calendar ID
    },
  ],
  children: ["Emma", "Olivia"],
  startDate: "2026-01-05",
  firstParent: "father",
}

export default config
