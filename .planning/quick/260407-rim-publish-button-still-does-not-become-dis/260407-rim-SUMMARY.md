---
id: 260407-rim
title: Fix publish button CDC overwrite — button stays enabled after publishing
type: quick
status: complete
created: 2026-04-07
completed: 2026-04-07
commit: 663efae
tags: [bug-fix, realtime, publish, cdc, ref-injection]
key-files:
  modified:
    - src/components/schedule/schedule-table.tsx
    - src/components/schedule/schedule-with-realtime.tsx
    - src/components/schedule/dashboard-shell.tsx
decisions:
  - publishRef uses same ref-injection pattern as realtimeRef — consistent, no context, no prop drilling
---

# Quick Task 260407-rim: Fix publish button CDC overwrite

## One-liner

Added `publishRef` using the existing ref-injection pattern so `ScheduleTable`'s internal days are marked published before CDC events arrive, preventing partial-draft overwrites that re-enabled the Publish button.

## Root Cause Confirmed

`DashboardShell.handlePublished` updated `DashboardShell.days` optimistically, disabling the button. However `ScheduleTable` maintained its own `days` (still draft). As Supabase CDC events arrived row-by-row, `ScheduleTable.handleRealtimeEntry` updated its internal state and fired `onDaysChange(days)` — overwriting `DashboardShell.days` with partially-draft data and re-enabling the button.

## Fix Applied

Threaded a `publishRef: React.RefObject<(() => void) | null>` from `DashboardShell` through `ScheduleWithRealtime` into `ScheduleTable`. Inside `ScheduleTable`, an `applyPublished` callback (maps draft → published in local `days`) is registered to `publishRef` via `useEffect`, mirroring the existing `realtimeRef` registration pattern. `DashboardShell.handlePublished` now calls both `setDays` (its own state) and `publishRef.current?.()` (ScheduleTable's state). Once ScheduleTable's days are all-published, CDC events for those cells are no-ops.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Thread publishRef through ScheduleTable → ScheduleWithRealtime → DashboardShell | 663efae | schedule-table.tsx, schedule-with-realtime.tsx, dashboard-shell.tsx |

## Deviations from Plan

None — plan executed exactly as written. The ref-injection pattern, type signatures, and useEffect cleanup all matched the specification.

## Known Stubs

None.

## Self-Check: PASSED

- Commit 663efae exists: confirmed
- All three files modified: confirmed
- TypeScript: 0 errors (`npx tsc --noEmit` clean)
