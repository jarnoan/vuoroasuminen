---
phase: 16-schedule-table-reflow-and-stats
plan: "02"
subsystem: schedule-ui
tags: [mobile, responsive, schedule-table, stats-panel, tailwind, react]
dependency_graph:
  requires: []
  provides: [schedule-table-mobile-reflow, stats-panel-sibling-position]
  affects: [schedule-with-realtime, schedule-table]
tech_stack:
  added: []
  patterns: [max-sm:hidden, sm:overflow-y-auto, sticky-column, conditional-second-row-tr, notesOpenDates-state]
key_files:
  created: []
  modified:
    - src/components/schedule/schedule-table.tsx
    - src/components/schedule/schedule-with-realtime.tsx
decisions:
  - "Sticky date column uses bg-background with data-[today=true] conditional overrides so today row remains yellow on the frozen first column"
  - "notesOpenDates uses Set<string> keyed by day.date to track per-row open state; collapses on empty-save"
  - "Fragment wrapper dropped from ScheduleTable return — div returned directly after renderAbove removal"
  - "colSpan={colCount} reused for second-row notes td — hidden notes column does not affect layout (Pattern 4)"
metrics:
  duration: "4 minutes"
  completed: "2026-05-20"
  tasks_completed: 3
  files_modified: 2
---

# Phase 16 Plan 02: Schedule Table Mobile Reflow Summary

**One-liner:** Mobile-first schedule table reflow with sm:overflow-y-auto scroll scope, hidden notes column, sticky date column, conditional second-row notes layout with PlusIcon affordance, and StatsPanel moved to sibling position outside the scroll container.

## What Was Built

Restructured `ScheduleTable` to fit 360–430px viewports without horizontal scrolling and moved `StatsPanel` out of the scroll container into a sibling position in `ScheduleWithRealtime`.

### Task 1: Scroll container + column widths + sticky date column + notes column hidden on mobile

**Commit:** afd3608

Changes to `src/components/schedule/schedule-table.tsx`:
- Replaced `overflow-y-auto h-[calc(100vh-8rem)]` with `sm:overflow-y-auto sm:h-[calc(100svh-8rem)]` — removes mobile height constraint so page scrolls naturally; desktop retains contained scroll with iOS Safari svh fix
- Added `sticky left-0 z-10 bg-background` to Päivä `<th>` for frozen first column
- Added `sticky left-0 bg-background data-[today=true]:bg-yellow-50 dark:data-[today=true]:bg-yellow-950/20` to date `<td>` with `data-today` attribute so today row remains yellow on the sticky cell
- Changed child column min-width from `min-w-[90px]` to `min-w-[72px] sm:min-w-[90px]`
- Added `max-sm:hidden` to notes `<th>` and notes `<td>` in the main day row
- iOS sticky check: no `overflow-hidden` ancestor present — clean

### Task 2: Two-row notes layout on mobile with PlusIcon add-notes affordance

**Commit:** a6a320d

Changes to `src/components/schedule/schedule-table.tsx`:
- Added `PlusIcon` import from `lucide-react` and `useState` to React imports
- Added `const [notesOpenDates, setNotesOpenDates] = useState<Set<string>>(new Set())` state
- Inserted mobile-only second `<tr className="max-sm:table-row sm:hidden">` after each main day row, rendered when `day.notes || notesOpenDates.has(day.date)`, containing `NotesCell` with `colSpan={colCount}` 
- Second-row `NotesCell` onSave removes `day.date` from `notesOpenDates` when notes are cleared (collapse-on-empty)
- Added mobile-only `<td className="px-1 py-1 max-sm:table-cell sm:hidden">` with PlusIcon button that sets `notesOpenDates` to reveal the second row; `style={{ touchAction: "manipulation" }}` applied
- `data-today` kept only on main `<tr>`; auto-scroll selector unaffected
- Desktop single-row layout unchanged

### Task 3: Remove renderAbove and move StatsPanel to sibling position

**Commit:** cbb4187

Changes to `src/components/schedule/schedule-table.tsx`:
- Removed `renderAbove?: (days: ScheduleDay[]) => React.ReactNode` from `ScheduleTableProps` interface
- Removed `renderAbove` from component destructuring
- Removed `{renderAbove?.(days)}` call site; dropped fragment wrapper — component now returns `<div>` directly

Changes to `src/components/schedule/schedule-with-realtime.tsx`:
- Removed `renderAbove={(days) => <StatsPanel days={days} parents={parents} />}` prop from `<ScheduleTable>` call
- Added `<StatsPanel days={days} parents={parents} />` as sibling after `</ScheduleTable>` inside `<RealtimeProvider>`
- Both files updated atomically to avoid transient TypeScript errors (Pitfall 4)
- `StatsPanel` import retained unchanged

## Verification Results

- `npx tsc --noEmit`: PASS (0 errors across both files)
- `npx vitest run`: PASS (6 test files, 47 tests, no regressions)
- `grep renderAbove src/components/schedule/`: empty — fully removed
- `grep overflow-hidden src/components/schedule/schedule-table.tsx`: empty — iOS sticky clean
- `sm:overflow-y-auto sm:h-[calc(100svh-8rem)]`: present exactly once
- `max-sm:hidden`: 2 occurrences (notes `<th>` and main row notes `<td>`)
- `StatsPanel` renders as sibling after `ScheduleTable` inside `RealtimeProvider`: confirmed
- `dashboard-shell.tsx` not modified: confirmed

## Deviations from Plan

### Auto-fixed Issues

None.

### Notes

The automated verify check for `notesOpenDates` references (`grep -c 'notesOpenDates' | awk ... if $1 < 4`) reported count=3 because `grep -c` counts matching lines, and the declaration line `const [notesOpenDates, setNotesOpenDates] = ...` contains both identifiers on a single line. All acceptance criteria text is satisfied: declaration present, `.has()` used twice, `.add()` used once, `.delete()` used once — only the line-counting script was slightly off. No code change was needed; the implementation is correct.

## Known Stubs

None. All changes are complete implementations with no placeholder values or TODO items.

## Threat Flags

No new security surface introduced. Phase 16 is rendering-only — no new Server Actions, no schema changes, no auth/session changes, no new packages. The second-row `NotesCell` calls the same `handleNoteSave` → `saveNotes` Server Action that the desktop `NotesCell` already uses. No new input surface; same Zod validation applies.

## Self-Check

- [x] `src/components/schedule/schedule-table.tsx` modified and committed (afd3608, a6a320d, cbb4187)
- [x] `src/components/schedule/schedule-with-realtime.tsx` modified and committed (cbb4187)
- [x] `renderAbove` completely removed from both files
- [x] TypeScript passes
- [x] Full vitest suite passes

## Self-Check: PASSED
