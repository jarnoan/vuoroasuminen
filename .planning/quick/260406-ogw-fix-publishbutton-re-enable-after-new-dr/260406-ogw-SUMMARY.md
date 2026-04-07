---
phase: quick
plan: 260406-ogw
subsystem: schedule-ui
tags: [publish-button, state-lifting, dashboard-shell]
dependency_graph:
  requires: []
  provides: [DashboardShell, live-days-state-for-PublishButton]
  affects: [dashboard-page, publish-button, schedule-with-realtime, schedule-table]
tech_stack:
  added: []
  patterns: [state-lifting, callback-prop-chain]
key_files:
  created:
    - src/components/schedule/dashboard-shell.tsx
  modified:
    - src/components/schedule/publish-button.tsx
    - src/components/schedule/schedule-with-realtime.tsx
    - src/components/schedule/schedule-table.tsx
    - src/app/dashboard/page.tsx
decisions:
  - DashboardShell is the single source of truth for days state, feeding PublishButton via prop
  - PublishButton derives draftCount from live days prop; no hasPublished ratchet needed
  - ScheduleTable calls onDaysChange via useEffect on every days update (optimistic, realtime, mount)
metrics:
  duration: ~8 minutes
  completed_date: "2026-04-06"
  tasks_completed: 2
  files_changed: 5
---

# Quick Task 260406-ogw: Fix PublishButton Re-enable After New Drafts Summary

**One-liner:** Lifted days state into DashboardShell and simplified PublishButton to derive draftCount from live days prop, removing the hasPublished ratchet.

## What Was Done

The PublishButton was stuck using stale `initialData` (server snapshot) and a `hasPublished` flag that never reset. After publishing, toggling new cells to draft never re-enabled the button.

**Fix:** Created `DashboardShell` as the single client-side owner of `days` state. It passes live days to `PublishButton` via prop. `ScheduleTable` propagates its internal state upward via `onDaysChange` callback on every state change (optimistic updates, realtime updates, initial mount). `PublishButton` now derives `draftCount` purely from the `days` prop — no overrides, no ratchets.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create DashboardShell and simplify PublishButton | 8cd0e4a | dashboard-shell.tsx (new), publish-button.tsx |
| 2 | Wire onDaysChange through ScheduleWithRealtime and ScheduleTable | 5d2fc25 | schedule-with-realtime.tsx, schedule-table.tsx, dashboard/page.tsx |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- src/components/schedule/dashboard-shell.tsx: exists
- src/components/schedule/publish-button.tsx: modified, no hasPublished state
- src/components/schedule/schedule-with-realtime.tsx: modified, accepts onDaysChange
- src/components/schedule/schedule-table.tsx: modified, calls onDaysChange via useEffect
- src/app/dashboard/page.tsx: renders DashboardShell
- npx tsc --noEmit: zero errors
- Commits 8cd0e4a and 5d2fc25: verified in git log
