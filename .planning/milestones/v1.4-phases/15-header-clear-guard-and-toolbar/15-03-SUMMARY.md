---
phase: 15-header-clear-guard-and-toolbar
plan: "03"
subsystem: schedule-ui
tags: [mobile, responsive, date-picker, container-query, css-toggle]
dependency_graph:
  requires: []
  provides:
    - ViewToolbar with @container responsive Prev button and native date input on mobile
    - ClearPanel with native date inputs for Alkaen and Päättyy on mobile
  affects:
    - src/components/schedule/view-toolbar.tsx
    - src/components/schedule/clear-panel.tsx
tech_stack:
  added: []
  patterns:
    - CSS-only mobile toggle (sm:hidden / hidden sm:flex) — no useMediaQuery, no hydration flash
    - Tailwind @container query for container-relative breakpoints in ViewToolbar
    - Native <input type="date"> alongside Calendar Popover for OS-native mobile picker
    - parseISO(e.target.value) guarded by empty-string check before use (T-15-05 mitigation)
key_files:
  created: []
  modified:
    - src/components/schedule/view-toolbar.tsx
    - src/components/schedule/clear-panel.tsx
decisions:
  - CSS-only toggle (sm:hidden / hidden sm:flex) chosen over useMediaQuery to avoid hydration flash
  - @container on ViewToolbar outer div enables container-relative @sm breakpoint for Prev button
  - Native date input onChange guards against empty string before calling parseISO (T-15-05)
metrics:
  duration: "141 seconds"
  completed_date: "2026-05-19T18:43:58Z"
  tasks_completed: 2
  files_modified: 2
---

# Phase 15 Plan 03: Mobile Date Pickers and Container Query Toolbar Summary

CSS-toggled native `<input type="date">` added to ViewToolbar and ClearPanel for mobile usability, with `@container` query making the Prev button icon-only on narrow containers — no useMediaQuery, no hydration flash.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | ViewToolbar — @container, icon-only Prev, native date input | a845a94 | src/components/schedule/view-toolbar.tsx |
| 2 | ClearPanel — native date inputs for Alkaen and Päättyy | 000e027 | src/components/schedule/clear-panel.tsx |

## What Was Built

**Task 1 — ViewToolbar:**
- Outer div gains `@container` and `flex-wrap` classes
- ChevronLeft imported from lucide-react; Prev button shows icon-only below `@sm`, text above
- `aria-label="Edellinen viikko"` added to Prev button for accessibility
- Native `<input type="date" className="sm:hidden ...">` wired to `handleDateSelect(parseISO(e.target.value))` — visible on mobile, hidden on desktop
- Calendar Popover trigger gains `hidden sm:flex` — hidden on mobile, visible on desktop

**Task 2 — ClearPanel:**
- `parseISO` added to date-fns import
- Alkaen row: `<span>` replaced with `<label htmlFor="clear-start-date">`, native input added (`sm:hidden`), Popover trigger gains `hidden sm:flex`
- Päättyy row: same pattern with `id="clear-end-date"` / `htmlFor="clear-end-date"`
- Both native inputs have `disabled={isPending}` matching Popover trigger disabled state
- Row divs gain `flex-wrap` for clean wrapping on narrow screens

## Deviations from Plan

None — plan executed exactly as written.

## Threat Model Coverage

| Threat ID | Disposition | Applied |
|-----------|-------------|---------|
| T-15-05 | mitigate | `if (!e.target.value) return` guard before parseISO in all three onChange handlers |
| T-15-06 | accept | No action needed — value is user's own selected date |

## Known Stubs

None — all date inputs are fully wired to their respective state setters and handlers.

## Self-Check: PASSED

- `src/components/schedule/view-toolbar.tsx` — FOUND
- `src/components/schedule/clear-panel.tsx` — FOUND
- Commit a845a94 — FOUND (Task 1: ViewToolbar)
- Commit 000e027 — FOUND (Task 2: ClearPanel)
- `npx tsc --noEmit` — no errors
