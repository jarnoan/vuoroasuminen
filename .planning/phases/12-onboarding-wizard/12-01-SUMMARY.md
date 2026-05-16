---
phase: 12-onboarding-wizard
plan: "01"
subsystem: data-layer
tags:
  - drizzle
  - schema
  - rls
  - server-actions
  - tdd

dependency_graph:
  requires: []
  provides:
    - family_config DB table
    - invite_tokens DB table
    - getAppConfig() async function
    - saveWizardConfig Server Action
    - listCalendars Server Action
    - RLS policies for new tables
  affects:
    - src/config/app.ts (breaking change: default export removed)
    - src/actions/schedule.ts (call site broken until Plan 02)
    - src/lib/gcal/sync.ts (call site broken until Plan 02)
    - src/lib/schedule/queries.ts (call site broken until Plan 02)
    - src/lib/schedule/generate-default.ts (call site broken until Plan 02)
    - src/app/dashboard/page.tsx (call site broken until Plan 02)

tech_stack:
  added: []
  patterns:
    - Drizzle integer PK with default(1) for single-row config table
    - CHECK (id = 1) constraint applied via raw SQL after drizzle-kit push
    - RLS SELECT-only for authenticated role on family_config (writes via service_role only)
    - TDD RED/GREEN for async getAppConfig and Server Actions

key_files:
  created:
    - src/config/app.test.ts
    - src/actions/setup.ts
    - src/actions/setup.test.ts
  modified:
    - src/db/schema/domain.ts
    - src/config/app.ts
    - supabase/policies.sql
    - vitest.config.ts

decisions:
  - "getAppConfig throws on missing row — callers must catch and redirect to /setup (D-10)"
  - "ownerEmail = parent1Email for both parent entries — no separate DB column (D-07)"
  - "saveWizardConfig uses service_role Drizzle connection (admin db) — bypasses RLS by design"
  - "Monday-only startDate validated via getUTCDay() === 1 — timezone-safe UTC check"
  - "vitest.config.ts alias updated from app.example.ts (deleted in f8ccecf) to app.ts"

metrics:
  duration: "9 minutes"
  completed_date: "2026-05-16"
  tasks_completed: 5
  files_changed: 7
---

# Phase 12 Plan 01: DB Schema + Config Reader + Server Actions Summary

**One-liner:** DB-backed family_config and invite_tokens tables with RLS, async getAppConfig() replacing env-var config, and saveWizardConfig/listCalendars Server Actions for the onboarding wizard.

## What Was Built

### Tables Created

**`family_config`** — single-row config table:
- Columns: id (integer PK default 1), parent1_id, parent1_name, parent1_email, parent1_calendar_id, parent2_id, parent2_name, parent2_email, parent2_calendar_id, children (text[] NOT NULL), start_date (date), first_parent (text default 'father'), created_at, updated_at
- RLS: ENABLED; authenticated role SELECT only; writes via service_role from saveWizardConfig
- CHECK constraint: `family_config_single_row CHECK (id = 1)` enforces single-row at DB level

**`invite_tokens`** — placeholder for Phase 13 invite flow:
- Columns: id (text UUID PK), token (text UNIQUE), created_by, expires_at, used_at (nullable), used_by (nullable), created_at
- RLS: ENABLED; authenticated role SELECT only where auth.jwt()->>'email' = created_by

Both tables verified in live Supabase DB:
- `SELECT to_regclass('public.family_config'), to_regclass('public.invite_tokens')` → both non-null
- `SELECT conname FROM pg_constraint WHERE conrelid = 'public.family_config'::regclass AND contype = 'c'` → `family_config_single_row`
- Both show `relrowsecurity = true` in pg_class

### API Surface

**`getAppConfig(): Promise<AppConfig>`** (`src/config/app.ts`)
- Reads from family_config WHERE id = 1
- Throws `"Family config not found — onboarding not complete"` when no row
- Sets `ownerEmail = parent1Email` for both parent entries (D-07)
- Exports: `getAppConfig`, `AppConfig`, `ParentId` — no default export

**`saveWizardConfig(input: WizardInput): Promise<...>`** (`src/actions/setup.ts`)
- Auth: supabase.auth.getUser() — returns `{ success: false, error: "Ei kirjautunut" }` for unauthenticated
- Validation: Zod schema + domain rules (same-email rejection, Monday startDate, duplicate children names)
- Persistence: db.insert(familyConfig).onConflictDoUpdate() — idempotent upsert on id=1
- Returns `{ success: true }` or `{ success: false, error: string }`

