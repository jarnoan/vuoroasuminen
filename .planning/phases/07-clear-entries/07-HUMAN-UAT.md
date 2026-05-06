---
status: partial
phase: 07-clear-entries
source: [07-VERIFICATION.md]
started: 2026-05-06T21:45:00Z
updated: 2026-05-06T21:45:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Hover × button appears on assigned cell
expected: Small × button becomes visible on hover at opacity-100; disappears when mouse leaves
result: [pending]

### 2. Cell body click toggles father ↔ mother
expected: Cell color changes to the other parent; existing toggle behavior is preserved
result: [pending]

### 3. × click clears cell (optimistic update)
expected: Cell transitions to unassigned (—) immediately; no spinner or delay
result: [pending]

### 4. Unassigned (—) cell click assigns to Isä
expected: handleAssignEmpty fires, cell turns blue-draft, DB row updated
result: [pending]

### 5. Keyboard focus reveals × button
expected: focus:opacity-100 makes × button visible when focused via Tab
result: [pending]

### 6. ClearPanel — both dates → preview appears
expected: "Tyhjennetään: N päivää (M lasta)" updates live; Vahvista enabled
result: [pending]

### 7. endDate before startDate → Vahvista disabled
expected: previewLabel returns null; Vahvista greyed out
result: [pending]

### 8. Vahvista clears range, panel collapses, focus returns
expected: clearRange called, panel collapses, focus returns to trigger button
result: [pending]

### 9. >730-day range shows server error
expected: "Aikaväli on liian pitkä (max 2 vuotta)" in role=alert destructive paragraph
result: [pending]

## Summary

total: 9
passed: 0
issues: 0
pending: 9
skipped: 0
blocked: 0

## Gaps
