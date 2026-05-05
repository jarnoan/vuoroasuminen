---
status: resolved
phase: 05-view-window-control
source: [05-VERIFICATION.md]
started: 2026-05-05T00:00:00Z
updated: 2026-05-05T00:00:00Z
---

## Current Test

Approved during 05-04 checkpoint human verification.

## Tests

### 1. Default view shows current week (VIEW-01)
expected: Schedule starts from Monday of current week with no ?viewStart param
result: approved

### 2. Floating Tänään button gone (D-07)
expected: No fixed bottom-right button visible when scrolling
result: approved

### 3. Prev week navigation (VIEW-02)
expected: Click ‹ Prev week → URL gets ?viewStart=YYYY-MM-DD, schedule shifts back
result: approved (required key prop fix — DashboardShell now remounts on viewStart change)

### 4. Tänään reset + scroll (D-08)
expected: Click Tänään → URL clears viewStart, auto-scrolls to today row
result: approved

### 5. Date picker snaps to Monday (VIEW-03)
expected: Pick any weekday → URL shows Monday of that week
result: approved

### 6. Per-user isolation (VIEW-04)
expected: Two tabs with different viewStart show independent views
result: approved

### 7. Loading skeleton
expected: Skeleton layout visible during URL-change re-renders on slow network
result: approved

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
