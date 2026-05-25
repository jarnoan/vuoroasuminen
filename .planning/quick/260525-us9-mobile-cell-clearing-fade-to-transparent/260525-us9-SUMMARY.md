---
phase: quick
plan: 260525-us9
subsystem: schedule-ui
tags: [mobile, gesture, ux, schedule-cell]
dependency_graph:
  requires: []
  provides: [hold-to-clear-gesture]
  affects: [schedule-cell]
tech_stack:
  added: []
  patterns: [hold-to-fade-opacity-transition, pointer-events]
key_files:
  created: []
  modified:
    - src/components/schedule/schedule-cell.tsx
decisions:
  - "Opacity fade applied via inline style (not Tailwind) because transition duration must be dynamic (2s linear)"
  - "isArmed + disarmTimerRef removed entirely — new mechanic has single timer, single outcome"
  - "displayName shown always in both pointer-media spans — no conditional label needed"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-25"
  tasks_completed: 1
  tasks_total: 1
  files_changed: 1
---

# Quick Task 260525-us9: Mobile Cell Clearing — Fade to Transparent Summary

**One-liner:** Replaced two-step armed-tap clear with single 2-second hold-to-fade-and-autoclear gesture on mobile, using inline opacity transition and navigator.vibrate on completion.

## What Was Done

Rewrote the mobile long-press mechanic in `ScheduleCell`. The previous implementation required a 1-second hold to "arm" the cell (showing "Tyhjennä"), then a second tap to confirm the clear. The new mechanic:

1. `pointerdown` starts a 2000ms timer and sets `isHolding=true`
2. While holding, the cell fades from `opacity: 1` to `opacity: 0` via inline `transition: opacity 2s linear`
3. At 2 seconds: `onClear(entryId)` fires, `navigator.vibrate(100)` fires, `isHolding` resets
4. `pointerup` / `pointercancel` / movement > 8px: cancels the timer and snaps opacity back to 1
5. Short taps (resolved via `onClick`): still toggle parent assignment as before

State removed: `isArmed`, `disarmTimerRef`. State kept: `isHolding`, `armTimerRef`.

The "Tyhjennä" text was removed from the coarse-pointer span — `displayName` is shown always. The desktop × clear button (pointer:fine only) is unchanged.

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Rewrite mobile clear gesture to hold-to-fade-and-autoclear | 0d873dd | src/components/schedule/schedule-cell.tsx |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — rendering-layer change only, no new network endpoints or auth paths.

## Self-Check: PASSED

- `src/components/schedule/schedule-cell.tsx` exists and contains the new implementation
- Commit `0d873dd` exists in git log
- `npx tsc --noEmit` exits 0
- No `isArmed`, no `disarmTimerRef`, no "Tyhjennä" in coarse-pointer span
- `onClear(entryId)` called inside `setTimeout` at 2000ms
- `navigator.vibrate(100)` called in same callback
- Opacity inline style present with `transition: opacity 2s linear` when holding
