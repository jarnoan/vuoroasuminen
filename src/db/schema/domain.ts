import { pgTable, pgEnum, text, date, timestamp, uniqueIndex, integer } from "drizzle-orm/pg-core"

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
  parentId: text("parent_id"), // 'father' | 'mother' | null (null = cleared / unassigned)
  status: scheduleStatusEnum("status").notNull().default("draft"),
  notes: text("notes"),
}, (table) => [
  uniqueIndex("schedule_entries_child_day_unique").on(table.childId, table.day),
])

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
}, (table) => [
  uniqueIndex("gcal_events_entry_calendar_unique").on(
    table.scheduleEntryId,
    table.calendarId
  ),
])

// family_config: single-row table replacing src/config/app.ts env vars (D-12).
// CHECK (id = 1) constraint enforced at DB level via raw SQL — Drizzle Kit does
// not generate check constraints from schema (added in Task 3 supabase/policies.sql).
export const familyConfig = pgTable("family_config", {
  id: integer("id").primaryKey().default(1),
  parent1Id: text("parent1_id").notNull(),
  parent1Name: text("parent1_name").notNull(),
  parent1Email: text("parent1_email").notNull(),
  parent1CalendarId: text("parent1_calendar_id").notNull(),
  parent2Id: text("parent2_id").notNull(),
  parent2Name: text("parent2_name").notNull(),
  parent2Email: text("parent2_email").notNull(),
  parent2CalendarId: text("parent2_calendar_id").notNull(),
  children: text("children").array().notNull(),
  startDate: date("start_date", { mode: "string" }).notNull(),
  firstParent: text("first_parent").notNull().default("father"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
})

// invite_tokens: created in Phase 12 to avoid a breaking schema change in Phase 13.
// No application logic uses it in Phase 12 (D-13).
export const inviteTokens = pgTable("invite_tokens", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  token: text("token").notNull().unique(),
  createdBy: text("created_by").notNull(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  usedAt: timestamp("used_at", { mode: "date" }),
  usedBy: text("used_by"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
})
