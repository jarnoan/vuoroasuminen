---
phase: 14-realtime-reliability-mobile-baseline
plan: "02"
subsystem: schedule-realtime, schedule-components
tags: [realtime, visibility, background-recovery, mobile, component-wiring]
dependency_graph:
  requires:
    - 14-01 (getScheduleDays Server Action)
  provides:
    - visibilitychange recovery sequence in RealtimeProvider (D-01–D-05)
    - viewStart threading: DashboardShell → ScheduleWithRealtime → RealtimeProvider
    - onRefresh threading: RealtimeProvider → handleRefresh → setDays
  affects:
    - src/components/schedule/realtime-provider.tsx
    - src/components/schedule/schedule-with-realtime.tsx
    - src/components/schedule/dashboard-shell.tsx
tech_stack:
  added: []
  patterns:
    - visibilitychange listener with cancelled guard at every await point
    - useRef for stable callback references across re-renders (onEntryChangeRef, onRefreshRef)
    - Named payload handler const reused for initial subscribe and recovery re-subscribe
    - Prop threading for optional callbacks and config values through component chain
key_files:
  created: []
  modified:
    - src/components/schedule/realtime-provider.tsx
    - src/components/schedule/schedule-with-realtime.tsx
    - src/components/schedule/dashboard-shell.tsx
decisions:
  - onRefreshRef declared at component scope (alongside onEntryChangeRef), not inside useEffect — matches existing ref pattern and ensures latest callback is captured
  - handlePayload extracted as named const so it can be reused for both initial subscribe and recovery re-subscribe without duplication
  - viewStart captured by closure in handleVisibilityChange (not via ref) — correct because the effect reruns when component remounts (e.g. URL-driven navigation), ensuring fresh viewStart at effect creation time
  - await supabase.removeChannel() in recovery path — awaited form ensures old channel is fully removed before re-subscribing (D-03 anti-pattern avoided)
  - No toast, spinner, or loading state added — D-05 requires silent recovery
metrics:
  duration: "~2 minutes"
  completed: "2026-05-18T05:59:16Z"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
---

# Phase 14 Plan 02: Background Tab Recovery (visibilitychange) Summary

**One-liner:** Wired visibilitychange recovery sequence (removeChannel → getScheduleDays → setDays → setAuth → re-subscribe) into RealtimeProvider and threaded viewStart/onRefresh through the full component chain.

## What Was Built

### Task 1: RealtimeProvider extended with recovery sequence (D-01–D-05)

`src/components/schedule/realtime-provider.tsx` rewritten with:

- **`onRefresh?: (days: ScheduleDay[]) => void`** and **`viewStart?: string`** added to `RealtimeProviderProps`
- **`onRefreshRef`** added at component scope alongside existing `onEntryChangeRef` — keeps the latest callback available without re-running the effect
- **`handlePayload`** extracted as a named const — enables reuse for both initial subscribe and recovery re-subscribe
- **`handleVisibilityChange`** async handler implementing the full recovery sequence:
  1. Guard: exit if `document.hidden` or `cancelled` (visible-only trigger)
  2. `await supabase.removeChannel(channel)` — tear down dead/paused channel; check `cancelled` after
  3. `await getScheduleDays(viewStart)` — re-fetch schedule via Server Action for the correct window; check `cancelled` after
  4. `onRefreshRef.current?.(freshDays)` — deliver fresh data silently (no toast/spinner)
  5. `await supabase.auth.getSession()` — get fresh JWT; check `cancelled || !session?.access_token` after
  6. `supabase.realtime.setAuth(session.access_token)` + re-subscribe with `handlePayload`
- `document.addEventListener("visibilitychange", handleVisibilityChange)` registered inside `useEffect`
- Cleanup return extended to call `document.removeEventListener("visibilitychange", handleVisibilityChange)` before the existing `removeChannel` call

### Task 2: viewStart and onRefresh threaded through ScheduleWithRealtime and DashboardShell

`src/components/schedule/schedule-with-realtime.tsx`:
- `viewStart?: string` added to `ScheduleWithRealtimeProps`
- `viewStart` destructured in component function signature
- `handleRefresh` useCallback added: `(days: ScheduleDay[]) => setDays(days)`, deps `[setDays]`
- `RealtimeProvider` JSX updated to pass `onRefresh={handleRefresh}` and `viewStart={viewStart}`

`src/components/schedule/dashboard-shell.tsx`:
- Single-line change: `viewStart={initialViewStart}` added to the `ScheduleWithRealtime` JSX call
- `initialViewStart` was already in scope from the component's props — no other changes needed

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend RealtimeProvider with visibilitychange recovery | 846344b | src/components/schedule/realtime-provider.tsx |
| 2 | Thread viewStart and onRefresh through ScheduleWithRealtime and DashboardShell | b6980a3 | src/components/schedule/schedule-with-realtime.tsx, src/components/schedule/dashboard-shell.tsx |

## Verification

- `npx tsc --noEmit` → **zero errors** (TypeScript: No errors found)
- `grep -c "visibilitychange" realtime-provider.tsx` → **2** (addEventListener + removeEventListener)
- `grep "getScheduleDays" realtime-provider.tsx` → import line + call line
- `grep "onRefresh={handleRefresh}" schedule-with-realtime.tsx` → 1 match
- `grep "viewStart={initialViewStart}" dashboard-shell.tsx` → 1 match
- Three `cancelled` guards in `handleVisibilityChange`: after removeChannel (line 88), after getScheduleDays (line 92), after getSession (line 97); plus entry guard on line 81

## Threat Model Compliance

| Threat ID | Status |
|-----------|--------|
| T-14-03 (DoS: visibility re-fetch) | Accepted — cheap DB query, two-user app; no rate limiting needed |
| T-14-04 (Spoofing: setAuth token) | Accepted — token from supabase.auth.getSession(), same JWT already held by user |
| T-14-05 (Info Disclosure: onRefresh callback) | Accepted — same ScheduleDay[] data the authenticated user already sees; stays in same browser context |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — the recovery chain is fully wired. When a parent returns to the tab after backgrounding, `handleVisibilityChange` fires, re-fetches via `getScheduleDays`, delivers fresh data to `setDays`, and re-subscribes the Realtime channel with a fresh token.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes beyond the visibilitychange → Server Action path already covered by the plan's threat model.

## Self-Check: PASSED

- [x] `src/components/schedule/realtime-provider.tsx` — modified, committed at 846344b
- [x] `src/components/schedule/schedule-with-realtime.tsx` — modified, committed at b6980a3
- [x] `src/components/schedule/dashboard-shell.tsx` — modified, committed at b6980a3
- [x] All commits verified in git log
- [x] TypeScript: zero errors (full project)
- [x] visibilitychange: 2 occurrences (addEventListener + removeEventListener)
- [x] onRefresh={handleRefresh}: 1 match in schedule-with-realtime.tsx
- [x] viewStart={initialViewStart}: 1 match in dashboard-shell.tsx
