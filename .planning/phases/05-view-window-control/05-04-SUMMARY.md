---
phase: 05-view-window-control
plan: "04"
subsystem: ui-wiring
tags: [react, next.js, client-component, view-toolbar, dashboard-shell, cleanup]

# Dependency graph
requires:
  - plan: "05-01"
    provides: "initialViewStart prop threaded from page.tsx to DashboardShell"
  - plan: "05-03"
    provides: "ViewToolbar Client Component at src/components/schedule/view-toolbar.tsx"
provides:
  - DashboardShell accepting initialViewStart prop and rendering ViewToolbar
  - schedule-table.tsx free of TodayButton (import, variable, render all removed)
affects:
  - Human verification — VIEW-01 through VIEW-04 now exercisable end-to-end in browser

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ViewToolbar wired via prop: DashboardShell passes initialViewStart down to ViewToolbar unchanged"
    - "Legacy floating button removed: today-button.tsx deleted; auto-scroll useEffect preserved in schedule-table.tsx"

key-files:
  created: []
  modified:
    - src/components/schedule/dashboard-shell.tsx
    - src/components/schedule/schedule-table.tsx
  deleted:
    - src/components/schedule/today-button.tsx

decisions:
  - "ViewToolbar inserted between {header} and publish bar div — matches UI-SPEC toolbar row position"
  - "today-button.tsx deleted outright (not deprecated in-place) — only schedule-table.tsx imported it; grep confirmed no orphans"
  - "Auto-scroll useEffect preserved in schedule-table.tsx — toolbar Tänään button relies on it after RSC re-render"

# Metrics
duration: "~5 min"
completed: "2026-05-04"
---

# Phase 5 Plan 04: ViewToolbar Wiring and TodayButton Cleanup Summary

**DashboardShell wired to render ViewToolbar; legacy floating TodayButton removed — VIEW-01 through VIEW-04 assembled end-to-end, pending human browser verification.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-04T20:51:37Z
- **Completed:** 2026-05-04T20:55:00Z
- **Tasks:** 2 completed (Task 3 is checkpoint:human-verify — pending)
- **Files modified:** 2 (1 deleted)

## Accomplishments

- `DashboardShell` — added `initialViewStart?: string` to props interface; destructured from props; imported `ViewToolbar`; inserted `<ViewToolbar initialViewStart={initialViewStart} />` between `{header}` and publish bar
- `schedule-table.tsx` — removed `TodayButton` import, `todayDate` variable, and `{todayDate && <TodayButton todayDate={todayDate} />}` render; auto-scroll `useEffect` preserved
- `today-button.tsx` — deleted; grep confirms zero orphaned imports remain
- TypeScript compiles clean (`tsc --noEmit` exits 0)

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wire ViewToolbar into DashboardShell | dc0c65f | src/components/schedule/dashboard-shell.tsx |
| 2 | Remove TodayButton from ScheduleTable | 70d8338 | src/components/schedule/schedule-table.tsx, src/components/schedule/today-button.tsx (deleted) |

## Files Created/Modified

- `src/components/schedule/dashboard-shell.tsx` — Modified: +4 lines (ViewToolbar import, initialViewStart prop, destructure, JSX insertion)
- `src/components/schedule/schedule-table.tsx` — Modified: -5 lines (TodayButton import, todayDate variable + comment, TodayButton render)
- `src/components/schedule/today-button.tsx` — Deleted: 28-line file; floating fixed-position button replaced by ViewToolbar Tänään button

## Decisions Made

- **Toolbar position:** `<ViewToolbar>` placed between `{header}` and the publish bar div — matches UI-SPEC toolbar row layout
- **Delete vs deprecate:** `today-button.tsx` deleted entirely; `grep -r "today-button" src/` confirmed only one consumer existed; no deprecation wrapper needed
- **Auto-scroll preservation:** The `useEffect` that scrolls to `[data-today="true"]` is what the toolbar's Tänään button relies on after Next.js RSC re-render clears viewStart; it was explicitly preserved per plan instructions

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None. All wiring is complete. Verification is pending human browser check (Task 3 checkpoint).

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes introduced.

- T-05-10 accepted: initialViewStart passed through DashboardShell without modification — pre-validated server-side in page.tsx
- T-05-11 accepted: today-button.tsx deleted cleanly; grep confirmed no orphaned imports

## Self-Check: PASSED

- `src/components/schedule/dashboard-shell.tsx` — FOUND, modified
- `src/components/schedule/schedule-table.tsx` — FOUND, modified
- `src/components/schedule/today-button.tsx` — DELETED (confirmed by `ls` returning "No such file")
- Commit dc0c65f — FOUND
- Commit 70d8338 — FOUND
- TypeScript: tsc --noEmit exits 0 (clean)
- No orphaned today-button imports: `grep -r "today-button" src/` returns empty
