---
phase: 05-view-window-control
plan: 01
subsystem: api
tags: [date-fns, next.js, server-component, url-params, schedule, typescript, vitest, tdd]

# Dependency graph
requires:
  - phase: 03-draft-publish-statistics
    provides: getScheduleWindow query and DateWindow type that this plan extends
provides:
  - getWindowBounds(startDate?: string) accepting optional pre-validated ISO date string
  - getScheduleWindow(startDate?: string) threading startDate through to getWindowBounds
  - dashboard page.tsx reading searchParams as Promise, validating viewStart, passing to query
  - validateViewStart() pure function snapping any weekday to Monday (weekStartsOn: 1)
affects:
  - 05-02-view-window-control (toolbar UI reads initialViewStart from page)
  - 05-03-view-window-control (DashboardShell needs initialViewStart prop added)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Next.js 15 searchParams as Promise — must be awaited before accessing properties"
    - "URL param validation: parseISO + isValid gate, then snap to Monday with startOfWeek({ weekStartsOn: 1 })"
    - "TDD for Server Components: test pure helper logic inline; test the Server Component function separately"
    - "Vitest alias array form required when a specific path alias must take precedence over a broad @/ alias"
    - "Timezone-safe date assertions: use format(d, 'yyyy-MM-dd') not toISOString() in Finnish UTC+3 environment"

key-files:
  created:
    - src/lib/schedule/__tests__/generate-default.test.ts
    - src/app/dashboard/__tests__/page.test.ts
  modified:
    - src/lib/schedule/generate-default.ts
    - src/lib/schedule/queries.ts
    - src/app/dashboard/page.tsx
    - vitest.config.ts

key-decisions:
  - "validateViewStart snaps any weekday to Monday before passing to query — URL param is always normalized to week boundary"
  - "Invalid viewStart silently falls back to default (current week Monday) — no error UI needed"
  - "vitest alias array form used so @/config/app resolves to app.example.ts in gitignored worktree environment"
  - "Tests use format(d, yyyy-MM-dd) not toISOString() to avoid UTC offset issues in Finnish timezone (UTC+3)"

patterns-established:
  - "URL param validation pattern: raw string → parseISO → isValid guard → snap → format → pass to server query"
  - "Worktree-safe vitest config: alias array with specific path before broad @/ alias"

requirements-completed: [VIEW-01, VIEW-02, VIEW-03, VIEW-04]

# Metrics
duration: 12min
completed: 2026-05-04
---

# Phase 5 Plan 01: View Window Control — Backend Data Layer Summary

**URL-driven schedule window: getWindowBounds/getScheduleWindow accept optional startDate, dashboard page validates ?viewStart param and snaps to Monday before passing to query**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-04T20:29:00Z
- **Completed:** 2026-05-04T20:41:57Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 6 (2 source, 2 tests, 1 config, 1 page)

## Accomplishments

- `getWindowBounds(startDate?: string)` — accepts optional pre-validated ISO date; falls back to Monday of current week when omitted
- `getScheduleWindow(startDate?: string)` — threads startDate through to getWindowBounds, fully backward-compatible
- `dashboard/page.tsx` — reads `searchParams` as `Promise<{ viewStart?: string }>` per Next.js 15 App Router requirements, validates and snaps to Monday before passing to query and DashboardShell
- `validateViewStart()` — pure guard function: rejects non-ISO strings, snaps any weekday to its Monday (weekStartsOn: 1, Finnish convention)
- 16 new tests across 2 test files; all 22 suite tests pass; TypeScript compiles clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Refactor getWindowBounds and getScheduleWindow to accept startDate** - `bb11c98` (feat)
2. **Task 2: Update dashboard page.tsx to read and validate searchParams** - `de6ea39` (feat)

**Plan metadata:** (docs commit below)

_Note: Both tasks used TDD — RED test written first, GREEN implementation second_

## Files Created/Modified

