---
phase: quick
plan: 260515-u3b
subsystem: config
tags: [env-vars, config, gitignore, cleanup]
dependency_graph:
  requires: []
  provides: [safe-tracked-app-config]
  affects: [src/config/app.ts, src/env.ts]
tech_stack:
  added: []
  patterns: [env-var-config, required-env-validation]
key_files:
  created:
    - src/config/app.ts
  modified:
    - src/env.ts
    - .env.example
    - .gitignore
  deleted:
    - src/config/app.example.ts
decisions:
  - "APP_CHILDREN and APP_START_DATE added to REQUIRED_ENV_VARS — no safe generic default"
  - "PARENT_FATHER_NAME, PARENT_MOTHER_NAME, APP_FIRST_PARENT have fallbacks (Father/Mother/father) so they are optional in env.ts"
  - "APP_CHILDREN parsed via split+trim+filter(Boolean) to handle extra commas or whitespace safely"
metrics:
  duration: ~5 minutes
  completed: "2026-05-15T18:54:26Z"
  tasks_completed: 2
  files_changed: 5
---

# Quick Task 260515-u3b: Move Remaining Hardcoded Config Values to Env Vars

**One-liner:** Replace five hardcoded values in `src/config/app.ts` with `process.env` reads, validate required ones in `env.ts`, and remove the file from `.gitignore` so it can be tracked safely.

## What Was Done

`src/config/app.ts` previously contained hardcoded Finnish names, children names, a start date, and a `firstParent` value that made the file unsafe to commit. The file was gitignored with a comment directing deployers to copy `app.example.ts`.

This task eliminates that pattern entirely:
- All five values moved to env vars: `PARENT_FATHER_NAME`, `PARENT_MOTHER_NAME`, `APP_CHILDREN`, `APP_START_DATE`, `APP_FIRST_PARENT`
- `APP_CHILDREN` and `APP_START_DATE` added to `REQUIRED_ENV_VARS` in `src/env.ts`
- `.env.example` updated to document all five new vars
- `.env.local` updated on disk with actual Finnish values
- `src/config/app.ts` removed from `.gitignore` and committed to git
- `src/config/app.example.ts` deleted — no longer needed

## Commits

| Hash | Message |
|------|---------|
| c3950e0 | chore(260515-u3b): add APP_CHILDREN and APP_START_DATE to env validation |
| f8ccecf | chore(260515-u3b): move remaining hardcoded config values to env vars and track app.ts |

## Verification Results

1. `grep -n "Isä\|Äiti\|Taimi\|Eino\|Hilla\|2026-01-05" src/config/app.ts` — NONE (good)
2. `git show HEAD:src/config/app.ts` — file exists in git
3. `test -f src/config/app.example.ts` — DELETED (good)
4. `grep "src/config/app.ts" .gitignore` — REMOVED (good)
5. All required env vars present in `.env.local` — validated

## Deviations from Plan

None — plan executed exactly as written.

The plan specified Task 1 and Task 2 as separate commits. Task 1 committed `.env.example` and `src/env.ts` together (c3950e0). Task 2 committed `.gitignore`, the new `src/config/app.ts`, and the deletion of `src/config/app.example.ts` together (f8ccecf) — git detected a rename (78% similarity) which is correct.

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries introduced.

## Self-Check: PASSED

- [x] src/config/app.ts exists and is committed (f8ccecf)
- [x] src/config/app.example.ts does not exist
- [x] .gitignore no longer contains src/config/app.ts
- [x] src/env.ts contains APP_CHILDREN and APP_START_DATE in REQUIRED_ENV_VARS
- [x] .env.example documents all five new vars
- [x] .env.local (disk only) contains actual Finnish values
