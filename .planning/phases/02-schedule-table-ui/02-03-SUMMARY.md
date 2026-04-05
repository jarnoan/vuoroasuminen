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
  - NotesCell that syncs realtime value changes without losing active edits
  - Sticky schedule header that remains visible while scrolling
affects: [03-draft-publish, 04-gcal-sync]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Realtime via ref injection: RealtimeProvider calls realtimeRef.current to push updates into sibling ScheduleTable state"
    - "Singleton browser Supabase client: module-level variable prevents duplicate WebSocket connections"
    - "snake_case to camelCase mapping in Realtime payload handler"
    - "Focus-guarded useEffect sync: controlled input syncs external prop changes only when not focused"

key-files:
  created:
    - src/lib/supabase/client.ts
    - src/components/schedule/realtime-provider.tsx
    - src/components/schedule/schedule-with-realtime.tsx
  modified:
    - src/components/schedule/schedule-table.tsx
    - src/components/schedule/notes-cell.tsx
    - src/app/dashboard/page.tsx

key-decisions:
  - "Realtime wired via ref not context — avoids re-render cascade when realtime updates arrive; ScheduleTable remains fully self-contained"
  - "RealtimeProvider uses useRef for callback to avoid unsubscribing/resubscribing on parent re-renders"
  - "Plain createClient (not @supabase/ssr) for browser Realtime — no Supabase Auth used; Auth.js handles auth"
  - "Sticky header requires bounded scroll container: h-[calc(100vh-8rem)] on overflow-y-auto wrapper"
  - "NotesCell syncs incoming value prop via useEffect with isFocusedRef guard — prevents overwriting active user input while accepting realtime updates"

patterns-established:
  - "Realtime ref injection pattern: parent holds ref, child assigns its setState callback to ref.current"
  - "Focus-guarded useEffect sync: controlled input with local state syncs from external prop via useEffect only when isFocusedRef.current === false"

requirements-completed: [SCHED-06]

# Metrics
duration: ~50min
completed: 2026-04-05
---

# Phase 02 Plan 03: Supabase Realtime Sync Summary

**Supabase Realtime wired via postgres_changes on schedule_entries — DB row changes broadcast live to all connected clients, with sticky header and notes sync bugs fixed after human verification**

## Performance

- **Duration:** ~50 min
- **Started:** 2026-04-05T18:35:49Z
- **Completed:** 2026-04-05
- **Tasks:** 2 of 2 completed (1 auto + 1 human-verify with 2 follow-up bug fixes)
- **Files modified:** 6

## Accomplishments

- Singleton Supabase browser client created — one WebSocket connection per browser tab
- RealtimeProvider subscribes to all INSERT/UPDATE events on schedule_entries table
- ScheduleTable extended with realtimeRef prop — incoming DB changes update day/cell state in place
- Dashboard page renders ScheduleWithRealtime, fully wiring the realtime data flow
- Fixed sticky header: scroll container needed `h-[calc(100vh-8rem)]` for `position: sticky` to work inside `overflow-y-auto`
- Fixed notes realtime sync: NotesCell `useState` only initializes once — added `useEffect` with focus guard to sync incoming `value` prop changes from realtime updates

## Task Commits

1. **Task 1: Create Supabase browser client and realtime provider, wire into schedule table** - `f62f6e0` (feat)
2. **Fix: sticky header not working** - `0cd1735` (fix)
3. **Fix: notes realtime sync not working** - `502e4d3` (fix)

## Files Created/Modified

- `src/lib/supabase/client.ts` - Singleton browser Supabase client for Realtime subscriptions
- `src/components/schedule/realtime-provider.tsx` - Subscribes to postgres_changes on schedule_entries, calls onEntryChange callback
- `src/components/schedule/schedule-with-realtime.tsx` - Client wrapper connecting RealtimeProvider to ScheduleTable via ref
- `src/components/schedule/schedule-table.tsx` - Added realtimeRef prop, handleRealtimeEntry, sticky header scroll container fix
- `src/components/schedule/notes-cell.tsx` - Added useEffect + isFocusedRef guard to sync localValue from realtime updates
- `src/app/dashboard/page.tsx` - Imports ScheduleWithRealtime instead of ScheduleTable

## Decisions Made

- Realtime wired via ref injection rather than context or props — avoids triggering re-renders in the provider on every update; ScheduleTable controls its own state
- Used `useRef` in RealtimeProvider for the `onEntryChange` callback (pattern from React docs) — prevents unnecessary unsubscribe/resubscribe cycles when the parent re-renders
- Plain `createClient` from `@supabase/supabase-js` (not `@supabase/ssr`) — correct for browser-only Realtime; `@supabase/ssr` is only needed when Supabase Auth is in use
- Sticky header fix: `position: sticky` requires an ancestor with constrained height + overflow scroll. Without `h-[calc(100vh-8rem)]`, the page scrolls (not the container) and sticky never activates
- Notes sync fix: React `useState` ignores prop changes after mount. The fix is `useEffect` syncing `localValue` from `value` whenever the input is not actively focused by the user

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Sticky header not working — scroll container lacked a bounded height**
- **Found during:** Task 2 (human-verify checkpoint — user report)
- **Issue:** `position: sticky` on `<thead>` requires an ancestor with a constrained height and `overflow-y: auto`. The container had `overflow-y-auto` but no height constraint, so the page itself scrolled and the header never stuck.
- **Fix:** Added `h-[calc(100vh-8rem)]` to the `overflow-y-auto` div wrapping the table.
- **Files modified:** `src/components/schedule/schedule-table.tsx`
- **Verification:** TypeScript passes; sticky header confirmed working by user
- **Committed in:** `0cd1735`

**2. [Rule 1 - Bug] Notes not syncing in realtime — NotesCell local state stale after initial mount**
- **Found during:** Task 2 (human-verify checkpoint — user report)
- **Issue:** `NotesCell` uses `useState(value)` for local state. React only uses the prop as the initial value — subsequent prop changes (from realtime `setDays` updates) are ignored entirely. Parent B's notes input never reflected edits made by Parent A.
- **Fix:** Added `useEffect(() => { if (!isFocusedRef.current) setLocalValue(value) }, [value])` and a `useRef(false)` focus guard — syncs the prop from realtime updates while not overwriting text the user is actively typing.
- **Files modified:** `src/components/schedule/notes-cell.tsx`
- **Verification:** TypeScript passes; notes realtime sync confirmed working by user
- **Committed in:** `502e4d3`

---

**Total deviations:** 2 auto-fixed (both Rule 1 - Bug)
**Impact on plan:** Both fixes necessary for the plan's stated goals (realtime sync for notes, sticky header in verification criteria). No scope creep.

## Issues Encountered

None beyond the two bugs above.

## User Setup Required

**Supabase Realtime must be enabled for the `schedule_entries` table before real-time sync will work.**

Run this SQL in the Supabase SQL editor (Dashboard > SQL Editor):

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE schedule_entries;
```

Or via the Dashboard UI: Database > Replication > toggle `schedule_entries`.

Without this step, the Realtime subscription will connect but will receive no events.

## Known Stubs

None — all functionality is fully wired and verified by human testing.

## Next Phase Readiness

- Realtime foundation complete; any further DB writes (draft/publish in Phase 03) will automatically propagate to other clients
- Phase 03 (draft/publish + stats) can build on top of the existing ScheduleTable and realtime infrastructure without changes to this layer
- Sticky header, notes sync, cell toggle realtime — all confirmed working end-to-end

---
*Phase: 02-schedule-table-ui*
*Completed: 2026-04-05*
