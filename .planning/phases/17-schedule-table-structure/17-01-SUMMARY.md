---
phase: 17-schedule-table-structure
plan: "01"
subsystem: schedule-table
tags: [ui, week-labels, date-fns]
dependency_graph:
  requires: []
  provides: [week-label-row]
  affects: [src/components/schedule/schedule-table.tsx]
tech_stack:
  added: []
  patterns: [getISOWeek named import from date-fns, conditional JSX row render on isWeekStart]
key_files:
  created: []
  modified:
    - src/components/schedule/schedule-table.tsx
decisions:
  - "Used getISOWeek named import from date-fns (not subpath form) per D-05 and existing project pattern"
  - "Removed index > 0 guard per D-04 — label renders for every week including the first"
  - "Removed unused index parameter from days.map() callback — fixing lint warning introduced by removing guard"
metrics:
  duration: "100s"
  completed: "2026-05-21T06:10:06Z"
  tasks_completed: 1
  files_modified: 1
requirements_completed:
  - UI-01
---

# Phase 17 Plan 01: Week Label Row Summary

**One-liner:** Added `Viikko N` ISO week label row above every Monday in ScheduleTable using `getISOWeek` from date-fns, replacing the previous hairline `h-px bg-border` separator.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add date-fns getISOWeek import and replace separator row with week label row | a183000 | src/components/schedule/schedule-table.tsx |

## What Was Built

`ScheduleTable` now renders a `<tr>` containing `<td colSpan={colCount} className="px-3 pt-3 pb-1 text-xs text-muted-foreground">Viikko {getISOWeek(new Date(day.date))}</td>` whenever `day.isWeekStart` is true. This appears above every Monday row in the schedule view, including the first week.

The previous hairline separator (`<tr><td className="h-px bg-border" /></tr>`) has been removed entirely. The week label row serves as both the visual week boundary and the separator.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused `index` parameter from `.map()` callback**
- **Found during:** Lint verification after Edit B
- **Issue:** Removing `index > 0` from the conditional left `(day, index)` in `days.map((day, index) => ...)` — `index` became unused, triggering `@typescript-eslint/no-unused-vars` lint warning
- **Fix:** Changed `days.map((day, index) => (` to `days.map((day) => (` — the index was only ever used for the `index > 0` guard, which the plan explicitly directed to remove
- **Files modified:** src/components/schedule/schedule-table.tsx
- **Commit:** a183000 (included in the same commit)

## Verification Results

- TypeScript: `tsc --noEmit` exits 0 — zero errors
- ESLint: 0 errors, 2 pre-existing warnings (react-hooks/exhaustive-deps on `setDays` — unrelated to this plan)
- Build: Turbopack compilation succeeded (`Compiled successfully`); page data collection fails with `DATABASE_URL is not set` — pre-existing env constraint in this dev worktree, unrelated to the code changes
- All 9 automated acceptance checks pass:
  - getISOWeek import present at module top
  - No subpath `date-fns/...` imports
  - `h-px bg-border` absent
  - `day.isWeekStart && index > 0` absent
  - `Viikko {getISOWeek(new Date(day.date))}` appears exactly once
  - `px-3 pt-3 pb-1 text-xs text-muted-foreground` className present
  - `colSpan={colCount}` used in 2 places (week label row + mobile notes row)
  - No `from "date-fns/"` subpath imports

## Known Stubs

None. The week label row reads `day.date` from server-fetched `ScheduleDay` data and computes the ISO week number inline — no placeholder or mock data.

## Threat Flags

No new security-relevant surface introduced. The change is purely a rendering modification using an existing data field (`day.date`) and a pure arithmetic function (`getISOWeek`). React auto-escapes the interpolated number.

## Self-Check: PASSED

- File exists: src/components/schedule/schedule-table.tsx — FOUND
- Commit a183000 exists in git log — FOUND
