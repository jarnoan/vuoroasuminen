---
status: passed
phase: 15-header-clear-guard-and-toolbar
source: [15-VERIFICATION.md]
started: 2026-05-19T18:55:00Z
updated: 2026-05-20T18:50:00Z
---

## Current Test

Human verified 2026-05-20.

## Tests

### 1. Header mobile layout
expected: At 360px viewport, only avatar and sign-out icon visible — title "Vuoroasuminen" and user's full name are hidden; no horizontal overflow; padding is tighter than desktop
result: pass

### 2. Long-press clear guard (touch)
expected: Single tap on custody cell does NOT clear it; holding for 1+ second arms the × button (becomes visible); tapping × fires the clear; armed state auto-disarms after 2s if × not tapped
result: pass

### 3. Desktop hover × regression
expected: On desktop, hovering a custody cell reveals × without any long-press; click on × still clears immediately (no behavior change from before this phase)
result: pass

### 4. ViewToolbar on mobile
expected: At 360px, toolbar fits without horizontal overflow; Prev button shows only ChevronLeft icon; date field opens native OS date picker when tapped (not a calendar popover)
result: pass

### 5. ViewToolbar on desktop
expected: On desktop, Prev button shows "‹ Prev week" text; date field opens Calendar Popover (not native input); native input is not visible
result: pass

### 6. ClearPanel date pickers
expected: On mobile, both Alkaen and Päättyy fields use native date inputs; on desktop both use Calendar Popovers; "Alkaen:" and "Päättyy:" labels are visible on both viewports
result: pass

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
