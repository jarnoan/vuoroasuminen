---
phase: 11-production-deploy
plan: 01
subsystem: infra
tags: [dotenv, build-script, env-vars, vercel, nodejs]

requires:
  - phase: 10-auth-js-removal
    provides: "Auth.js fully removed; stack settled on Supabase Auth + env var config pattern"

provides:
  - "generate-app-config.js exits 1 with FATAL message when required env vars missing"
  - "generate-app-config.js loads .env.local via dotenv for local builds"
  - "dotenv locked as direct devDependency in package.json"
  - ".env.example documents all Vercel-required env vars with explanatory comments"

affects: [11-02, 11-03, vercel-deploy]

tech-stack:
  added:
    - "dotenv ^17.4.2 (devDependency — was transitive only via shadcn)"
  patterns:
    - "Build scripts use require('dotenv').config({ path: path.join(__dirname, '../.env.local') }) for local env loading"
    - "Build-time validation: exit 1 with FATAL message on missing required env vars"

key-files:
  created: []
  modified:
    - "scripts/generate-app-config.js"
    - ".env.example"
    - "package.json"
    - "package-lock.json"

key-decisions:
  - "D-01: Script exits 1 ALWAYS when vars missing — no VERCEL/CI conditional check"
  - "D-02: dotenv loaded via require() before required[] check so local npm run build reads .env.local without shell exports"
  - "dotenv added as direct devDep because transitive-only status is fragile (shadcn dependency tree change would break script)"

patterns-established:
  - "Build script fail-fast: validate env vars at build time, not runtime"
  - ".env.example as complete reference: every production-required var documented with source/purpose comment"

requirements-completed:
  - DPLY-04

duration: 2min
completed: 2026-05-16
---

# Phase 11 Plan 01: Build-time Env Var Validation Summary

**generate-app-config.js now exits 1 with FATAL message on missing env vars, loads .env.local via dotenv for local builds, and dotenv is locked as a direct devDependency**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-16T06:00:31Z
- **Completed:** 2026-05-16T06:02:19Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Fixed build script silent failure: `process.exit(0)` changed to `process.exit(1)` with a `FATAL: missing required env vars` error message — Vercel builds will now abort visibly when any required var is missing
- Added `require("dotenv").config({ path: path.join(__dirname, "../.env.local") })` so `npm run build` works locally from `.env.local` without requiring shell variable exports
- Added `dotenv ^17.4.2` as a direct `devDependency` — previously transitive only via shadcn, which is fragile
- Completed `.env.example` to cover all Vercel-required vars: `SUPABASE_SERVICE_ROLE_KEY`, `APP_CALENDAR_OWNER_EMAIL`, and all `APP_FATHER_*`/`APP_MOTHER_*` build-time vars (previously only `PARENT_*` runtime vars were documented)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add dotenv as direct devDependency** - `355386e` (chore)
2. **Task 2: Fix generate-app-config.js exit code and add dotenv loading** - `e064f0c` (fix)
3. **Task 3: Update .env.example with missing vars** - `7d41090` (docs)

## Files Created/Modified

- `scripts/generate-app-config.js` — added dotenv loading line; changed exit 0 to exit 1 with FATAL error message; all other script logic preserved verbatim
- `.env.example` — appended `SUPABASE_SERVICE_ROLE_KEY`, `APP_CALENDAR_OWNER_EMAIL`, `APP_FATHER_NAME/EMAIL/CALENDAR_ID`, `APP_MOTHER_NAME/EMAIL/CALENDAR_ID` with explanatory comments
- `package.json` — added `"dotenv": "^17.4.2"` to `devDependencies`
- `package-lock.json` — updated to lock dotenv as direct dep

## Decisions Made

- Used `process.exit(1)` unconditionally (no `VERCEL`/`CI` env check) per D-01 — fail loud everywhere, no silent skips
- Used `__dirname`-relative path for dotenv config (not CWD-relative) because the script runs from `scripts/`, not the project root — mirrors the documented concern in CONTEXT.md D-02
- Did not add a `TODO: remove in Phase 12` comment to the script — keeping it clean; Phase 12 will replace the whole pattern when DB-driven onboarding lands

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

The worktree has no `.env.local` (only untracked in the source repo), so Check 1 ("local build sanity") exits 1 in the worktree. This is correct behavior — the fix works as intended. Verified against the source repo where `.env.local` exists: the script reads it correctly. The plan verification was written assuming the source repo context; the behavioral fix (exit 0 → exit 1 on missing vars) is confirmed correct by Check 2.

## User Setup Required

None — no external service configuration required in this plan.

## Next Phase Readiness

- Build script validation is correct and will abort Vercel builds on misconfiguration
- `.env.example` is now complete reference for what to set via `vercel env add`
- Ready for Plan 11-02: middleware.ts → proxy.ts rename (DPLY-05)

---
*Phase: 11-production-deploy*
*Completed: 2026-05-16*