- `src/lib/schedule/generate-default.ts` — Added `parseISO` import; `getWindowBounds(startDate?: string)` signature
- `src/lib/schedule/queries.ts` — `getScheduleWindow(startDate?: string)` threads param to getWindowBounds
- `src/app/dashboard/page.tsx` — Full replacement: searchParams Promise, validateViewStart, passes initialViewStart to DashboardShell
- `src/lib/schedule/__tests__/generate-default.test.ts` — 6 TDD tests for getWindowBounds (default and startDate modes)
- `src/app/dashboard/__tests__/page.test.ts` — 10 TDD tests for validateViewStart (snap, invalid input, undefined)
- `vitest.config.ts` — Alias array form added: @/config/app → app.example.ts (gitignored worktree fix)

## Decisions Made

- **searchParams as Promise**: Next.js 15 App Router requires `searchParams` prop to be awaited — typed as `Promise<{ viewStart?: string }>` and `await`ed before access.
- **Silent fallback on invalid input**: Invalid or missing `viewStart` silently falls back to default window. No error state needed — the schedule is always renderable.
- **Snap to Monday before passing**: `validateViewStart` normalizes mid-week dates to Monday so the query always starts on a week boundary. The function trusts its own output — `getWindowBounds` receives an already-snapped date.
- **Timezone-safe tests**: Finnish timezone is UTC+3; `parseISO("2026-04-28")` → midnight local → `2026-04-27T21:00:00Z`. Tests use `format(d, "yyyy-MM-dd")` instead of `toISOString()` to get local date strings.
- **Vitest alias ordering**: Specific alias `@/config/app → app.example.ts` must precede the broad `@/ → src/` alias in array form; object form doesn't guarantee ordering.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Timezone-safe test assertions**
- **Found during:** Task 1 TDD GREEN phase
- **Issue:** Tests used `toISOString().startsWith("2026-04-28")` but `parseISO` returns midnight local time; in UTC+3 this becomes `2026-04-27T21:00:00Z`, causing false negatives
- **Fix:** Changed assertions to use `format(d, "yyyy-MM-dd")` (local date string, timezone-aware)
- **Files modified:** `src/lib/schedule/__tests__/generate-default.test.ts`
- **Verification:** All 6 tests pass after fix
- **Committed in:** bb11c98 (Task 1 commit)

**2. [Rule 3 - Blocking] Vitest alias config for gitignored @/config/app**
- **Found during:** Task 1 TDD RED phase
- **Issue:** `@/config/app` is gitignored and doesn't exist in the worktree; vitest couldn't resolve it even with `vi.mock()` factory form
- **Fix:** Added specific alias `@/config/app → src/config/app.example.ts` in array form (before broad `@/ → src/` alias) in vitest.config.ts
- **Files modified:** `vitest.config.ts`
- **Verification:** Module resolves correctly; `vi.mock()` factory overrides the example config in tests
- **Committed in:** bb11c98 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 bug fix, 1 blocking issue)
**Impact on plan:** Both fixes necessary for test correctness and test infrastructure in worktree environment. No scope creep.

## Issues Encountered

- `parseISO` returns midnight local time, not midnight UTC — caused all date string assertions to fail in UTC+3 environment until switched to `format(d, "yyyy-MM-dd")`
- `@/config/app` gitignored in worktree; required vitest alias config to point to example file so tests could import and mock the module

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: input-validation | src/app/dashboard/page.tsx | URL param viewStart is user-controlled; validated via parseISO + isValid + startOfWeek snap before reaching query layer — T-05-01 mitigated as planned |

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Backend data layer is complete: `getScheduleWindow(startDate?)` accepts a validated date string
- `page.tsx` passes `initialViewStart` to `DashboardShell` — Plan 03 needs to add that prop to `DashboardShellProps`
- Plan 02 can add the URL navigation action (router.push with ?viewStart=) independently
- Plan 03 can add the toolbar UI buttons (prev/next week, date picker) independently
- TypeScript is clean; all 22 tests pass

---
*Phase: 05-view-window-control*
*Completed: 2026-05-04*
