---
phase: 03-draft-publish-statistics
plan: 01
subsystem: ui
tags: [react, shadcn, dialog, server-actions, drizzle, base-ui]

# Dependency graph
requires:
  - phase: 02-schedule-table-ui
    provides: "ScheduleWithRealtime component, DateWindow type, schedule_entries table with status enum"
provides:
  - "publishDraft Server Action bulk-updating draft schedule_entries to published"
  - "PublishButton client component with shadcn/ui Dialog confirmation"
  - "Header children prop slot for right-side action buttons"
  - "shadcn/ui Dialog primitive (base-ui backed)"
affects: [03-draft-publish-statistics, 04-gcal-sync]

# Tech tracking
tech-stack:
  added: ["shadcn/ui Dialog (base-ui/react/dialog backed via canary)"]
  patterns:
    - "Server Component (Header) accepts children prop for client component slot injection"
    - "Draft count derived client-side from already-loaded DateWindow — no extra server query"
    - "publishDraft scoped by getWindowBounds() — same date window as display"

key-files:
  created:
    - src/components/ui/dialog.tsx
    - src/components/schedule/publish-button.tsx
  modified:
    - src/actions/schedule.ts
    - src/components/layout/header.tsx
    - src/app/dashboard/page.tsx

key-decisions:
  - "shadcn/ui canary Dialog uses @base-ui/react/dialog (not Radix) — DialogTrigger uses render prop pattern"
  - "Draft count derived client-side from DateWindow passed as initialData — avoids extra server query"
  - "Header children slot pattern: Server Component stays server-side, client PublishButton injected via children"

patterns-established:
  - "Header children slot: pass client components into Server Component layout via children prop"
  - "publishDraft returns { success: true; count } | { success: false; error } union for toast handling"

requirements-completed: [DRFT-02]

# Metrics
duration: 3min
completed: 2026-04-06
---

# Phase 03 Plan 01: Draft Publish Flow Summary

**Publish button in Header with shadcn/ui Dialog confirmation; publishDraft Server Action bulk-marks all draft entries published within the 84-day window**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-06T08:27:56Z
- **Completed:** 2026-04-06T08:31:02Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- publishDraft Server Action updates all draft schedule_entries to published within the current 84-day window using getWindowBounds(), returns count for toast
- PublishButton client component renders a disabled Publish button when no drafts exist; when drafts exist, opens a shadcn/ui Dialog showing count and date range
- Header converted to accept a children slot, enabling client component injection without breaking Server Component architecture; dashboard passes PublishButton with full schedule data

## Task Commits

Each task was committed atomically:

1. **Task 1: Add publishDraft Server Action and shadcn/ui Dialog** - `0782414` (feat)
2. **Task 2: Create PublishButton client component and wire into Header** - `f76a6b1` (feat)

**Plan metadata:** committed with final docs commit

## Files Created/Modified
- `src/actions/schedule.ts` - Added publishDraft Server Action (scoped to window, returns count)
- `src/components/ui/dialog.tsx` - shadcn/ui Dialog primitive (created via `npx shadcn@canary add dialog`)
- `src/components/schedule/publish-button.tsx` - Client component with Dialog, draft count derivation, toast handling
- `src/components/layout/header.tsx` - Added React import and children prop slot
- `src/app/dashboard/page.tsx` - Added PublishButton import and injection into Header

## Decisions Made
- shadcn/ui canary Dialog uses `@base-ui/react/dialog` (not Radix UI as in stable shadcn). The `DialogTrigger` component uses a `render` prop pattern instead of `asChild`. Adapted PublishButton to use `DialogTrigger render={<Button .../>}` and `DialogClose render={<Button .../>}` for the cancel button.
- Draft count derived client-side from the already-loaded DateWindow `initialData` prop — no additional server query needed since the dashboard already fetches full schedule data.
- Header stays as a Server Component with a `children?: React.ReactNode` slot. This avoids converting Header to client-side while enabling PublishButton (client component) to be passed in from the Dashboard Server Component.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Adapted DialogTrigger and DialogClose to base-ui render prop API**
- **Found during:** Task 2 (PublishButton creation)
- **Issue:** Plan used `<DialogTrigger asChild>` (Radix UI pattern), but installed shadcn/ui canary uses `@base-ui/react/dialog` which uses a `render` prop pattern for composing button elements
- **Fix:** Used `<DialogTrigger render={<Button .../>}>` and `<DialogClose render={<Button .../>}>` instead of `asChild`. Added `showCloseButton={false}` to DialogContent to suppress duplicate close button.
- **Files modified:** src/components/schedule/publish-button.tsx
- **Verification:** TypeScript passes, component structure matches base-ui API
- **Committed in:** f76a6b1 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — API mismatch)
**Impact on plan:** Necessary adaptation to actual installed library API. No scope creep.

## Issues Encountered
- `npm run build` fails with DB connection error during pre-render of `/dashboard` — this is pre-existing (verified by stashing our changes and confirming the same failure). The build environment doesn't have a DB connection available. TypeScript compilation succeeds.

## User Setup Required
None - no external service configuration required for this plan.

## Next Phase Readiness
- publishDraft Server Action is ready; Phase 04 (GCal sync) can hook into publish flow by calling the Calendar API after status update
- PublishButton currently shows "sync to Google Calendar" in the confirmation text, which will be accurate once Phase 04 is complete
- Supabase Realtime is already wired in ScheduleTable — when cells change from draft to published via publishDraft, the CDC events will update cell colors automatically without extra work

---
*Phase: 03-draft-publish-statistics*
*Completed: 2026-04-06*
