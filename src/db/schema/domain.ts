import { pgTable, pgEnum, text, date, timestamp } from "drizzle-orm/pg-core"

// CRITICAL: Export the enum — drizzle-kit generate silently omits unexported enums
export const scheduleStatusEnum = pgEnum("schedule_status", [
  "draft",
  "published",
])

export const children = pgTable("children", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
})

export const schedules = pgTable("schedules", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
})

export const scheduleEntries = pgTable("schedule_entries", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  scheduleId: text("schedule_id")
    .notNull()
    .references(() => schedules.id, { onDelete: "cascade" }),
  childId: text("child_id")
    .notNull()
    .references(() => children.id),
  day: date("day", { mode: "string" }).notNull(), // DATE not TIMESTAMP — timezone-safe
  parentId: text("parent_id").notNull(), // 'father' | 'mother' (from config)
  status: scheduleStatusEnum("status").notNull().default("draft"),
  notes: text("notes"),
})

export const gcalEvents = pgTable("gcal_events", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  scheduleEntryId: text("schedule_entry_id")
    .notNull()
    .references(() => scheduleEntries.id, { onDelete: "cascade" }),
  googleEventId: text("google_event_id").notNull(),
  calendarId: text("calendar_id").notNull(),
  syncedAt: timestamp("synced_at", { mode: "date" }).notNull().defaultNow(),
})
