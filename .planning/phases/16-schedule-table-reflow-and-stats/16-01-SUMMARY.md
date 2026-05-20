---
phase: 16-schedule-table-reflow-and-stats
plan: "01"
subsystem: schedule-ui
tags: [stats-panel, mobile, responsive, html-table, grid-layout]
dependency_graph:
  requires: []
  provides: [stats-panel-child-column-grid]
  affects: [schedule-with-realtime]
tech_stack:
  added: []
  patterns: [html-table-for-tabular-stats, colSpan-for-spanning-rows, mt-4-below-table]
key_files:
  created: []
  modified:
    - src/components/schedule/stats-panel.tsx
decisions:
  - "Used HTML <table> over CSS grid for stats layout — provides natural column alignment and correct colSpan semantics without dynamic inline style computation"
  - "Removed parentName helper — parent display names read directly from stats.parentFreeStats[*].parentName with fallback"
  - "stats.childStats.map used 3 times: thead column headers + father row td + mother row td"
metrics:
  duration: "69s"
  completed: "2026-05-20T05:44:58Z"
  tasks_completed: 1
  tasks_total: 1
  files_changed: 1
---

# Phase 16 Plan 01: StatsPanel Child-Column Grid Summary

HTML `<table>` replaces the flex-row stats layout — children as columns, parents as rows, with per-child custody count and solo-days sub-line, a separator, and full-width Vapaa rows per parent.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Redesign StatsPanel as child-column HTML table grid | 2e07d44 | src/components/schedule/stats-panel.tsx |

## What Was Built

Replaced the horizontal `flex items-center gap-4` layout in `StatsPanel` with an HTML `<table className="w-full">` structured as a child-column grid:

- **`<thead>`**: empty label `<th>` + one `<th>` per child from `stats.childStats.map`
- **Father `<tr>`**: `text-blue-700` label td (parent name from `stats.parentFreeStats.find(father)`) + per-child `<td>` with `{child.father} pv` on line 1 and `<div className="text-xs text-muted-foreground">yksin {child.soloFather}</div>` on line 2
- **Mother `<tr>`**: same structure with `text-rose-700` and mother's data
- **Separator `<tr>`**: `<td colSpan={stats.childStats.length + 1}>` containing `<div className="border-t" />`
- **Vapaa rows**: `stats.parentFreeStats.map` — one full-width `<tr>` per parent with colSpan spanning all columns, colored blue/rose per parentId

Outer container changed from `mb-4` to `mt-4` (StatsPanel now rendered below the schedule table per D-18). `space-y-1` removed (no longer needed with table layout). The unused `parentName` helper removed.

`computeStats()` and `src/lib/schedule/stats.ts` are untouched.

## Deviations from Plan

None — plan executed exactly as written. The PATTERNS.md target structure was followed precisely.

## Verification

- `npx tsc --noEmit`: passes (0 errors)
- `npx vitest run src/lib/schedule/__tests__/stats.test.ts`: 6/6 tests pass
- `git diff --name-only src/lib/schedule/stats.ts`: empty (untouched)
- All acceptance criteria checked: `<table` once, `mt-4` present, `mb-4` absent, `stats.childStats.map` 3x, `stats.parentFreeStats.map` 1x, `colSpan={stats.childStats.length + 1}` 2x, `text-xs text-muted-foreground` 2x, `text-blue-700` and `text-rose-700` both present, no `flex items-center gap-4`, no `parentName` helper

## Known Stubs

None — the table renders live data from `computeStats(days, parents)` via the existing `useMemo` hook, same data source as before.

## Threat Flags

None — pure rendering change; no new input surfaces, no new data flows, no authentication changes.

## Self-Check: PASSED

- `src/components/schedule/stats-panel.tsx` exists: FOUND
- Commit 2e07d44 exists: FOUND
- `src/lib/schedule/stats.ts` unmodified: CONFIRMED
