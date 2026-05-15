export type ParentId = "father" | "mother"

export interface AppConfig {
  parents: Array<{
    id: ParentId
    name: string
    email: string       // Google account email — used to look up tokens in accounts table (per D-01)
    calendarId: string  // Target Google Calendar ID — placeholder, deployer must replace (per D-02)
    ownerEmail: string  // Email of the user whose user_google_tokens row provides the GCal token for this calendar (Phase 8 D-01)
  }>
  children: string[]
  startDate: string    // ISO date string: first Monday of the alternating pattern
  firstParent: ParentId
}

const config: AppConfig = {
  parents: [
    {
      id: "father",
      name: process.env.PARENT_FATHER_NAME ?? "Father",
      email: process.env.PARENT_FATHER_EMAIL!,
      calendarId: process.env.PARENT_FATHER_CALENDAR_ID!,
      ownerEmail: process.env.APP_CALENDAR_OWNER_EMAIL ?? process.env.PARENT_FATHER_EMAIL!,
    },
    {
      id: "mother",
      name: process.env.PARENT_MOTHER_NAME ?? "Mother",
      email: process.env.PARENT_MOTHER_EMAIL!,
      calendarId: process.env.PARENT_MOTHER_CALENDAR_ID!,
      ownerEmail: process.env.APP_CALENDAR_OWNER_EMAIL ?? process.env.PARENT_MOTHER_EMAIL!,
    },
  ],
  children: (process.env.APP_CHILDREN ?? "").split(",").map(s => s.trim()).filter(Boolean),
  startDate: process.env.APP_START_DATE!,
  firstParent: (process.env.APP_FIRST_PARENT ?? "father") as ParentId,
}

export default config
