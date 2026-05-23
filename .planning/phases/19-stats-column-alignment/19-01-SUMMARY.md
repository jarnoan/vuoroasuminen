---
phase: 19-stats-column-alignment
plan: "01"
subsystem: schedule-ui
tags: [css, layout, stats-panel, column-alignment, tailwind]
dependency_graph:
  requires: []
  provides: [stats-panel-column-alignment]
  affects: [src/components/schedule/stats-panel.tsx]
tech_stack:
  added: []
  patterns: [table-layout-fixed, colgroup-col, responsive-min-width]
key_files:
  created: []
  modified:
    - src/components/schedule/stats-panel.tsx
decisions:
  - "Use table-layout: fixed with colgroup + min-width classes (not CSS grid or subgrid) — consistent with existing HTML table semantics in StatsPanel; avoids layout mode mismatch between ScheduleTable and StatsPanel"
  - "Remove horizontal padding (p-3 → py-3) from wrapper div so StatsPanel table fills the same horizontal extent as ScheduleTable — horizontal padding would narrow the table relative to ScheduleTable, preventing true column alignment"
metrics:
  duration: "2 minutes"
  completed: "2026-05-23"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 1
---

# Phase 19 Plan 01: Stats Column Alignment — StatsPanel CSS Changes Summary

StatsPanel now uses `table-layout: fixed` with a `<colgroup>`, matching `min-w-[72px] sm:min-w-[90px]` on child columns and `px-3` on the label column, aligning structurally with ScheduleTable child columns above it.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Apply table-layout:fixed and matching column widths to StatsPanel | 6f3b235 | src/components/schedule/stats-panel.tsx |

## What Changed

### Task 1: Apply table-layout:fixed and matching column widths to StatsPanel

**File:** `src/components/schedule/stats-panel.tsx`

Changes applied per UI-SPEC.md Layout Alignment Contract and plan action steps:

1. **Wrapper div:** `p-3` replaced with `py-3` — removes horizontal padding so StatsPanel's `<table>` occupies the same horizontal extent as ScheduleTable inside their shared parent (`RealtimeProvider` in `schedule-with-realtime.tsx`).

2. **`<table>` element:** Added `style={{ tableLayout: "fixed" }}` — with fixed layout the browser honors declared widths on cells (min-w classes) rather than content-driven sizing.

3. **`<colgroup>` inserted:** One `<col />` for the label column plus N `<col key={child.childName} />` elements mapped from `stats.childStats` — declares the column structure for fixed layout.

4. **Label `<th>`:** `pr-2` replaced with `px-3` — matches ScheduleTable date column horizontal padding (`px-3`).

5. **Child header `<th>`:** `px-2` replaced with `px-1 min-w-[72px] sm:min-w-[90px]` — exact class match to ScheduleTable child column `<th>`.

6. **Father label `<td>`:** `pr-2` replaced with `px-3` — matches ScheduleTable date `<td>` horizontal padding.

7. **Mother label `<td>`:** `pr-2` replaced with `px-3` — same as father.

8. **Father child `<td>` elements:** `px-2` replaced with `px-1 min-w-[72px] sm:min-w-[90px]` — exact class match to ScheduleTable child `<td>`.

9. **Mother child `<td>` elements:** `px-2` replaced with `px-1 min-w-[72px] sm:min-w-[90px]` — same as father.

10. **Separator row, Vapaa rows:** Unchanged — both use `colSpan={stats.childStats.length + 1}` and correctly span all columns.

All existing data bindings (`computeStats`, `useMemo`), all colors (`text-blue-700`, `text-rose-700`, `text-muted-foreground`), all copy ("pv", "yksin", parent names, "vkl"), and component imports are preserved unchanged.

## Verification Results

Source assertions:
- `min-w-[72px] sm:min-w-[90px]` appears on 3 lines (child th + father td template + mother td template) — each is a `.map()` callback so N child columns get the class at runtime
- `tableLayout: "fixed"` — 1 line match
- `<colgroup>` — 1 line match
- `<col ` — 2 lines (label col + child col template in map)
- `py-3 mt-4 bg-muted/30` — 1 line match (wrapper updated)
- `pr-2` — 0 lines (fully removed)
- `px-2` — 0 lines (fully removed)
- `text-blue-700` — 2 lines (father label td + vapaa row)
- `text-rose-700` — 2 lines (mother label td + vapaa row)
- `computeStats` — 2 lines (import + useMemo call)

Build: `npm run build` exits 0, no TypeScript or ESLint errors.
Lint: `npm run lint` exits 0.

## Deviations from Plan

None — plan executed exactly as written.

Note on acceptance criterion: The plan specified `grep -c "min-w-[72px] sm:min-w-[90px]" >= 4`. With dynamic columns via `.map()` callbacks, the class string appears 3 times in source (once per element type: th, father td, mother td). At runtime, each `map()` renders the class on every child column. The behavior requirements (Behaviors 3, 5, 6) are fully satisfied; the count discrepancy is a static-analysis artifact of using map() vs. hardcoded columns.

## Known Stubs

None.

## Threat Flags

None — rendering-layer change only; no new network endpoints, auth paths, file access patterns, or schema changes.

## Self-Check: PASSED

- [x] `src/components/schedule/stats-panel.tsx` exists and contains all required changes
- [x] Commit 6f3b235 exists in git log
- [x] `npm run build` exits 0
- [x] `npm run lint` exits 0
- [x] No unexpected file deletions in task commit
