---
phase: 05-view-window-control
plan: "03"
subsystem: ui-components
tags: [react, next.js, client-component, date-fns, react-day-picker, popover, calendar, skeleton, loading]

# Dependency graph
requires:
  - plan: "05-01"
    provides: "initialViewStart prop on page.tsx; validateViewStart pattern"
  - plan: "05-02"
    provides: "src/components/ui/popover.tsx, src/components/ui/calendar.tsx"
provides:
  - src/components/schedule/view-toolbar.tsx (ViewToolbar Client Component)
  - src/app/dashboard/loading.tsx (Next.js loading skeleton)
affects:
  - 05-04-view-window-control (DashboardShell needs to render ViewToolbar and accept initialViewStart prop)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "base-nova PopoverTrigger: render={<Button />} not asChild — @base-ui/react API"
    - "react-day-picker locale: import fi from react-day-picker/locale (not date-fns/locale — different shape)"
    - "Next.js loading.tsx: co-located file auto-wrapped in Suspense boundary; no manual Suspense needed"
    - "navigateTo(null) clears URL param; ScheduleTable mount useEffect handles scroll after RSC re-render"

key-files:
  created:
    - src/components/schedule/view-toolbar.tsx
    - src/app/dashboard/loading.tsx
  modified: []

decisions:
  - "PopoverTrigger uses render={<Button />} pattern — consistent with base-nova (dialog.tsx line 65-71)"
  - "fi locale from react-day-picker/locale — Calendar component uses DayPicker which needs react-day-picker Locale shape"
  - "handleToday clears viewStart only; ScheduleTable's existing mount useEffect handles scroll to today after RSC re-render"
  - "loading.tsx has no imports — pure JSX skeleton; Next.js auto-wraps in Suspense"
  - "weekStartsOn: 1 in all startOfWeek calls — Finnish convention, Monday as week start"

# Metrics
duration: "~5 min"
completed: "2026-05-04"
---

# Phase 5 Plan 03: ViewToolbar and Dashboard Loading Skeleton Summary

**ViewToolbar Client Component with three navigation actions (prev week, date picker, today) and a layout-preserving loading.tsx skeleton for dashboard URL-change re-renders.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-04T20:46:47Z
- **Completed:** 2026-05-04T20:51:00Z
- **Tasks:** 2 (both auto)
- **Files created:** 2 (0 modified)

## Accomplishments

- `ViewToolbar` Client Component — three buttons: Prev week (outline), Valitse päivä (outline, opens Calendar popover), Tänään (default/filled, ml-auto right-aligned)
- `navigateTo(dateStr | null)` — URL param management via `URLSearchParams`, preserves other params; null branch deletes viewStart
- `handlePrevWeek` — computes Monday 7 days before current viewStart (or current week Monday if no viewStart)
- `handleDateSelect` — snaps Calendar selection to Monday of that week before navigating
- `handleToday` — clears viewStart from URL; ScheduleTable's existing mount useEffect handles scroll to today
- PopoverTrigger correctly uses `render={<Button />}` (base-nova API, not Radix `asChild`)
- `fi` locale from `react-day-picker/locale` (not `date-fns/locale` — different shape, would cause TypeScript error)
- `loading.tsx` — three height-matched placeholder rows (h-14, h-10, h-10) + animate-pulse skeleton rows; no imports needed

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create ViewToolbar Client Component | 76cc845 | src/components/schedule/view-toolbar.tsx |
| 2 | Create dashboard loading.tsx skeleton | 348ae73 | src/app/dashboard/loading.tsx |

## Files Created/Modified

- `src/components/schedule/view-toolbar.tsx` — New: 93-line Client Component; exports `ViewToolbar`
- `src/app/dashboard/loading.tsx` — New: 18-line pure JSX skeleton; exports `default function Loading`

## Decisions Made

- **PopoverTrigger render prop:** Used `render={<Button variant="outline" size="sm" />}` — matches base-nova API used in dialog.tsx; `asChild` is the Radix pattern and does not work here
- **fi locale source:** `react-day-picker/locale` provides `Locale` type matching what `DayPicker` expects; `date-fns/locale` exports a different `Locale` shape that would fail TypeScript
- **Tänään does not scroll:** ScheduleTable's `useEffect` on mount scrolls to `[data-date="{todayDate}"]`; clearing viewStart triggers RSC re-render which remounts ScheduleTable, triggering scroll automatically
- **loading.tsx no imports:** Component is pure JSX with className-only styling; Next.js co-location pattern handles Suspense wrapping

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None. ViewToolbar is fully wired to URL navigation. Loading skeleton is intentionally placeholder-only (its purpose is layout height preservation). DashboardShell integration (rendering ViewToolbar) is intentionally deferred to Plan 04.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes introduced.

- T-05-06 mitigated as planned: URLSearchParams.set() URL-encodes values; no manual string concatenation
- T-05-07 accepted as planned: initialViewStart arrives pre-validated from server (page.tsx validateViewStart)
- T-05-08 accepted as planned: loading.tsx skeleton exposes no data

## Self-Check: PASSED

- `src/components/schedule/view-toolbar.tsx` — FOUND
- `src/app/dashboard/loading.tsx` — FOUND
- Commit 76cc845 — FOUND
- Commit 348ae73 — FOUND
- TypeScript: only pre-existing error (initialViewStart on DashboardShell — Plan 04 responsibility)
