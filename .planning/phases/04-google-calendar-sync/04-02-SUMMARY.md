---
phase: 04-google-calendar-sync
plan: 04-02
title: GCal Sync Observability and UI Failure Feedback
subsystem: gcal-sync
tags: [observability, logging, toast, publish-button, gcal-sync]
status: complete

dependency_graph:
  requires: [syncCalendarsAfterPublish, SyncResult type, publishDraft syncResult return field]
  provides: [server-side GCal sync logs, client-side sync failure warning toast]
  affects: [src/lib/gcal/sync.ts, src/actions/schedule.ts, src/components/schedule/publish-button.tsx]

tech_stack:
  added: []
  patterns:
    - "console.log with [GCal sync] prefix for grep-able server logs"
    - "toast.warning with duration:10000 for sync failure visibility"
    - "Best-effort sync pattern: success toast always fires, warning toast only when syncResult.success is false"

key_files:
  created: []
  modified:
    - src/lib/gcal/sync.ts
    - src/actions/schedule.ts
    - src/components/schedule/publish-button.tsx

decisions:
  - "Use [GCal sync] prefix on all console.log statements for consistent grep-ability"
  - "10s toast duration for sync failure warning — long enough to read the error message"
  - "Warning toast is separate from success toast — DB publish and GCal sync are independent (D-05)"

metrics:
  duration_minutes: 8
  completed_date: "2026-04-12"
  tasks_completed: 2
  tasks_total: 2
  files_created: 0
  files_modified: 3
---

# Phase 04 Plan 02: GCal Sync Observability and UI Failure Feedback Summary

## One-liner

Added structured console.log observability to the GCal sync path and wired syncResult into a client-side warning toast so sync failures are visible without rolling back the DB publish.

## What Was Built

### Task 1 — Server-side logging to GCal sync path (commit: c8ff9e4)

Added 6 `console.log` statements in `src/lib/gcal/sync.ts` and 1 in `src/actions/schedule.ts`:

- `syncCalendarsAfterPublish()`:
  - Logs published entry count after window query
  - Logs early-return path when no published entries found
  - Logs final `{ success, parentResults }` JSON after `Promise.allSettled` completes

- `syncParentCalendar()`:
  - Logs per-parent entry count before reconciliation starts
  - Logs orphaned event delete count after Step 1 cleanup
  - Logs new event create count after Step 2 create loop

- `publishDraft()` in `src/actions/schedule.ts`:
  - Logs full `syncResult` JSON (both success and fallback error paths)

All statements use the `[GCal sync]` prefix for grep-ability (`grep "[GCal sync]"` returns all sync logs).

### Task 2 — Surface GCal sync failures as warning toast (commit: 10b30e6)

Modified `handlePublish` in `src/components/schedule/publish-button.tsx`:

- After the existing `toast.success` for DB publish, reads `result.syncResult`
- If `syncResult.success` is false, filters `parentResults` for entries with `error` field
- Shows `toast.warning` listing failed parent IDs and error messages
- 10-second duration so the warning stays visible long enough to read
- Success toast always fires; warning is additive and independent

## Verification

- `npx tsc --noEmit` — passed, 0 errors
- `npm run build` — passed, Next.js production build succeeded
- `grep -c "console.log" src/lib/gcal/sync.ts` → 6 (plan required 5+)
- `grep "console.log.*syncResult" src/actions/schedule.ts` → 1 match
- `grep "syncResult" src/components/schedule/publish-button.tsx` → 2 matches (read and acted on)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None introduced in this plan.

## Self-Check

Files exist:
- [x] src/lib/gcal/sync.ts (modified)
- [x] src/actions/schedule.ts (modified)
- [x] src/components/schedule/publish-button.tsx (modified)

Commits exist:
- [x] c8ff9e4 — Task 1: server-side observability logging
- [x] 10b30e6 — Task 2: UI warning toast for sync failures

## Self-Check: PASSED
