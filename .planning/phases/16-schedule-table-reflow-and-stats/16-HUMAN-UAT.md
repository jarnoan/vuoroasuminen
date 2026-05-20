---
status: passed
phase: 16-schedule-table-reflow-and-stats
source: [16-VERIFICATION.md]
started: 2026-05-20T07:55:00Z
updated: 2026-05-20T18:50:00Z
---

## Current Test

Human verified 2026-05-20.

## Tests

### 1. No horizontal scroll at 360px
expected: The schedule table fits completely within a 360px viewport without requiring horizontal scrolling
result: pass

### 2. PlusIcon tap behavior on mobile
expected: Tapping the PlusIcon in an empty-notes row reveals a second row with a focusable NotesCell; saving an empty note collapses the row
result: pass

### 3. Second-row notes visible on mobile
expected: On mobile, rows with existing notes show them on a second <tr> below the main day row; the main-row notes column is hidden
result: pass

### 4. Desktop layout unchanged
expected: On desktop (sm: and above), the single-row layout with notes as the final column is unchanged; the scroll container is height-constrained with overflow
result: pass

### 5. StatsPanel visually below the table
expected: The statistics panel appears below the schedule table on all screen sizes; it is not inside the scroll container
result: pass

### 6. Statistics grid layout on mobile
expected: Statistics display in a child-column grid at 360px — no overflow, all values visible without horizontal scrolling
result: pass

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
