---
status: complete
phase: 06-extend-schedule
source: [06-01-SUMMARY.md, 06-02-SUMMARY.md]
started: 2026-05-06T00:00:00Z
updated: 2026-05-06T12:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Trigger button visible
expected: Open the schedule page. Below the schedule table, a button labeled "+ Lisää viikkoja" is visible.
result: pass

### 2. Week-count mode — expand and preview
expected: Click "+ Lisää viikkoja". An inline panel expands below the button showing a number input pre-filled with 12 and a live date preview "Ajanjakso: ma D.M. – su D.M." that updates as you change the number. The "+ Lisää viikkoja" button disappears while the panel is open.
result: pass

### 3. Week-count mode — confirm navigates to new weeks
expected: With the panel open in week mode, click "Vahvista". The schedule view navigates to the first new week (URL ?viewStart=YYYY-MM-DD), the panel collapses, and new rows appear in the schedule grid pre-filled with the alternating default pattern.
result: pass

### 4. Date-picker mode — Finnish calendar and Sunday snap
expected: Open the panel, click "tai valitse päättymispäivä →". A date picker appears. Pick any weekday — the preview end date snaps to the following Sunday. Finnish month/day names appear in the calendar. Link changes to "tai määritä viikkoina ←" to switch back.
result: pass

### 5. Peruuta — collapses without mutation
expected: Open the panel (either mode), then click "Peruuta". The panel collapses and the schedule is unchanged (no new rows, no navigation).
result: pass

### 6. Validation error — stays open with inline message
expected: Open the panel, clear the week count or type 0 (or >52), then click "Vahvista". The panel stays open and a Finnish error message appears inline (e.g. mentioning "viikk"). No navigation happens.
result: skipped
reason: "Vahvista is disabled (not clickable) when value is 0 or >52 due to min/max on input — browser prevents submission instead of showing error. User accepted this behavior."

### 7. Loading state — buttons disabled while pending
expected: Click "Vahvista" with a valid input. During the brief server call, "Vahvista" changes to "Lisätään..." and both "Lisätään..." and "Peruuta" are disabled (unclickable). After success the panel collapses normally.
result: pass

## Summary

total: 7
passed: 6
issues: 0
pending: 0
skipped: 1
blocked: 0

## Gaps

[none yet]
