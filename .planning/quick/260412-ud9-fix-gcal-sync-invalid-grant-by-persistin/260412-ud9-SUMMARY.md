---
phase: quick
plan: 260412-ud9
subsystem: auth
tags: [gcal-sync, token-refresh, auth, drizzle]
dependency_graph:
  requires: [src/auth.ts, src/db/schema/auth.ts]
  provides: [src/db/clear-tokens.ts, token-persistence-loop]
  affects: [gcal-sync]
tech_stack:
  added: []
  patterns: [fire-and-forget db update in JWT callback]
key_files:
  created:
    - src/db/clear-tokens.ts
  modified:
    - src/auth.ts
    - package.json
decisions:
  - JWT callback persists refreshed tokens fire-and-forget to avoid blocking the callback return
  - db:clear-tokens wipes accounts table forcing fresh token issuance on next sign-in
metrics:
  duration: ~5 min
  completed: 2026-04-12
---

# Quick Task 260412-ud9: Fix GCal sync invalid_grant by persisting refreshed tokens to DB

**One-liner:** JWT refresh callback now fire-and-forgets a DB write to keep the accounts table in sync with the JWT cookie, eliminating invalid_grant errors in GCal sync.

## What Was Done

### Task 1: db:clear-tokens script
Created `src/db/clear-tokens.ts` following the exact pattern of `src/db/reset.ts`. The script deletes all rows from the accounts table and exits 0. Added `db:clear-tokens` npm script to `package.json` after `db:reset`.

### Task 2: Persist refreshed tokens to accounts table
In `src/auth.ts`, added import of `eq` and `and` from `drizzle-orm`. Inside the JWT callback's token-refresh try block (on successful refresh), added a fire-and-forget `db.update(accounts)` call that writes the new `access_token`, `expires_at`, and (when rotated) `refresh_token` back to the accounts table. The call is fire-and-forget (no `await`) so it never blocks the callback return. Errors are logged with the `[Auth]` prefix.

## Root Cause Fixed

GCal sync reads `access_token` from the `accounts` DB table. The JWT callback was refreshing the token and writing the new value to the JWT cookie only — the accounts table retained the original (now-revoked) tokens. On the next GCal sync call, the server fetched the stale, revoked token from DB and received `invalid_grant` from Google.

## Recovery Procedure

If `invalid_grant` occurs before this fix is deployed:
1. `npm run db:clear-tokens` — wipes the accounts table
2. Both parents sign in again — Auth.js writes fresh tokens to accounts table on sign-in
3. GCal sync will now work with valid tokens

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `src/db/clear-tokens.ts` exists
- [x] `db:clear-tokens` in package.json scripts
- [x] `src/auth.ts` contains `db.update(accounts)` inside jwt try block
- [x] TypeScript compiles with no errors (`npx tsc --noEmit`)
- [x] Commits: c304e4d (task 1), 1273119 (task 2)
