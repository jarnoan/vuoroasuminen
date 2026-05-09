---
phase: 08-supabase-auth-stack
plan: "01"
subsystem: database
tags: [drizzle, schema, supabase, auth, tokens]
dependency_graph:
  requires: []
  provides:
    - src/db/schema/tokens.ts (userGoogleTokens table definition)
    - src/db/index.ts (Drizzle db client with tokensSchema registered)
  affects:
    - Plans 03, 04, 06 (consume userGoogleTokens via db client)
tech_stack:
  added: []
  patterns:
    - pgTable with email text PK (natural key, no UUID)
    - Namespace import spread pattern for Drizzle schema registration
key_files:
  created:
    - src/db/schema/tokens.ts
  modified:
    - src/db/index.ts
decisions:
  - email as primary key (not UUID) — matches ownerEmail lookup in buildGCalClient; natural key per D-01
  - No access_token column — always exchanged at use-time via refresh_token
  - No FK to auth.users — Phase 9 RLS work; avoids blocking schema push before Supabase Auth tables exist
  - tokensSchema spread in db/index.ts — required for runtime table resolution (Pitfall 5)
metrics:
  duration: "97s"
  completed: "2026-05-09"
  tasks_completed: 2
  files_created: 1
  files_modified: 1
---

# Phase 8 Plan 01: user_google_tokens Drizzle Schema Summary

**One-liner:** Drizzle schema for `user_google_tokens` table (email PK, refresh_token NOT NULL, updated_at defaultNow) registered in the db client via tokensSchema namespace spread.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create user_google_tokens Drizzle schema | 72b197a | src/db/schema/tokens.ts (created) |
| 2 | Register tokens schema in src/db/index.ts | 6bbf36a | src/db/index.ts (modified) |

## Decisions Made

- **email as PK:** Text email is the natural key for `user_google_tokens` — the `buildGCalClient` function (Plan 06) always looks up tokens by `ownerEmail`. No UUID needed.
- **No `access_token` column:** The GCal client always exchanges the stored `refresh_token` for a fresh `access_token` at use-time. Storing access_token would add staleness risk.
- **No FK to `auth.users`:** Avoided to prevent blocking `drizzle-kit push` in Plan 03 before the Supabase Auth `auth.users` table exists in the new schema. FK is Phase 9 RLS work.
- **Namespace spread pattern:** `import * as tokensSchema` + spread into `drizzle(pool, { schema: {...tokensSchema} })` exactly matches existing project conventions from `authSchema` and `domainSchema`.

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `src/db/schema/tokens.ts` exists with correct column set (email PK, refreshToken NOT NULL, updatedAt defaultNow)
- `src/db/index.ts` imports `* as tokensSchema` and spreads it alongside `authSchema` and `domainSchema`
- No TypeScript errors introduced in `tokens.ts` or `index.ts`
- Pre-existing TypeScript errors (from `@/config/app` missing during auth migration) are out of scope — none are attributable to this plan's changes

## Known Stubs

None — this plan declares schema only; no data access patterns or UI rendering.

## Self-Check: PASSED

- `src/db/schema/tokens.ts` verified in git: `git show HEAD:src/db/schema/tokens.ts` shows correct content
- `src/db/index.ts` verified in git: `git show HEAD:src/db/index.ts` shows tokensSchema import and spread
- Commit 72b197a exists (Task 1)
- Commit 6bbf36a exists (Task 2)
