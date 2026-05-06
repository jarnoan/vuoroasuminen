---
phase: "07"
plan: "07-03"
subsystem: "ui"
tags: [clear-entries, client-component, date-picker, server-action, accessibility]
dependency_graph:
  requires: ["07-01"]
  provides: [ClearPanel-component, bulk-clear-UI, CLEAR-02]
  affects: [dashboard-shell, schedule-ui]
tech_stack:
  added: []
  patterns: [inline-expand-collapse-panel, popover-calendar-date-picker, queueMicrotask-focus-restoration]
key_files:
  created:
    - src/components/schedule/clear-panel.tsx
  modified:
    - src/components/schedule/dashboard-shell.tsx
decisions:
  - "ClearPanel takes no props — all state is self-contained; config.children.length drives the preview child count"
  - "No router navigation on success (D-09) — panel collapses in place, unlike ExtendPanel which calls router.replace()"
  - "queueMicrotask focus restoration to trigger button for keyboard accessibility after collapse"
  - "Vahvista disabled when previewLabel is null (covers end < start case T-07-15)"
metrics:
  duration: "8m"
  completed_date: "2026-05-06"
  tasks_completed: 2
  files_modified: 2
---

# Phase 7 Plan 03: Bulk Clear UI (ClearPanel) Summary

One-liner: Self-contained ClearPanel client component with inline expand/collapse, two Finnish-locale date pickers, live Tyhjennetaan preview, and clearRange Server Action call wired into DashboardShell below ExtendPanel.

## What Was Built

### Task 1 — Create ClearPanel client component

`src/components/schedule/clear-panel.tsx` — a new `"use client"` component modeled exactly on `ExtendPanel`. Key characteristics:

- **Collapsed state:** Outline button `× Tyhjennä päiväväli` with `ref={triggerRef}` for focus restoration
- **Expanded state:** Inline panel (`border rounded-lg p-3 bg-muted/30 text-sm space-y-3`) with:
  - `Alkaen:` date picker (Popover + Calendar, Finnish locale)
  - `Päättyy:` date picker (Popover + Calendar, Finnish locale)
  - Live preview paragraph `Tyhjennetään: N päivää (M lasta)` with `aria-live="polite"` — uses `differenceInCalendarDays(end, start) + 1` for inclusive range; returns null when end < start (disabling Vahvista)
  - Vahvista / Peruuta buttons; Vahvista disabled when `isPending || !previewLabel`
  - Error paragraph with `role="alert"` for curated Finnish error strings
- **No router navigation** (D-09) — on success the panel collapses via `resetPanel()` only
- **Focus management** — `queueMicrotask(() => triggerRef.current?.focus())` restores focus to trigger after collapse
- **Pending guard** — `isPending` flag disables all interactive elements during Server Action flight (T-07-19)
- Both Popovers use base-ui `render={<Button .../>}` pattern (not `asChild`) — mirrors ExtendPanel exactly

### Task 2 — Render ClearPanel in DashboardShell

`src/components/schedule/dashboard-shell.tsx` — two-line change:

1. Import added: `import { ClearPanel } from "./clear-panel"` after the ExtendPanel import
2. JSX added: `<ClearPanel />` as the third child of `<main>`, immediately below `<ExtendPanel scheduleEndDate={scheduleEndDate} />`

`DashboardShellProps` interface unchanged — ClearPanel is self-contained and consumes no parent state.

## Verification Results

- `npx tsc --noEmit` — only pre-existing `Cannot find module '@/config/app'` errors (worktree lacks generated app.ts; documented in 07-01 SUMMARY); no new errors in modified files
- `npx vitest run` — 33 tests, all pass

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. ClearPanel is fully wired to the `clearRange` Server Action from 07-01.

## Threat Flags

No new network endpoints, auth paths, or schema changes beyond what the plan's threat model covers. All STRIDE threats (T-07-14 through T-07-19) are addressed as specified.

## Self-Check: PASSED
