# Phase 4: Google Calendar Sync - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

On publish, write all-day events to each parent's Google Calendar — one event per child per published day, in the calendar belonging to the parent whose custody it is. Remove stale events from a parent's calendar when custody reassigns to the other parent. Re-publishing the same plan must not create duplicate events (idempotent). Phase 4 has zero UI changes: the Publish button and flow are already in place from Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Config Extension (Required)
- **D-01:** `AppConfig.parents` must add two new fields per parent: `email: string` (Google account email — used to look up tokens by joining `users.email → accounts.userId`; note: `accounts.providerAccountId` stores Google's numeric sub ID, NOT the email) and `calendarId: string` (target Google Calendar — can be the primary calendar ID or a dedicated custody calendar). These are non-secret — put in `src/config/app.ts`.
- **D-02:** `calendarId` values for the two parents in `app.ts` should be set to placeholder strings (e.g. `"father-calendar-id@group.calendar.google.com"`) that deployers replace before running. Do NOT use env vars for these — the SETP-01 requirement explicitly puts this in the config file.

### Token Retrieval Strategy
- **D-03:** Auth.js v5 JWT strategy does NOT persist refreshed tokens back to the `accounts` table — the table holds only the initial tokens from sign-in. For server-side GCal calls, retrieve `refresh_token` from the `accounts` table by joining through the `users` table: `db.select().from(accounts).innerJoin(users, eq(accounts.userId, users.id)).where(and(eq(users.email, parentEmail), eq(accounts.provider, "google")))`. NOTE: `accounts.providerAccountId` stores Google's numeric `sub` claim (not the email address) — do NOT query by providerAccountId. Then call Google's token endpoint directly to get a fresh `access_token`. Do NOT rely on JWT access_token from session — it is in-memory only.
- **D-04:** Do NOT expose `access_token` via the session callback in `auth.ts`. Server Actions should retrieve tokens directly from the DB via Drizzle, not from the session cookie.
- **D-05:** Rate-limit and partial-failure handling: wrap each parent's sync in try/catch. A GCal sync failure for one parent must not prevent the other parent's sync from running, and must not roll back the already-committed database publish. Log the error and return it in the action result — the schedule is the source of truth.

### Idempotency via `gcal_events` Mirror Table
- **D-06:** The `gcal_events` table (already in schema from Phase 1) is the idempotency key: `(scheduleEntryId, calendarId)` uniquely identifies whether a GCal event has been created. Before creating an event, check this table. If a row exists, skip creation.
- **D-07:** Add a `UNIQUE` constraint on `(schedule_entry_id, calendar_id)` in the `gcal_events` table via a new Drizzle migration to make the idempotency guarantee database-enforced, not just logic-enforced.
- **D-08:** Orphan detection: a `gcal_events` row is orphaned when the corresponding `schedule_entries.parentId` no longer matches the parent whose `calendarId` is in `gcal_events.calendarId`. On publish, query all `gcal_events` rows for entries in the window, identify orphans, delete them from Google Calendar, then delete them from `gcal_events`.

### Event Format
- **D-09:** Event title: `"{childName} @ {parent.name}"` — e.g. "Emma @ Isä" or "Olivia @ Äiti". Use the display name from config.
- **D-10:** All-day event: `start: { date: "YYYY-MM-DD" }`, `end: { date: "YYYY-MM-DD+1" }` — Google Calendar API uses **exclusive** end dates. For a single day "2026-04-08", use `start: { date: "2026-04-08" }`, `end: { date: "2026-04-09" }`. Use `format(addDays(parseISO(entry.day), 1), "yyyy-MM-dd")` for the end date.
- **D-11:** Publish writes ONLY the entries being published in the current call (entries with `status = 'published'` in the window). The `sync.ts` function operates on the full window of published entries — it is a full reconciliation, not an incremental diff.

### Scope of Sync
- **D-12:** Sync scope is the same 84-day window as `publishDraft`: `getWindowBounds()` from `src/lib/schedule/generate-default.ts`. Do not sync events outside this window.
- **D-13:** Only `published` entries trigger GCal events. Draft entries do not create calendar events. DRFT-01 is already enforced.

### Module Structure
- **D-14:** New module `src/lib/gcal/` with two files:
  - `client.ts` — `buildGCalClient(parentEmail: string): Promise<calendar_v3.Calendar>` — retrieves refresh_token from DB, exchanges for access_token, returns authenticated googleapis calendar client
  - `sync.ts` — `syncCalendarsAfterPublish(): Promise<SyncResult>` — orchestrates full-window reconciliation for all parents
- **D-15:** `publishDraft` Server Action in `src/actions/schedule.ts` calls `syncCalendarsAfterPublish()` after the DB publish succeeds. Returns `{ success: true, count: N, syncResult }`.

### Claude's Discretion
- Whether to batch GCal API calls or serialize per-parent (serialize is simpler, batch is faster — Claude can choose)
- Whether `syncCalendarsAfterPublish` runs both parents' syncs concurrently (`Promise.all`) or sequentially (concurrent is fine, errors are isolated per parent)
- Exact error message format in the action return value when GCal sync partially fails

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Requirements
- `.planning/REQUIREMENTS.md` — Phase 4 covers: GCAL-01, GCAL-02, GCAL-03, GCAL-04, GCAL-05
- `.planning/ROADMAP.md` — Phase 4 success criteria
- `CLAUDE.md` — Stack: `googleapis` 171.x, Node 18+, TypeScript 5.x

### Existing Code (agents must read before planning)
- `src/config/app.ts` — `AppConfig` type and instance — needs `email` and `calendarId` per parent
- `src/db/schema/domain.ts` — `gcalEvents` table (already exists), `scheduleEntries` with `day`, `parentId`, `status`, `childId`
- `src/db/schema/auth.ts` — `accounts` table with `refresh_token`, `access_token`, `providerAccountId`
- `src/actions/schedule.ts` — `publishDraft` Server Action — extend this to call GCal sync
- `src/lib/schedule/generate-default.ts` — `getWindowBounds()` — use this for sync scope
- `src/auth.ts` — JWT/refresh logic (reference only — do NOT change for Phase 4)

### External APIs
- Google Calendar API v3 via `googleapis` npm package (NOT yet installed — `npm install googleapis` required as first task)
- Token exchange endpoint: `https://oauth2.googleapis.com/token` (same pattern as `auth.ts` jwt callback)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Patterns
- Token refresh pattern is already in `src/auth.ts` (jwt callback, lines 31-47) — replicate for server-side use in `client.ts`
- `db.select().from(accounts).where(eq(accounts.providerAccountId, email))` — query pattern for token retrieval
- `getWindowBounds()` + `format(date, "yyyy-MM-dd")` — use for sync scope and event date strings
- Error handling pattern: try/catch per operation, return `{ success: false, error: string }` — established in Phase 3

### gcal_events Table Shape
```ts
gcalEvents: {
  id: string (uuid)
  scheduleEntryId: string → schedule_entries.id (cascade delete)
  googleEventId: string
  calendarId: string
  syncedAt: Date
}
```
No UNIQUE constraint exists yet — add one via Drizzle migration as part of this phase.

### Key Integration Point
`publishDraft()` in `src/actions/schedule.ts` is the single integration point. After the `db.update` succeeds, call `syncCalendarsAfterPublish()`. The action's return type needs to include sync status.

### Config Shape to Add
```ts
parents: Array<{
  id: ParentId
  name: string
  email: string        // Google account email — used to look up tokens in accounts table
  calendarId: string   // Target Google Calendar ID
}>
```

</code_context>

<specifics>
## Specific Implementation Notes

### googleapis OAuth2 client pattern
```ts
import { google } from "googleapis"

const oauth2Client = new google.auth.OAuth2(
  process.env.AUTH_GOOGLE_ID,
  process.env.AUTH_GOOGLE_SECRET,
)
oauth2Client.setCredentials({ access_token: freshAccessToken })
const calendar = google.calendar({ version: "v3", auth: oauth2Client })
```

### All-day event insert
```ts
await calendar.events.insert({
  calendarId: parent.calendarId,
  requestBody: {
    summary: `${childName} @ ${parentName}`,
    start: { date: entry.day },  // "YYYY-MM-DD"
    end: { date: entry.day },
  }
})
```

### Idempotency check before insert
```ts
const existing = await db.select()
  .from(gcalEvents)
  .where(and(
    eq(gcalEvents.scheduleEntryId, entry.id),
    eq(gcalEvents.calendarId, parent.calendarId)
  ))
if (existing.length > 0) continue  // already synced
```

### Orphan cleanup
```ts
// Find gcal_events rows where the entry's current parentId no longer belongs to this calendar
const orphans = await db.select(...)
  .from(gcalEvents)
  .innerJoin(scheduleEntries, eq(gcalEvents.scheduleEntryId, scheduleEntries.id))
  .where(
    and(
      inArray(scheduleEntries.id, publishedEntryIds),
      ne(scheduleEntries.parentId, parentIdForCalendar)  // mismatch = orphan
    )
  )
// For each orphan: calendar.events.delete(...), db.delete from gcal_events
```

</specifics>

<deferred>
## Deferred

- Per-calendar error recovery / retry — the publish is still committed even if GCal fails; parents can manually trigger re-sync in a future phase
- Rate limiting (Google Calendar API allows 1M queries/day for individual accounts — not a concern for a 2-parent app with 84 events max)
- Support for re-sync without republishing (a "Sync now" button) — v2
- Revocation detection (access revoked by parent) — log the error, don't crash

</deferred>

---

*Phase: 04-google-calendar-sync*
*Context gathered: 2026-04-08*
