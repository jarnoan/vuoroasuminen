---
phase: 08-supabase-auth-stack
plan: "06"
subsystem: gcal
tags: [gcal, owner-model, refactor, config]
dependency_graph:
  requires: [08-01]
  provides: [GCAL-01, GCAL-02]
  affects: [src/config/app.ts, src/lib/gcal/client.ts, src/lib/gcal/sync.ts, scripts/generate-app-config.js]
tech_stack:
  added: []
  patterns: [owner-token-model, single-select-by-email, admin-drizzle-token-lookup]
key_files:
  created: []
  modified:
    - src/config/app.example.ts
    - scripts/generate-app-config.js
    - src/lib/gcal/client.ts
    - src/lib/gcal/sync.ts
decisions:
  - "ownerEmail required (not optional) in AppConfig to avoid defensive ?? reads in all consumers"
  - "Fallback to per-parent email when APP_CALENDAR_OWNER_EMAIL unset preserves legacy behavior"
  - "Single SELECT on user_google_tokens.email replaces accounts+users JOIN — no Auth.js dependency"
  - "app.ts is gitignored; app.example.ts updated to keep interface documentation in sync"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-10T05:50:57Z"
  tasks_completed: 4
  files_changed: 4
---

# Phase 08 Plan 06: GCal Owner-Token Model Summary

**One-liner:** Switch GCal sync from per-parent Auth.js accounts JOIN to single-table `user_google_tokens` lookup by `ownerEmail` — decoupling calendar sync from Auth.js entirely.

## What Was Built

Four files patched to implement the owner-token model (D-01): the calendar owner's refresh token is used regardless of which parent presses publish, achieved by adding `ownerEmail` to `AppConfig` and routing `buildGCalClient` through the `user_google_tokens` table.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add ownerEmail field to AppConfig | 5a32fad | src/config/app.example.ts (app.ts gitignored) |
| 2 | Update generate-app-config.js to emit ownerEmail | 8179863 | scripts/generate-app-config.js |
| 3 | Refactor buildGCalClient to read user_google_tokens | bc121f4 | src/lib/gcal/client.ts |
| 4 | Update sync.ts to pass parent.ownerEmail | 1353748 | src/lib/gcal/sync.ts |

## Key Changes

**AppConfig (`src/config/app.ts` / `app.example.ts`):**
- Added `ownerEmail: string` (required) to the `parents[]` interface
- Populated from `APP_CALENDAR_OWNER_EMAIL` env var; falls back to per-parent email when unset
- Non-breaking: existing local dev environments without `APP_CALENDAR_OWNER_EMAIL` behave identically to before

**generate-app-config.js:**
- `APP_CALENDAR_OWNER_EMAIL` added to `required` array
- Emitted TypeScript template gains `ownerEmail: string` in interface and both parent entries
- Smoke-tested: generator correctly writes `ownerEmail: "owner@x"` for both parents

**client.ts (`buildGCalClient`):**
- Parameter renamed `parentEmail` → `ownerEmail`
- DB lookup: replaced `accounts INNER JOIN users WHERE users.email = parentEmail AND accounts.provider = 'google'` with `SELECT refreshToken FROM user_google_tokens WHERE email = ownerEmail`
- Removed imports: `accounts`, `users` from `@/db/schema/auth`; `and` from `drizzle-orm`
- Added import: `userGoogleTokens` from `@/db/schema/tokens`
- Token exchange block, `setCredentials({ access_token, expiry_date })`, and `console.error` logs preserved verbatim

**sync.ts:**
- Single-line change: `buildGCalClient(parent.email)` → `buildGCalClient(parent.ownerEmail)`
- All other sync logic (retry/backoff, orphan cleanup, all-day event creation, Promise.allSettled isolation) unchanged

## Decisions Made

1. **`ownerEmail` required, not optional** — Plan 07 (dashboard banner) and sync.ts both read it directly; an optional field would force `??` guards everywhere.
2. **Fallback to per-parent email** — When `APP_CALENDAR_OWNER_EMAIL` is unset, each parent retains their own token (same as v1.0). Single-owner mode is opt-in via the env var.
3. **Single SELECT, no JOIN** — `user_google_tokens` has `email` as PK and only stores Google tokens; no `provider` filter needed, eliminating the `and()` import.
4. **app.example.ts updated alongside app.ts** — `app.ts` is gitignored (contains real emails); `app.example.ts` is the committed interface documentation and must match.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Documentation] Updated app.example.ts**
- **Found during:** Task 1
- **Issue:** `src/config/app.ts` is gitignored and cannot be committed; `app.example.ts` is the documented interface template and would be out of sync with the new `ownerEmail` field.
- **Fix:** Updated `app.example.ts` to include `ownerEmail: string` in both the interface and both parent entries, matching the hand-written `app.ts` content.
- **Files modified:** `src/config/app.example.ts`
- **Commit:** 5a32fad

No other deviations — all other plan instructions executed as written.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. The `user_google_tokens` table was already created in Plan 01. The `buildGCalClient` still reads via admin Drizzle (DATABASE_URL) as specified by D-11 — no new trust boundaries.

## Known Stubs

None. The `ownerEmail` field is wired end-to-end: `app.ts` config → `sync.ts` → `buildGCalClient` → `user_google_tokens` table lookup.

## Self-Check: PASSED

Verified:
- `src/config/app.example.ts` contains `ownerEmail: string` — FOUND
- `scripts/generate-app-config.js` contains `APP_CALENDAR_OWNER_EMAIL` (4 occurrences) — FOUND
- `src/lib/gcal/client.ts` imports `userGoogleTokens`, no `schema/auth` import — FOUND
- `src/lib/gcal/sync.ts` contains `buildGCalClient(parent.ownerEmail)` — FOUND
- Commits 5a32fad, 8179863, bc121f4, 1353748 — FOUND in git log
- `npx tsc --noEmit` — PASSED
