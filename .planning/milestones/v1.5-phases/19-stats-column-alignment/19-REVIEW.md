---
phase: 19-stats-column-alignment
reviewed: 2026-05-25T00:00:00Z
depth: standard
files_reviewed: 1
files_reviewed_list:
  - src/components/schedule/stats-panel.tsx
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 19: Code Review Report

**Reviewed:** 2026-05-25
**Depth:** standard
**Files Reviewed:** 1
**Status:** issues_found

## Summary

Reviewed `src/components/schedule/stats-panel.tsx` and its direct dependency `src/lib/schedule/stats.ts` (read for cross-reference). The component is small and well-structured. Two issues require attention: a mobile column-width mismatch between the stats-panel `<colgroup>` and the schedule-table `<colgroup>` that undermines the alignment goal of this phase, and a DST-boundary bug in `stats.ts` that will produce an off-by-one error in child-free weekend counts when the window spans a daylight-saving transition. Two lower-severity items are also noted.

## Warnings

### WR-01: Mobile column-width mismatch between stats-panel and schedule-table colgroups

**File:** `src/components/schedule/stats-panel.tsx:23`

**Issue:** The stats-panel's third `<col>` (the notes/pencil slot) uses `max-sm:w-0 sm:w-40`, but the corresponding column in `schedule-table.tsx:279` uses `max-sm:w-8 sm:w-40`. On narrow viewports (`max-sm`, i.e. below 640px), the schedule-table allocates 32px (`w-8`) for the pencil-icon column while the stats-panel allocates 0px. This produces a misalignment between the two tables on mobile — the child-name columns in the stats-panel will be visually wider than the matching columns in the schedule-table, defeating the alignment objective of this phase.

**Fix:**
```tsx
// stats-panel.tsx line 23 — match schedule-table's mobile width
<col className="max-sm:w-8 sm:w-40" />
```

---

### WR-02: DST-boundary bug in `countChildFreeWeekends` causes incorrect weekend count

**File:** `src/lib/schedule/stats.ts:89` (dependency of `StatsPanel`)

**Issue:** The weekend-detection check uses exact millisecond arithmetic:
```ts
dDate.getTime() - date.getTime() === 86400000
```
On a DST spring-forward transition night (Sunday 2am clocks advance 1h), the calendar day from Saturday to Sunday is only 23 hours = 82,800,000 ms, not 86,400,000 ms. The equality fails and the weekend is not counted. On a DST fall-back night (25h = 90,000,000 ms), the equality also fails. Finland observes DST (last Sunday of March/October), so a 12-week window will cross at least one transition per year, producing a wrong `childFreeWeekends` value in the stats panel for the affected weekend.

**Fix:** Use `date-fns/addDays` (already imported in the project) to find the next calendar day instead of millisecond arithmetic:
```ts
import { parseISO, getDay, addDays, format } from "date-fns"

// Replace the inner check:
const sundayDateStr = format(addDays(date, 1), "yyyy-MM-dd")
if (freeDates.has(sundayDateStr)) {
  count++
}
// The `days.find(...)` lookup is no longer needed.
```

## Info

### IN-01: Empty `days` array renders a misleading non-empty stats panel

**File:** `src/components/schedule/stats-panel.tsx:16`

**Issue:** When `days` is an empty array, `computeStats` returns `childStats: []` and `parentFreeStats` with zero counts. The panel still renders its outer `<div>` and `<table>` with the two vapaa rows, showing parent names with "0 pv (0 vkl)". This is unlikely in production (the schedule always covers an 84-day window) but could surface during loading states or error boundaries if the parent passes an empty array.

**Fix:** Guard the render or handle it explicitly in the parent. A simple null-render guard in `StatsPanel`:
```tsx
if (days.length === 0) return null
```

---

### IN-02: `colSpan` magic number `+3` is undocumented and fragile

**File:** `src/components/schedule/stats-panel.tsx:63` and `71`

**Issue:** `stats.childStats.length + 3` encodes the assumption "there are exactly 2 trailing columns plus the label column." This is correct today, but if a trailing column is added or removed the `colSpan` silently becomes wrong (either leaving a column uncovered or spanning beyond the table). There is no comment explaining the `3`.

**Fix:** Derive the total column count explicitly and add a comment, mirroring the pattern in `schedule-table.tsx` line 271:
```tsx
// Label col (1) + child cols + notes col (1) + pencil col (1) = +3
const totalCols = stats.childStats.length + 3

// then use totalCols in both colSpan attributes
colSpan={totalCols}
```
A constant with a comment is enough — no behavioral change needed.

---

_Reviewed: 2026-05-25_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
