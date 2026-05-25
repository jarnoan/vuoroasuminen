---
phase: 18-mobile-cell-and-note-interactions
plan: "01"
subsystem: schedule-cell
tags: [mobile, touch, ux, long-press, vibration, schedule-cell, haptic]
dependency_graph:
  requires: [long-press-clear-guard]
  provides: [full-cell-tyhjennainteraction, haptic-vibration-on-arm]
  affects: [schedule-cell]
tech_stack:
  added: []
  patterns:
    - isHolding state for CSS background-color fade transition over 1s
    - navigator.vibrate feature detection and single-pulse haptic
    - Tailwind v4 arbitrary @media(hover:none) / @media(hover:hover) variants for touch vs pointer split
    - Two-span label pattern for media-query-conditional text rendering
    - Conditional onClick pattern: armed = onClear, idle = onToggle
key_files:
  created: []
  modified:
    - src/components/schedule/schedule-cell.tsx
decisions:
  - "isHolding state drives CSS transition fade (separate from isArmed — simpler than class ref, triggers re-render)"
  - "navigator.vibrate feature-detected via typeof check — covers SSR and browsers without Vibration API"
  - "@media(hover:none) / @media(hover:hover) Tailwind variants replace max-sm: for touch vs pointer split — covers iPad-sized touch screens"
  - "Two-span label pattern (hover-hidden / touch-hidden) chosen over conditional render — cleaner with no extra wrapper"
  - "Corner x button hidden on touch via [@media(hover:none)]:hidden; hover devices keep group-hover opacity"
metrics:
  duration: "3 minutes"
  completed: "2026-05-21T21:43:27Z"
  tasks_completed: 1
  files_modified: 1
---

# Phase 18 Plan 01: Full-Cell Tyhjennä Interaction (UI-04) Summary

**One-liner:** Extends ScheduleCell with isHolding-driven 1s color fade, navigator.vibrate(100) on arm, full-cell red "Tyhjennä" render on touch devices, and @media(hover:none/hover) split preserving desktop corner × behavior.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add isHolding state, vibration, and @media(hover) split for full-cell Tyhjennä | a3322db | src/components/schedule/schedule-cell.tsx |

## What Was Built

Modified `ScheduleCell` to upgrade the Phase 15 long-press clear guard into a full-cell Tyhjennä interaction on touch devices:

- `isHolding` state (boolean, `useState`) added alongside `isArmed` — set true on `pointerdown`, false inside arm-timer callback before `setIsArmed(true)`, and false inside `cancelArm()`. Drives the 1s CSS background-color fade class.
- `handleCellPointerDown` updated: `setIsHolding(true)` called after scheduling the 1000ms arm timer. Inside the timer callback: `setIsHolding(false)` first, then `setIsArmed(true)`, then feature-detected `navigator.vibrate(100)`, then the 2000ms auto-disarm timer.
- `cancelArm()` extended with `setIsHolding(false)` — achieves instant snap-back with no reverse animation by removing the transition class.
- Cell button `className` now uses a three-branch conditional:
  - `isArmed`: `[@media(hover:none)]:bg-destructive [@media(hover:none)]:text-white` + parent colorClass (armed red on touch, parent color on hover)
  - `isHolding && !isArmed`: parent colorClass + `[@media(hover:none)]:[transition:background-color_1s_linear] [@media(hover:none)]:bg-destructive` (1s fade toward red on touch only)
  - idle: `transition-colors` + parent colorClass (normal state)
- Cell button `onClick` is now conditional: when `isArmed`, calls `onClear(entryId)` + resets state + clears `disarmTimerRef`; otherwise calls `onToggle(entryId, newParentId)`.
- Two-span label pattern inside button: `<span class="[@media(hover:hover)]:hidden">{isArmed ? "Tyhjennä" : displayName}</span>` + `<span class="[@media(hover:none)]:hidden">{displayName}</span>` — touch devices see "Tyhjennä" when armed, hover devices always see parent name.
- Corner `×` button: replaced `max-sm:opacity-100/max-sm:opacity-0` with `[@media(hover:none)]:hidden` — fully hidden on touch devices; hover devices keep `opacity-0 group-hover:opacity-100 focus:opacity-100 focus-visible:opacity-100`.
- Phase 15 `useEffect` cleanup (clears both timers on unmount), `armTimerRef`, `disarmTimerRef`, `startXRef`, `startYRef`, and all pointer handler functions preserved unchanged.

## Deviations from Plan

None — plan executed exactly as written. All decisions D-02 through D-08 from CONTEXT.md applied verbatim.

## Known Stubs

None — full-cell Tyhjennä interaction is fully wired to `onClear` prop which flows to the existing `handleClear` Server Action in `schedule-table.tsx`. No placeholder text, hardcoded empty values, or unconnected props.

## Threat Flags

No new threat surface beyond what the plan's `<threat_model>` already covers:
- T-18-01: onClear path reuses existing Server Action wiring — no new mutation surface
- T-18-04: isHolding shares the same armTimerRef lifecycle, covered by existing useEffect cleanup

## Self-Check

- FOUND: src/components/schedule/schedule-cell.tsx
- FOUND: .planning/phases/18-mobile-cell-and-note-interactions/18-01-SUMMARY.md (this file)
- Commit a3322db verified in git log

## Self-Check: PASSED
