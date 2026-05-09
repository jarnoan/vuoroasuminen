---
phase: 08-supabase-auth-stack
plan: "03"
subsystem: database
tags: [drizzle, schema-push, database, supabase, tokens]
one_liner: "drizzle-kit push created user_google_tokens table in live Supabase Postgres (email PK, refresh_token, updated_at — all NOT NULL)"

dependency_graph:
  requires: [08-01]
  provides: [user_google_tokens table in live Supabase DB]
  affects: [08-04, 08-06, 08-07, 08-08]

tech_stack:
  added: []
  patterns: [drizzle-kit push (additive schema sync)]

key_files:
  created: []
  modified: []

decisions:
  - ".env.local from main repo copied to worktree to supply DATABASE_URL for drizzle-kit push — worktrees do not automatically inherit .env.local since it is gitignored"

metrics:
  duration_minutes: 2
  completed_date: "2026-05-09"
  tasks_completed: 1
  files_created: 0
  files_modified: 0
---

# Phase 08 Plan 03: DB Schema Push Summary

## One-liner

drizzle-kit push created `user_google_tokens` table in live Supabase Postgres with `email` (primary key), `refresh_token`, and `updated_at` — all columns NOT NULL.

## What Was Done

### Task 1: Push Drizzle Schema to Create user_google_tokens Table

**Status:** Complete

**Pre-flight checks passed:**
- `src/db/schema/tokens.ts` exists and exports `userGoogleTokens`
- `src/db/index.ts` imports and registers `tokensSchema`
- `drizzle.config.ts` present and correctly references `./src/db/schema/*.ts`
- `DATABASE_URL` sourced from `.env.local` (copied from main repo to worktree)

**Push command:** `npm run db:push` (alias: `npx drizzle-kit push`)

**Push log excerpt:**
```
Reading config file '...drizzle.config.ts'
Using 'pg' driver for database querying
[✓] Pulling schema from database...
[✓] Changes applied
```

Exit code: 0. Push log contains no `ERROR`, `failed`, or `dropped` strings.

**Post-push verification:** Queried `information_schema.columns` for `user_google_tokens`:

| column_name   | data_type                   | is_nullable |
|---------------|-----------------------------|-------------|
| email         | text                        | NO          |
| refresh_token | text                        | NO          |
| updated_at    | timestamp without time zone | NO          |

All three columns match the Drizzle schema in `src/db/schema/tokens.ts`. All `NOT NULL`.

**Push log file:** `/tmp/gsd-08-03-push.log`

## Acceptance Criteria — All Passed

- [x] `npm run db:push` exits with code 0
- [x] `user_google_tokens` table exists in the database referenced by `DATABASE_URL`
- [x] Exactly three columns: `email`, `refresh_token`, `updated_at` (all `is_nullable = 'NO'`)
- [x] Push log contains no `ERROR`, `failed`, or `dropped` strings
- [x] No existing tables altered or dropped (push was additive only)

## Deviations from Plan

**1. [Rule 3 - Blocking] .env.local not present in worktree**

- **Found during:** Task 1 pre-flight
- **Issue:** The worktree at `.claude/worktrees/agent-a95560cc56e96f5f1/` did not have `.env.local`, which is gitignored. Without `DATABASE_URL`, `drizzle-kit push` would fail to connect to Supabase.
- **Fix:** Copied `.env.local` from the main repo (`/Users/jarno/src/vuoroasuminen/.env.local`) to the worktree before running the push. This is a standard worktree setup issue — gitignored env files are not shared automatically.
- **Files modified:** `.env.local` (worktree only; not committed; gitignored)
- **Commit:** N/A — `.env.local` is gitignored

## Threat Model Compliance

- **T-08-03-01** (Tampering — destructive diff): Push was additive only. Push log confirmed no `dropped` changes. drizzle-kit did not prompt for any destructive confirmation.
- **T-08-03-02** (Wrong database): Pre-flight confirmed `DATABASE_URL` is set; post-push verification confirmed the table appeared in the referenced database.
- **T-08-03-03** (Log leaks schema): `/tmp/gsd-08-03-push.log` is local-only, not committed.

## Known Stubs

None.

## Threat Flags

None — this plan only runs DDL against the existing Supabase database. No new network endpoints, auth paths, or file access patterns introduced.

## Self-Check: PASSED

- `user_google_tokens` table: confirmed present in live Supabase Postgres via `information_schema.columns` query
- Push log: `/tmp/gsd-08-03-push.log` — clean (no error strings)
- No code files created or modified — task was a pure database operation
