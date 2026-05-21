---
phase: 17-schedule-table-structure
plan: "02"
subsystem: schedule-table
tags: [ui, scroll, desktop, sticky-thead]
dependency_graph:
  requires: [week-label-row]
  provides: [desktop-full-page-scroll]
  affects: [src/components/schedule/schedule-table.tsx]
tech_stack:
  added: []
  patterns: [full-page scroll via wrapper div with no overflow classes, scroll-mt-* for sticky thead offset]
key_files:
  created: []
  modified:
    - src/components/schedule/schedule-table.tsx
decisions:
  - "Removed sm:overflow-y-auto and sm:h-[calc(100svh-8rem)] from wrapper <div> — mobile was already full-page scroll; now desktop matches"
  - "Changed scrollIntoView block from 'center' to 'start' so today's row appears at top of visible area"
  - "Used scroll-mt-10 (2.5rem/40px) on all <tr> rows unconditionally — cheap, avoids conditional-class race, matches thead height"
metrics:
  duration: "77s"
  completed: "2026-05-21T06:15:22Z"
  tasks_completed: 1
  files_modified: 1
requirements_completed:
  - UI-02
---

# Phase 17 Plan 02: Desktop Full-Page Scroll Summary

**One-liner:** Removed `sm:overflow-y-auto sm:h-[calc(100svh-8rem)]` inner scroll container from ScheduleTable wrapper, changing `scrollIntoView` to `block: "start"` and adding `scroll-mt-10` to today's row for sticky-thead offset compensation.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Remove desktop inner scroll container and update auto-scroll-to-today behavior | 704a729 | src/components/schedule/schedule-table.tsx |

## What Was Built

`ScheduleTable` wrapper `<div>` no longer has `sm:overflow-y-auto` or `sm:h-[calc(100svh-8rem)]` classes. The page itself now scrolls on desktop (matching the mobile behavior that was already full-page scroll since these were `sm:` classes inactive at mobile breakpoints). The sticky `<thead>` with `className="sticky top-0 z-10 bg-background"` is preserved and continues to work correctly — there is no ancestor `overflow-hidden` on `dashboard-shell.tsx`.

The auto-scroll `useEffect` now uses `block: "start"` instead of `block: "center"`, so today's row appears at the top of the visible area on mount. All day rows (today and non-today) now carry `scroll-mt-10` (2.5rem / 40px) to compensate for the sticky thead height when `scrollIntoView` targets the today row.

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

- TypeScript: `tsc --noEmit` exits 0 — zero errors
- ESLint: 0 errors, 2 pre-existing warnings (react-hooks/exhaustive-deps on `setDays` — unrelated to this plan; same warnings present in Plan 01)
- Build: Turbopack compilation succeeded (`Compiled successfully in 5.3s`); page data collection fails with `DATABASE_URL is not set` — pre-existing env constraint in this dev worktree, identical to Plan 01 behavior
- All 8 automated acceptance checks pass:
  1. `sm:overflow-y-auto` absent from file
  2. `sm:h-[calc(100svh` absent from file
  3. `block: "start"` present exactly once (line 89)
  4. `block: "center"` count = 0 (excluding comments)
  5. `className={day.isToday ? "bg-yellow-50 dark:bg-yellow-950/20 scroll-mt-10" : "scroll-mt-10"}` present (line 291)
  6. `className="sticky top-0 z-10 bg-background"` on `<thead>` present (line 257)
  7. `Viikko {getISOWeek(new Date(day.date))}` present — Plan 01 output intact (line 284)
  8. `import { getISOWeek } from "date-fns"` present — Plan 01 output intact (line 6)

## Known Stubs

None. The scroll behavior changes are purely layout/DOM — no data sources involved.

## Threat Flags

No new security-relevant surface introduced. This is a layout-only change removing CSS classes from a wrapper element. No new endpoints, auth paths, file access patterns, or schema changes.

## Self-Check: PASSED

- File exists: src/components/schedule/schedule-table.tsx — FOUND
- Commit 704a729 exists in git log — FOUND
