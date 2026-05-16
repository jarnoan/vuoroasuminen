---
phase: 12-onboarding-wizard
plan: "02"
subsystem: server-side-config-migration
tags:
  - refactor
  - server-side
  - call-sites
  - async-config

dependency_graph:
  requires:
    - family_config DB table (Plan 01)
    - getAppConfig() async function (Plan 01)
  provides:
    - All server-side call sites using await getAppConfig()
    - generateDefaultEntries accepts startDate + firstParent params
    - Dashboard redirects to /setup on missing family_config
    - generate-app-config.js deleted
    - package.json build script is 'next build' only
  affects:
    - src/lib/schedule/generate-default.ts (signature changed — callers must pass 2 new params)
    - src/lib/schedule/queries.ts (migrated to async config)
    - src/lib/gcal/sync.ts (migrated to async config)
    - src/actions/schedule.ts (migrated; test mock added)
    - src/app/dashboard/page.tsx (redirect-on-missing added)
    - src/components/schedule/*.tsx (still broken — Plan 03 owns these)

tech_stack:
  added: []
  patterns:
    - "const config = await getAppConfig() at function entry (not module scope)"
    - "try { config = await getAppConfig() } catch { redirect('/setup') } in Server Component"
    - "generateDefaultEntries accepts startDate+firstParent as params (D-16 unit-testable pattern)"
    - "vi.mock('@/config/app') in schedule.test.ts for async getAppConfig"

key_files:
  created: []
  modified:
    - src/lib/schedule/generate-default.ts
    - src/lib/schedule/queries.ts
    - src/lib/gcal/sync.ts
    - src/actions/schedule.ts
    - src/actions/schedule.test.ts
    - src/app/dashboard/page.tsx
    - package.json
  deleted:
    - scripts/generate-app-config.js

decisions:
  - "config local variable pattern: each function reads config at entry via await getAppConfig() rather than a shared request-level context — acceptable for low-traffic two-user app (T-12-15 accepted)"
  - "syncParentCalendar parent type narrowed from (typeof config.parents)[number] to explicit object shape — removes module-scope config dependency from the type"
  - "Remaining TS errors in client components (clear-panel, schedule-cell, stats-panel) are intentional compile-time guards — Plan 03 fixes them"

metrics:
  duration: "3 minutes"
  completed_date: "2026-05-16"
  tasks_completed: 5
  files_changed: 7
---

# Phase 12 Plan 02: Server-Side Call Site Migration Summary

**One-liner:** Migrated all 5 server-side call sites from synchronous `import config from "@/config/app"` to `await getAppConfig()`, refactored `generateDefaultEntries` to accept config as parameters, added dashboard redirect to `/setup` on missing config, and deleted the legacy build script.

## What Was Built

### Task 1 — generateDefaultEntries signature change (D-16)

`src/lib/schedule/generate-default.ts` refactored:

**Before:**
```typescript
import config from "@/config/app"
export function generateDefaultEntries(windowStart, windowEnd, childNames)
  // reads config.startDate and config.firstParent from module scope
```

**After:**
```typescript
// no config import
export function generateDefaultEntries(windowStart, windowEnd, childNames, startDate: string, firstParent: ParentId)
  // uses caller-supplied params
```

`getWindowBounds()` untouched — does not read config.

### Task 2 — queries.ts and gcal/sync.ts migration

**`src/lib/schedule/queries.ts`:**
- Import: `import { getAppConfig } from "@/config/app"`
- `getScheduleWindow()`: `const config = await getAppConfig()` added at function entry
- `generateDefaultEntries` call updated: `generateDefaultEntries(start, end, config.children, config.startDate, config.firstParent)`

**`src/lib/gcal/sync.ts`:**
- Import: `import { getAppConfig } from "@/config/app"`
- `syncCalendarsAfterPublish()`: `const config = await getAppConfig()` added at function entry
- `syncParentCalendar` parameter type narrowed from `(typeof config.parents)[number]` to explicit `{ id, name, email, calendarId, ownerEmail }` object shape

### Task 3 — schedule.ts migration + test mock

**`src/actions/schedule.ts`:**
- Import: `import { getAppConfig } from "@/config/app"`
- `requireAuthorizedParent()`: `const config = await getAppConfig()` — replaces module-scope config reference for parent email check
- `extendSchedule()`: `const config = await getAppConfig()` added before child name/id map build; `generateDefaultEntries` call updated with 2 new params

**`src/actions/schedule.test.ts`:**
- Added `vi.mock("@/config/app", ...)` returning a fixture with `father@example.com` and `mother@example.com` as authorized parents — exactly matching the test helpers `setAuthorizedSession()` and `setUnauthorizedSession()`
- All 8 extendSchedule tests pass (verified: 25 total across 3 suites — 0 failures)

### Task 4 — Dashboard redirect on missing config (D-10)

**`src/app/dashboard/page.tsx`:**

**Before:**
```typescript
import config from "@/config/app"
// ...
const ownerEmail = config.parents[0].ownerEmail
```

**After:**
```typescript
import { getAppConfig } from "@/config/app"
import { redirect } from "next/navigation"
// ...
let config
try {
  config = await getAppConfig()
} catch {
  redirect("/setup")
}
const ownerEmail = config.parents[0].ownerEmail
```

SAUTH-07 ownerEmail logic preserved unchanged. The `catch {}` only catches `getAppConfig()` errors — `redirect()` throws internally and exits the render before the catch can intercept it (standard Next.js pattern).

### Task 5 — Delete legacy build script (D-09)

- `scripts/generate-app-config.js` deleted
- `package.json` build script changed from `"node scripts/generate-app-config.js && next build"` to `"next build"`
- All other npm scripts (`dev`, `start`, `lint`, `db:push`, `db:generate`, `db:studio`, `db:seed`, `db:reset`) untouched

## Test Results

```
npx vitest run src/config/app.test.ts src/actions/setup.test.ts src/actions/schedule.test.ts
PASS (25) FAIL (0)
```

All 8 schedule.test.ts tests pass via the new `vi.mock("@/config/app")`.

## Remaining TypeScript Errors (Expected — Plan 03 scope)

`grep -rn 'import config from "@/config/app"' src/components` still returns 3 matches:
- `src/components/schedule/clear-panel.tsx`
- `src/components/schedule/schedule-cell.tsx`
- `src/components/schedule/stats-panel.tsx`

These are client components that Plan 03 (Wave 3) will update. The compile-time breakage is an intentional guard (T-12-16 mitigated) — the app cannot build until Plan 03 ships. Plans 02 and 03 ship as a unit within Phase 12.

Also still broken (not in Phase 12 scope):
- `src/db/reset.ts` — dev utility, not a production path
- `src/db/seed.ts` — dev utility, not a production path

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all migrated call sites have real implementations backed by `getAppConfig()` which reads from the live `family_config` DB table.

## Threat Flags

No new network endpoints, auth paths, or schema changes introduced in this plan. All surfaces were modeled in the plan's STRIDE register.

## Self-Check: PASSED

All modified files present on disk. All 5 task commits verified:
- c9cd4ea — Task 1: generateDefaultEntries signature (D-16)
- 69f685b — Task 2: queries.ts + gcal/sync.ts migration
- 5af2ca5 — Task 3: schedule.ts migration + test mock
- 9846ad2 — Task 4: dashboard redirect to /setup (D-10)
- 11698d4 — Task 5: delete generate-app-config.js + package.json build update (D-09)
