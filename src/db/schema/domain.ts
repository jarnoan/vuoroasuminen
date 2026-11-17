import { sql } from "drizzle-orm"
import { pgTable, pgEnum, pgPolicy, check, text, date, timestamp, uniqueIndex, index, integer } from "drizzle-orm/pg-core"
import { authenticatedRole } from "drizzle-orm/supabase"

// ROW LEVEL SECURITY
// Policies and CHECK constraints are declared here, not only in supabase/policies.sql:
// `drizzle-kit push` disables RLS and drops any policy or check constraint the schema
// does not declare. A table with a pgPolicy gets RLS enabled automatically; a new table
// with no policies still needs `.enableRLS()` (Supabase flags it otherwise).
// Server code connects as `postgres` and bypasses RLS; these policies guard the
// PostgREST / Realtime API, which anyone holding the public anon key can reach.
// Push compares policies by name, command and roles only, NOT their USING / WITH CHECK
// text: to change an expression, rename the policy so push drops and recreates it.
// public.is_family_member() and the table grants live in supabase/policies.sql
// (drizzle-kit does not manage functions or grants); see that file for when to run it.
const isFamilyMember = sql`is_family_member()`

// The two parents in family_config can read and write every row.
const familyMembersOnly = (table: string) =>
  pgPolicy(`family members can access ${table}`, {
    for: "all",
    to: authenticatedRole,
    using: isFamilyMember,
    withCheck: isFamilyMember,
  })

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
}, () => [
  familyMembersOnly("children"),
])

export const schedules = pgTable("schedules", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
}, () => [
  familyMembersOnly("schedules"),
])

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
  // Legacy per-day note (stored on one of the day's entries). Superseded by day_notes;
  // kept so existing data is not lost — see src/db/migrate-day-notes.ts.
  notes: text("notes"),
}, (table) => [
  uniqueIndex("schedule_entries_child_day_unique").on(table.childId, table.day),
  familyMembersOnly("schedule_entries"),
])

// day_notes: free-text notes shared by both parents. A note covers the inclusive range
// [start_day, end_day]; a single-day note has start_day = end_day. Notes are not part of
// the draft/publish flow and are not synced to Google Calendar.
export const dayNotes = pgTable("day_notes", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  startDay: date("start_day", { mode: "string" }).notNull(),
  endDay: date("end_day", { mode: "string" }).notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
}, (table) => [
  index("day_notes_range_idx").on(table.startDay, table.endDay),
  check("day_notes_valid_range", sql`${table.endDay} >= ${table.startDay}`),
  familyMembersOnly("day_notes"),
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
  familyMembersOnly("gcal_events"),
])

// family_config: single-row table replacing src/config/app.ts env vars (D-12).
// The parents can read it; writes happen only on the server.
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
}, (table) => [
  check("family_config_single_row", sql`${table.id} = 1`),
  pgPolicy("family members can read family_config", {
    for: "select",
    to: authenticatedRole,
    using: isFamilyMember,
  }),
])

// invite_tokens: users can read only the tokens they created; writes happen on the server.
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
}, (table) => [
  pgPolicy("user can select own invite tokens", {
    for: "select",
    to: authenticatedRole,
    using: sql`lower(auth.jwt() ->> 'email') = lower(${table.createdBy})`,
  }),
])
