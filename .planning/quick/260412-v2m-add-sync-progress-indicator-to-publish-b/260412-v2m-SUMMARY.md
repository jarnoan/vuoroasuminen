---
phase: quick-260412-v2m
plan: 01
subsystem: schedule/gcal
tags: [ux, progress-indicator, server-actions, gcal-sync]
dependency_graph:
  requires: [gcal-sync]
  provides: [split-publish-actions, sync-progress-ui]
  affects: [publish-button, schedule-actions]
tech_stack:
  added: []
  patterns: [phase-state-machine, css-width-transition-progress-bar]
key_files:
  created: []
  modified:
    - src/actions/schedule.ts
    - src/components/schedule/publish-button.tsx
decisions:
  - publishDraft split into publishSchedule (DB only) + syncCalendars (GCal only) for sequential UI phase control
  - estimatedSyncMs = draftCount × 220ms + 3s overhead, capped at 60s — matches observed 110ms/entry × 2 parents
  - ProgressBar uses requestAnimationFrame to trigger CSS width transition from 0% to 100% over estimated duration
metrics:
  duration: 5m
  completed: 2026-04-12
  tasks: 2
  files: 2
---

# Quick Task 260412-v2m: Add Sync Progress Indicator to Publish Button

**One-liner:** Split `publishDraft` into two sequential server actions and added a CSS-animated progress bar to the publish dialog that fills over the estimated GCal sync duration (~28s for 252 entries).

## What Was Done

### Task 1: Split publishDraft into publishSchedule + syncCalendars (b8fdfd9)

`src/actions/schedule.ts` now exports two focused server actions:

- `publishSchedule()` — DB update only; returns `{ success: true; count: number } | { success: false; error: string }`
- `syncCalendars()` — GCal sync only; returns `SyncResult`; keeps best-effort try/catch and console.log observability

`publishDraft` removed entirely.

### Task 2: Two-phase progress UI in PublishButton (ffc09a2)

`src/components/schedule/publish-button.tsx` now uses a three-state phase machine:

- `"idle"` — normal state; Confirm and Cancel both enabled
- `"publishing"` — DB update in flight; button shows "Publishing...", Cancel disabled
- `"syncing"` — GCal sync in flight; dialog footer replaced by animated progress bar + label

Progress bar is a pure CSS width transition (`0% → 100%` over `estimatedSyncMs`), triggered via `requestAnimationFrame` on mount so the animation starts immediately when the syncing phase begins.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check

- [x] `src/actions/schedule.ts` exports `publishSchedule` and `syncCalendars`; no `publishDraft`
- [x] `src/components/schedule/publish-button.tsx` imports from the two new actions
- [x] `npx tsc --noEmit` passes with no errors
- [x] Commits b8fdfd9 and ffc09a2 exist
