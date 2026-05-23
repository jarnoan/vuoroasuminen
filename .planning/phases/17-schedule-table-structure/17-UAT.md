---
status: complete
phase: 17-schedule-table-structure
source: [17-01-SUMMARY.md, 17-02-SUMMARY.md, 17-03-SUMMARY.md]
started: 2026-05-23T00:00:00Z
updated: 2026-05-23T00:05:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Week Label "Viikko N" Row
expected: |
  Open the schedule on a desktop viewport (>=1024px). Above every Monday row
  (including the very first week in the view), a "Viikko N" label row appears.
  The N is the correct ISO week number for that date. The text is small and muted
  (not bold, not the same size as the day cells).
result: pass

### 2. Desktop Full-Page Scroll (No Inner Scrollbar)
expected: |
  On desktop, scroll the schedule page. Only the page-level scrollbar moves —
  there is no separate inner scrollbar or scroll container around the table.
  The ExtendPanel and ClearPanel panels scroll naturally below the table as
  part of the page.
result: pass

### 3. Sticky Table Header
expected: |
  On desktop and on mobile, scroll past the first row of the schedule table.
  The column header row (<thead>) sticks to the top of the viewport and stays
  visible while the rows scroll underneath it.
result: pass

### 4. Today Row Auto-Scroll Position
expected: |
  Reload the page. Today's highlighted row appears near the top of the visible
  area — not centered. The row is not obscured by the sticky header; there is
  a visible gap between the bottom of the stuck header and the top of today's row.
result: pass

### 5. Mobile Scroll Behavior
expected: |
  Resize to a mobile viewport (<=430px) or open on a phone. The page scrolls as
  one unit (no inner scroll container around the table). The sticky header and
  "Viikko N" week labels are visible and behave the same as on desktop.
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
