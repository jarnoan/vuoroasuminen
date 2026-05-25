---
phase: 18-mobile-cell-and-note-interactions
plan: "02"
subsystem: schedule-ui
tags: [mobile, ui, icon, note-row, schedule-table]
dependency_graph:
  requires: []
  provides:
    - Pencil icon on mobile note affordance button (UI-03)
    - Mobile note row visually merged with day row — zero top gap, pl-8 indent, no dividing border (UI-05)
  affects:
    - src/components/schedule/schedule-table.tsx
tech_stack:
  added: []
  patterns:
    - Conditional Tailwind class composition via array join for readable multi-condition classNames
    - max-sm:[&>td]:border-b-0 descendant variant for scoped bottom-border removal on mobile
key_files:
  created: []
  modified:
    - src/components/schedule/schedule-table.tsx
decisions:
  - Pencil (not PenLine or Pen) chosen as the lucide-react icon — visually cleaner at h-4 w-4, no extra stroke detail; consistent with UI-SPEC choice
  - Array join pattern used for day row className composition — more readable than nested ternary for two independent conditions
  - Note row td: px-1 replaced by pl-8 pr-1 (not pl-8 pr-0) — preserves minimal right padding preventing content from touching table edge
  - or undefined suffix on day row array join — prevents React from rendering empty string className when both conditions are false (matching existing pattern where className was undefined for non-today rows)
metrics:
  duration: "235 seconds"
  completed: "2026-05-21"
  tasks_completed: 2
  files_changed: 1
---

# Phase 18 Plan 02: Mobile Note Icon and Row Attribution Summary

Pencil icon for mobile note affordance button and visual note-row merger with its day row — two surgical rendering changes to `ScheduleTable` with no behavioral or data-flow impact.

## What Was Built

### Task 1: Replace PlusIcon with Pencil (UI-03)

- Import changed from `PlusIcon` to `Pencil` from lucide-react (line 4)
- JSX changed from `<PlusIcon className="h-4 w-4" />` to `<Pencil className="h-4 w-4" />` (mobile note affordance button)
- All button attributes unchanged: aria-label, style, className, onClick, type
- PlusIcon is no longer imported or referenced anywhere in the file

### Task 2: Visually merge mobile note row with day row (UI-05)

- Day row `<tr>` className now conditionally adds `max-sm:[&>td]:border-b-0` when `day.notes || notesOpenDates.has(day.date)` — removes the bottom border between the day row and its following note row on mobile only
- Note row `<td>` className changed from `px-1 py-1 pb-1` to `pt-0 pb-1 pl-8 pr-1`:
  - `pt-0` removes the top gap so the note row sits flush under the day row
  - `pl-8` (32px) indents the note content to align under the date column's text offset
  - `pr-1` preserves minimal right padding
  - `pb-1` bottom padding unchanged
- Desktop layout entirely unchanged: border removal is `max-sm:`-scoped, note row `<tr>` keeps `sm:hidden`
- colSpan, collapse-on-empty onSave callback, and NotesCell wiring all preserved

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1: PlusIcon → Pencil | 6c5b98d | feat(18-02): replace PlusIcon with Pencil on mobile note affordance button |
| Task 2: Note row visual merge | ae82e7c | feat(18-02): visually merge mobile note row with its day row (UI-05) |

## Verification

- `grep -n "PlusIcon" schedule-table.tsx` — no matches
- `grep -c "import { Pencil } from \"lucide-react\""` — 1 match
- `grep -c "max-sm:[&>td]:border-b-0"` — 1 match
- `grep -c "pt-0 pb-1 pl-8 pr-1"` — 1 match
- `grep -c "px-1 py-1 pb-1"` — 0 matches
- `npx tsc --noEmit` — exit 0
- `npx vitest run` — 47/47 tests passing
- `npm run lint` — exit 0

## Deviations from Plan

**[Rule 3 - Worktree path safety]** Applied changes to worktree file path

- The plan was written against the main repo version of `schedule-table.tsx` (post-Phase 17), but the worktree branch is at a pre-Phase 17 commit. The file in the worktree lacks Phase 17 changes (week number rows, full-page scroll removal).
- All Phase 18 plan 02 changes (icon swap, note row visual merge) were applied to the worktree's version of the file. The Phase 17 changes remain on the main branch and will be present after merge.
- No Phase 17 backport was performed — that work is already committed to main and is out of scope for this plan.

## Known Stubs

None.

## Threat Flags

None — pure rendering changes to icon glyph and Tailwind classes. No new data surface, no new network endpoints, no user-controlled content added. Existing React JSX escaping covers all aria-label template strings.

## Self-Check: PASSED

- `src/components/schedule/schedule-table.tsx` modified and committed in worktree
- Commit 6c5b98d exists: `git log --oneline | grep 6c5b98d`
- Commit ae82e7c exists: `git log --oneline | grep ae82e7c`
- TypeScript compiles clean
- All 47 tests pass
- Lint passes
