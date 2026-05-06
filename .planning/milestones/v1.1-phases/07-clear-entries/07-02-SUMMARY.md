---
plan: "07-02"
phase: "07"
status: complete
completed: 2026-05-06
---

## Summary

Wired single-cell clear interaction into the schedule grid (CLEAR-01).

## What Was Built

- `ScheduleCell` extended with `onClear: (entryId: string) => void` prop and hover/focus `×` button (`opacity-0 group-hover:opacity-100 focus:opacity-100`), `aria-label="Tyhjennä"`, `title="Tyhjennä tämä päivä"`, `e.stopPropagation()` on click
- `ScheduleTable` wired with `handleClear` (optimistic null + revert on failure, calls `clearCell`) and `handleAssignEmpty` (optimistic father assignment + revert, calls `toggleCell(entryId, "father")`)
- Three-way render branch: assigned (`cell.entryId && cell.parentId`) → `<ScheduleCell onClear>`, cleared/empty → `<button>` with `handleAssignEmpty`
- `RealtimeEntry.parentId` widened to `ParentId | null` in `schedule-table.tsx`
- `EntryUpdate.parentId` widened to `ParentId | null` in `schedule-with-realtime.tsx` (Edit 6 — required for CDC propagation of cleared rows)

## Key Files

- `src/components/schedule/schedule-cell.tsx` — `onClear` prop, relative/group wrapper, × button
- `src/components/schedule/schedule-table.tsx` — `handleClear`, `handleAssignEmpty`, updated render branching, import of `clearCell`
- `src/components/schedule/schedule-with-realtime.tsx` — `EntryUpdate.parentId: ParentId | null`

## Verification

- `npx tsc --noEmit` — no errors (deliberate Wave 1 error resolved)
- `npx vitest run` — 241 tests pass

## Self-Check: PASSED
