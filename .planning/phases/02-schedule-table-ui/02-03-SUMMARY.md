---
phase: 02-schedule-table-ui
plan: 03
subsystem: ui
tags: [supabase, realtime, websocket, postgres-changes, react]

# Dependency graph
requires:
  - phase: 02-schedule-table-ui-plan-01
    provides: ScheduleDay/DateWindow types, getScheduleWindow query
  - phase: 02-schedule-table-ui-plan-02
    provides: ScheduleTable component with useState(initialData.days)
provides:
  - Supabase browser client singleton (createBrowserClient)
  - RealtimeProvider subscribing to postgres_changes on schedule_entries
  - ScheduleWithRealtime wrapper connecting realtime to table state
  - ScheduleTable extended with realtimeRef for external state injection
affects: [03-draft-publish, 04-gcal-sync]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Realtime via ref injection: RealtimeProvider calls realtimeRef.current to push updates into sibling ScheduleTable state"
    - "Singleton browser Supabase client: module-level variable prevents duplicate WebSocket connections"
    - "snake_case to camelCase mapping in Realtime payload handler"

key-files:
  created:
    - src/lib/supabase/client.ts
    - src/components/schedule/realtime-provider.tsx
    - src/components/schedule/schedule-with-realtime.tsx
  modified:
    - src/components/schedule/schedule-table.tsx
    - src/app/dashboard/page.tsx

key-decisions:
  - "Realtime wired via ref not context — avoids re-render cascade when realtime updates arrive; ScheduleTable remains fully self-contained"
  - "RealtimeProvider uses useRef for callback to avoid unsubscribing/resubscribing on parent re-renders"
  - "Plain createClient (not @supabase/ssr) for browser Realtime — no Supabase Auth used; Auth.js handles auth"

patterns-established:
  - "Realtime ref injection pattern: parent holds ref, child assigns its setState callback to ref.current"

requirements-completed: [SCHED-06]

# Metrics
duration: 4min
completed: 2026-04-05
---

# Phase 02 Plan 03: Supabase Realtime Sync Summary

**Supabase Realtime wired via postgres_changes on schedule_entries — DB row changes broadcast to all connected clients via WebSocket without polling**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-05T18:35:49Z
- **Completed:** 2026-04-05T18:39:00Z
- **Tasks:** 1 of 2 completed (Task 2 is checkpoint:human-verify)
- **Files modified:** 5

## Accomplishments
- Singleton Supabase browser client created — one WebSocket connection per browser tab
- RealtimeProvider subscribes to all INSERT/UPDATE events on schedule_entries table
- ScheduleTable extended with realtimeRef prop — incoming DB changes update day/cell state in place
- Dashboard page now renders ScheduleWithRealtime, fully wiring the realtime data flow

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Supabase browser client and realtime provider, wire into schedule table** - `f62f6e0` (feat)

## Files Created/Modified
- `src/lib/supabase/client.ts` - Singleton browser Supabase client for Realtime subscriptions
- `src/components/schedule/realtime-provider.tsx` - Subscribes to postgres_changes on schedule_entries, calls onEntryChange callback
- `src/components/schedule/schedule-with-realtime.tsx` - Client wrapper connecting RealtimeProvider to ScheduleTable via ref
- `src/components/schedule/schedule-table.tsx` - Added realtimeRef prop, handleRealtimeEntry callback, useEffect to assign callback to ref
- `src/app/dashboard/page.tsx` - Imports ScheduleWithRealtime instead of ScheduleTable

## Decisions Made
- Realtime wired via ref injection rather than context or props — avoids triggering re-renders in the provider on every update; ScheduleTable controls its own state
- Used `useRef` in RealtimeProvider for the `onEntryChange` callback (pattern from React docs) — prevents unnecessary unsubscribe/resubscribe cycles when the parent re-renders
- Plain `createClient` from `@supabase/supabase-js` (not `@supabase/ssr`) — correct for browser-only Realtime; `@supabase/ssr` is only needed when Supabase Auth is in use

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**Supabase Realtime must be enabled for the `schedule_entries` table before real-time sync will work.**

Run this SQL in the Supabase SQL editor (Dashboard > SQL Editor):

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE schedule_entries;
```

Or via the Dashboard UI: Database > Replication > toggle `schedule_entries`.

Without this step, the Realtime subscription will connect but will receive no events.

## Known Stubs

None — Task 1 is fully wired. Task 2 is a human verification checkpoint.

## Next Phase Readiness
- Realtime foundation complete; any further DB writes (draft/publish in Phase 03) will automatically propagate to other clients
- Phase 03 (draft/publish + stats) can build on top of the existing ScheduleTable and realtime infrastructure without changes to this layer

---
*Phase: 02-schedule-table-ui*
*Completed: 2026-04-05*
