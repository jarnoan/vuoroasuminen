---
phase: quick
plan: 260407-rbx
subsystem: schedule-ui
tags: [publish-button, optimistic-update, ux]
dependency_graph:
  requires: [260406-ogw]
  provides: [optimistic-publish-disable]
  affects: [dashboard-shell, publish-button]
tech_stack:
  added: []
  patterns: [optimistic-ui-update, useCallback-functional-setstate]
key_files:
  created: []
  modified:
    - src/components/schedule/publish-button.tsx
    - src/components/schedule/dashboard-shell.tsx
decisions:
  - "Optimistic update via callback prop rather than ratchet state — keeps derive-from-days pattern while ensuring immediate UI update"
metrics:
  duration: "53 seconds"
  completed: "2026-04-07"
  tasks: 1
  files: 2
---

# Quick Task 260407-rbx: Fix Publish Button Not Becoming Disabled

**One-liner:** Optimistic days state update in DashboardShell immediately flips draft cells to published after server action succeeds, so draftCount drops to 0 without waiting for Supabase Realtime events.

## What Was Done

Added an `onPublished` callback prop to `PublishButton` that DashboardShell wires to a `handlePublished` function. When `publishDraft()` succeeds, `onPublished?.()` is called before closing the dialog, which triggers a functional `setDays` update that maps every `status: "draft"` cell to `status: "published"`. Since `draftCount` is derived from the live `days` prop, it immediately drops to 0 and the button renders in its disabled state.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add optimistic publish callback to DashboardShell and PublishButton | 948610b | publish-button.tsx, dashboard-shell.tsx |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- `src/components/schedule/publish-button.tsx` — exists with `onPublished` prop and `onPublished?.()` call
- `src/components/schedule/dashboard-shell.tsx` — exists with `handlePublished` useCallback and `onPublished={handlePublished}` prop
- Commit 948610b — verified in git log
- `npx tsc --noEmit` — zero errors
