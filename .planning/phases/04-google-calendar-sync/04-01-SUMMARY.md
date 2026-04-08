---
phase: 04-google-calendar-sync
plan: 04-01
title: Google Calendar Sync on Publish
subsystem: gcal-sync
tags: [googleapis, calendar-sync, publish, drizzle, server-actions]
status: complete

dependency_graph:
  requires: [Phase 03 publishDraft Server Action, accounts table with refresh_token, gcal_events mirror table]
  provides: [syncCalendarsAfterPublish, buildGCalClient, AppConfig.email/calendarId, gcal_events UNIQUE constraint]
  affects: [publishDraft return type extended with syncResult, gcal_events schema, AppConfig interface]

tech_stack:
  added: [googleapis@^171.4.0]
  patterns:
    - "Promise.allSettled for concurrent per-parent sync with isolated failure handling"
    - "Manual token exchange (refresh_token → access_token) via fetch to Google token endpoint"
    - "users JOIN accounts on userId, filter by users.email (providerAccountId is numeric sub, not email)"
    - "DATE-format all-day events with exclusive end date (addDays +1)"
    - "UNIQUE constraint at DB level for idempotency guard"

key_files:
  created:
    - src/lib/gcal/client.ts
    - src/lib/gcal/sync.ts
  modified:
    - src/config/app.ts
    - src/db/schema/domain.ts
    - src/actions/schedule.ts
    - package.json
    - package-lock.json

decisions:
  - "GCal sync is best-effort — failure does not roll back DB publish (D-05)"
  - "Token lookup joins users table on email; providerAccountId is Google numeric sub not email (D-03)"
  - "Manual token exchange to get fresh access_token before each sync (D-04)"
  - "All-day event end.date is EXCLUSIVE — always addDays(parseISO(entry.day), 1) (D-10)"
  - "Orphan detection: gcal_events row whose entry.parentId no longer matches this parent (D-08)"
  - "Event summary format: child name @ parent name, e.g. 'Emma @ Isä' (D-09)"
  - "AppConfig email/calendarId are placeholder values; deployer replaces before running (D-02)"

metrics:
  duration_minutes: 52
  completed_date: "2026-04-08"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 5
---

# Phase 04 Plan 01: Google Calendar Sync on Publish Summary

## One-liner

Google Calendar sync wired to publishDraft — idempotent all-day event creation and orphan deletion via googleapis, concurrent per-parent reconciliation with best-effort failure isolation.

## What Was Built

### Task 1 — Install googleapis and extend AppConfig (commit: 0fc4ded)

- Installed `googleapis@^171.4.0` via npm
- Extended `AppConfig` interface and config instance in `src/config/app.ts` to include `email` and `calendarId` per parent
- Placeholder values provided with inline comments — deployer replaces before running

### Task 2 — UNIQUE constraint on gcal_events and buildGCalClient (commit: 047c760)

- Added `uniqueIndex("gcal_events_entry_calendar_unique")` on `(schedule_entry_id, calendar_id)` to `gcal_events` table in `src/db/schema/domain.ts`
- Applied schema change via `drizzle-kit push`
- Created `src/lib/gcal/client.ts` with `buildGCalClient(parentEmail)`:
  - Looks up refresh_token by joining `users` → `accounts` on `userId`, filtering by `users.email` (accounts.providerAccountId is Google's numeric sub, not email)
  - Exchanges refresh_token for fresh access_token via manual fetch to Google token endpoint
  - Sets both access_token and expiry_date on OAuth2 client to avoid silent-failure trap

### Task 3 — sync.ts and publishDraft wiring (commit: be7d439)

- Created `src/lib/gcal/sync.ts` with `syncCalendarsAfterPublish()` and `SyncResult` interface:
  - Loads all published entries in the 12-week window
  - Loads existing gcal_events rows for those entries
  - Runs per-parent sync concurrently via `Promise.allSettled`
  - Per parent: deletes orphaned events (entries reassigned to other parent), creates missing events
  - 404/410 GCal errors on delete are swallowed (already deleted)
  - Event format: `{ summary: "Emma @ Isä", start: { date: "YYYY-MM-DD" }, end: { date: "YYYY-MM-DD+1" } }`
- Extended `publishDraft` in `src/actions/schedule.ts`:
  - Calls `syncCalendarsAfterPublish()` after DB update succeeds
  - GCal failure does not roll back DB publish — error logged, syncResult included in response
  - Return type extended with `syncResult: SyncResult | null`

## Verification

- `npx tsc --noEmit` — passed, 0 errors
- `npm run lint` (files in scope) — passed, 0 errors in new files
- `npm run build` — passed, Next.js production build succeeded

## Requirements Coverage

| Requirement | Status | How satisfied |
|-------------|--------|---------------|
| GCAL-01 | Complete | syncParentCalendar creates all-day events per child per day for custody parent |
| GCAL-02 | Complete | Orphan cleanup deletes GCal events and mirror rows when custody reassigns |
| GCAL-03 | Complete | UNIQUE constraint + syncedEntryIds set prevent duplicate event creation |
| GCAL-04 | Complete | parentEntries filter ensures each calendar only receives its parent's entries |
| GCAL-05 | Complete | Events use DATE format (not dateTime) — timezone-safe all-day |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

- `src/config/app.ts` — `email` and `calendarId` fields contain placeholder values (`father@example.com`, `mother@example.com`, `*-calendar-id@group.calendar.google.com`). This is **intentional by design** (per D-02, SETP-01): deployers replace these with real values before running. The sync code will throw a clear error if tokens are not found for the configured email. No future plan needed to resolve — this is the configured deployment model.

## Self-Check

Files exist:
- [x] src/lib/gcal/client.ts
- [x] src/lib/gcal/sync.ts
- [x] src/config/app.ts (modified)
- [x] src/db/schema/domain.ts (modified)
- [x] src/actions/schedule.ts (modified)

Commits exist:
- [x] 0fc4ded — Task 1
- [x] 047c760 — Task 2
- [x] be7d439 — Task 3