**`listCalendars(): Promise<...>`** (`src/actions/setup.ts`)
- Auth: same pattern as saveWizardConfig
- Calls buildGCalClient(user.email) + calendar.calendarList.list()
- Returns `{ success: true, calendars: Array<{ id, summary }> }` or error
- Catches and returns errors (GCal quota, token expiry, etc.)

### Known Transient Breakage

The following call sites still import `import config from "@/config/app"` (the removed default export) and have TypeScript errors until Plan 02 (Wave 2) fixes them:
1. `src/actions/schedule.ts` — requireAuthorizedParent + extendSchedule
2. `src/app/dashboard/page.tsx`
3. `src/components/schedule/clear-panel.tsx`
4. `src/components/schedule/schedule-cell.tsx`
5. `src/components/schedule/stats-panel.tsx`
6. `src/db/reset.ts`
7. `src/db/seed.ts`
8. `src/lib/gcal/sync.ts`
9. `src/lib/schedule/generate-default.ts`
10. `src/lib/schedule/queries.ts`

Plan 02 (Wave 2, same phase) will update all call sites to `const config = await getAppConfig()`. The app does not build at HEAD until Plan 02 completes — this is expected per the plan's objective.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] drizzle-kit push dropped all existing RLS policies**
- **Found during:** Task 2
- **Issue:** drizzle-kit v0.41+ manages RLS state. Because the Drizzle schema declares no RLS policies, `drizzle-kit push` generated `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` and `DROP POLICY` statements for all 5 existing tables (children, schedules, schedule_entries, gcal_events, user_google_tokens).
- **Fix:** Immediately after push, re-applied all dropped policies via node pg client. Verified all 7 tables show relrowsecurity=true in pg_class.
- **Files modified:** supabase/policies.sql (Phase 12 block added — also applies the new table policies)
- **Commit:** 561f28c

**2. [Rule 1 - Bug] vitest config alias pointed to deleted file**
- **Found during:** Task 4
- **Issue:** vitest.config.ts alias `@/config/app` → `src/config/app.example.ts` — this file was deleted in commit f8ccecf (the "move hardcoded config values to env vars" quick task). The alias was stale, causing schedule.test.ts to fail with "Cannot find package" before Plan 01 even started.
- **Fix:** Updated alias to point to `src/config/app.ts` (the actual file). app.test.ts uses relative import `./app` and bypasses the alias. schedule.test.ts continues to fail (pre-existing, Plan 02 will fix).
- **Files modified:** vitest.config.ts
- **Commit:** a830991

**3. [Rule 1 - Bug] vi.mock hoisting issue in setup.test.ts**
- **Found during:** Task 5 initial test run
- **Issue:** vitest error "There was an error when mocking a module. top level variables inside vi.mock factory". The first test version captured `mockDb` as a top-level variable referenced inside the `vi.mock("@/db")` factory — forbidden due to hoisting.
- **Fix:** Moved mock factory to return a fresh object; captured insert args in a `setupInsertMock()` helper function called from `beforeEach`.
- **Files modified:** src/actions/setup.test.ts
- **Commit:** c53115f

## Known Stubs

None — all exported functions have real implementations backed by DB queries or Google API calls. The listCalendars action does require a valid user_google_tokens row for the authenticated user, which will only exist after the user signs in through the Supabase OAuth flow.

## Threat Flags

No new network endpoints or auth paths beyond what was declared in the plan's threat model. The `saveWizardConfig` and `listCalendars` Server Actions are the only new trust boundary surfaces — both were modeled in the plan's STRIDE register.

## Self-Check: PASSED

All created files present on disk. All 6 task commits verified in git log:
- 0196aa8 — Task 1: domain schema (familyConfig + inviteTokens)
- 561f28c — Task 3: RLS policies + CHECK constraint
- 0b00d9e — Task 4 RED: failing tests for getAppConfig
- a830991 — Task 4 GREEN: async getAppConfig implementation + vitest config fix
- 8feb108 — Task 5 RED: failing tests for setup.ts
- c53115f — Task 5 GREEN: saveWizardConfig + listCalendars implementation

All 14 unit tests pass: `npx vitest run src/config/app.test.ts src/actions/setup.test.ts` → PASS (14) FAIL (0).
