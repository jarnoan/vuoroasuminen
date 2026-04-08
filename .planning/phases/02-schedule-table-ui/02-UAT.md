---
status: complete
phase: 02-schedule-table-ui
source: [02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md]
started: 2026-04-08T00:00:00Z
updated: 2026-04-08T00:01:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Dashboard loads real schedule data
expected: Navigate to /dashboard (logged in). You should see a schedule table with actual dates — not placeholder text or a loading skeleton that never resolves. The table should have rows for today and surrounding weeks.
result: pass

### 2. 84-row schedule table spanning 12 weeks
expected: The table covers exactly 12 weeks (84 days). You should be able to scroll through rows representing every day in the 12-week rolling window, with dates labeled in each row.
result: pass

### 3. Color-coded cells (blue = father, rose = mother)
expected: Each day row shows two cells — one per child. Cells assigned to the father are blue, cells assigned to the mother are rose/pink. Draft entries appear faded; published entries appear solid/full-color.
result: pass

### 4. Click a cell to toggle parent assignment
expected: Click a cell assigned to the father — it should immediately flip to mother (rose) without a full page reload. Click it again — it flips back to father (blue). The change is optimistic: it shows before the server responds.
result: pass

### 5. Inline notes editing (save on blur)
expected: Click the notes field on any row. Type some text. Click away (blur the field). The note is saved — refreshing the page shows the same note still there.
result: pass

### 6. Week separators between weeks
expected: A visual separator (thin row or gap) appears between each week group (Sunday → Monday boundary). The table is clearly divided into 12 weekly blocks rather than one continuous list.
result: pass

### 7. Today row highlighted and auto-scrolled to on load
expected: When the dashboard first loads, today's row is visually highlighted (distinct background or border). The page auto-scrolls so today's row is visible in the viewport without manual scrolling.
result: pass

### 8. "Today" button scrolls to today row
expected: A "Today" button is visible (fixed, bottom-right corner). Scroll far away from today's row. Click the button — the view scrolls back so today's row is visible.
result: pass

### 9. Sticky header stays visible while scrolling
expected: The table header (column labels) remains pinned to the top of the viewport as you scroll down through the rows. It does not scroll away off-screen.
result: pass

### 10. Realtime sync across two browser tabs
expected: Open the dashboard in two browser tabs (both logged in). In Tab A, click a cell to toggle its assignment. Within a second or two, Tab B should show the same cell updated — without refreshing Tab B.
result: pass

### 11. Notes realtime sync
expected: Open the dashboard in two browser tabs. In Tab A, type a note for a day and blur (save it). Within a second or two, Tab B should show the same note appear in that day's notes field — without refreshing Tab B.
result: pass

## Summary

total: 11
passed: 11
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
