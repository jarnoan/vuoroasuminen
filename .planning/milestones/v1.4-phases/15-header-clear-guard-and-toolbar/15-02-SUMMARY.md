---
phase: 15-header-clear-guard-and-toolbar
plan: "02"
subsystem: schedule-cell
tags: [mobile, touch, ux, clear-guard, pointer-events]
dependency_graph:
  requires: []
  provides: [long-press-clear-guard]
  affects: [schedule-cell]
tech_stack:
  added: []
  patterns:
    - Long-press armed state with pointerdown/pointerup/pointermove/pointercancel
    - Two-phase clear guard: 1s arm + 2s auto-disarm
    - Responsive × visibility: sm:group-hover (desktop) vs isArmed state (mobile)
    - useEffect cleanup for timer refs
key_files:
  created: []
  modified:
    - src/components/schedule/schedule-cell.tsx
decisions:
  - Long-press (1s) arms × button on mobile; touch-action:manipulation eliminates 300ms iOS delay
  - useEffect cleanup added for both armTimerRef and disarmTimerRef (not in plan, added per T-15-04 threat model)
metrics:
  duration: "2 minutes"
  completed: "2026-05-19T18:43:59Z"
  tasks_completed: 1
  files_modified: 1
---

# Phase 15 Plan 02: Long-Press Clear Guard Summary

**One-liner:** Two-step touch clear guard on ScheduleCell — 1s long-press arms the × button, which auto-disarms after 2s; desktop hover behavior unchanged.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Long-press armed state + touch-action on ScheduleCell | 4c198a9 | src/components/schedule/schedule-cell.tsx |

## What Was Built

Modified `ScheduleCell` to prevent accidental clear on touch devices:

- `isArmed` state (useState) and `armTimerRef` / `disarmTimerRef` / `startXRef` / `startYRef` refs (useRef)
- `onPointerDown` starts a 1000ms timer to set `isArmed = true`; if the timer fires, a 2000ms auto-disarm timer starts
- `onPointerUp` and `onPointerCancel` cancel the arm timer (preventing accidental arming on normal taps)
- `onPointerMove` cancels the arm timer if the finger moves more than 8px (prevents arming during scroll)
- × button className uses `sm:opacity-0 sm:group-hover:opacity-100` on desktop (unchanged) and `max-sm:opacity-100` / `max-sm:opacity-0` driven by `isArmed` on mobile
- × onClick clears `isArmed` and cancels `disarmTimerRef` after firing `onClear`
- `touch-action: manipulation` on the cell button eliminates iOS 300ms tap delay
- `aria-label="Tyhjennä"` and `"use client"` preserved

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Add useEffect timer cleanup on unmount**
- **Found during:** Task 1 (threat model review — T-15-04)
- **Issue:** Plan specified timers cleared in `cancelArm()` and × onClick, but neither path covers component unmount. If `ScheduleCell` unmounts while the arm or disarm timer is pending, `setIsArmed` is called on an unmounted component, causing a React state update warning and a timer leak.
- **Fix:** Added `useEffect` with a cleanup function that clears both `armTimerRef` and `disarmTimerRef` on unmount. Also added `useEffect` to the React import.
- **Files modified:** src/components/schedule/schedule-cell.tsx
- **Commit:** 72c4393

## Known Stubs

None — all functionality is fully wired.

## Threat Flags

No new threat surface introduced beyond what the plan's threat model already covers (T-15-03, T-15-04).

## Self-Check

- FOUND: src/components/schedule/schedule-cell.tsx
- FOUND: .planning/phases/15-header-clear-guard-and-toolbar/15-02-SUMMARY.md
- FOUND: commit 4c198a9 (feat: long-press clear guard)
- FOUND: commit 72c4393 (fix: unmount timer cleanup)

## Self-Check: PASSED
