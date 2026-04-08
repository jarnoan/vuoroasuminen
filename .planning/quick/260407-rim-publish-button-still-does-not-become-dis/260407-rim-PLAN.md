---
id: 260407-rim
title: Fix publish button CDC overwrite — button stays enabled after publishing
type: quick
status: pending
created: 2026-04-07
---

# Quick Task 260407-rim: Fix publish button not disabled after publishing

## Objective

After `publishDraft()` succeeds, the Publish button must become disabled immediately
and stay disabled. Currently it re-enables mid-stream because Supabase CDC events
overwrite DashboardShell's optimistic state with ScheduleTable's stale draft data.

## Root Cause

`DashboardShell.handlePublished` updates `DashboardShell.days` optimistically
(draft→published), which immediately disables the button. However, `ScheduleTable`
maintains its OWN internal `days` state (still draft). As CDC events arrive one row
at a time, `ScheduleTable.handleRealtimeEntry` updates its internal state and fires
`onDaysChange(days)` — this overwrites `DashboardShell.days` with partially-draft
data, re-enabling the button.

## Fix

Use the existing `realtimeRef` ref-injection pattern to also mirror the optimistic
update inside `ScheduleTable`. Once `ScheduleTable.days` is all-published, CDC events
for published cells are no-ops and cannot re-introduce draft status.

## Tasks

### Task 1: Thread publishRef through ScheduleTable → ScheduleWithRealtime → DashboardShell

**Files:**
- `src/components/schedule/schedule-table.tsx`
- `src/components/schedule/schedule-with-realtime.tsx`
- `src/components/schedule/dashboard-shell.tsx`

**Action:**

1. **`schedule-table.tsx`**: Add `publishRef?: React.RefObject<(() => void) | null>` to `ScheduleTableProps`. Create `applyPublished` callback that maps draft→published in local `days`. Register it to `publishRef` via `useEffect` mirroring the existing `realtimeRef` registration pattern.

2. **`schedule-with-realtime.tsx`**: Add `publishRef?: React.RefObject<(() => void) | null>` to `ScheduleWithRealtimeProps` and thread it through to `ScheduleTable`.

3. **`dashboard-shell.tsx`**: Create `const publishRef = useRef<(() => void) | null>(null)`. In `handlePublished`, keep the existing `setDays` call (for immediate DashboardShell render) AND add `publishRef.current?.()` to also update ScheduleTable's internal state. Pass `publishRef` to `ScheduleWithRealtime`.

**Verify:** After publishing, draftCount drops to 0 immediately and stays 0 even as CDC events arrive. Making new edits re-enables the button.

**Done:** Single atomic commit covering all three files.
