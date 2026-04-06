---
phase: quick
plan: 260406-oca
subsystem: schedule-ui
tags: [bug-fix, publish-button, client-state]
dependency_graph:
  requires: []
  provides: [publish-button-immediate-disable]
  affects: [src/components/schedule/publish-button.tsx]
tech_stack:
  added: []
  patterns: [local-boolean-override-for-stale-prop]
key_files:
  created: []
  modified:
    - src/components/schedule/publish-button.tsx
    - .planning/phases/03-draft-publish-statistics/03-HUMAN-UAT.md
decisions:
  - hasPublished local state overrides stale initialData.draftCount to give immediate disabled feedback without a page reload
metrics:
  duration: 10m
  completed: 2026-04-06T14:34:07Z
  tasks: 2
  files: 2
---

# Quick Task 260406-oca: Fix PublishButton Disabled State After Publish Summary

**One-liner:** Added `hasPublished` boolean state to PublishButton so it disables itself immediately after `publishDraft()` succeeds, overriding the stale `draftCount` derived from `initialData`.

## What Was Done

### Task 1: Add hasPublished override to PublishButton

`src/components/schedule/publish-button.tsx` now declares `const [hasPublished, setHasPublished] = useState(false)`. After `publishDraft()` returns success, `setHasPublished(true)` is called before `setOpen(false)`. The disabled guard now uses `effectiveDraftCount = hasPublished ? 0 : draftCount` instead of `draftCount` directly. The dialog description continues to display `draftCount` (the pre-publish original count from `initialData`), which is correct — it's shown before publishing.

**Commit:** d03f195

### Task 2: Update UAT test #3 result

`03-HUMAN-UAT.md` test #3 result updated from `[pending]` to `failed — button stayed enabled after publish; fixed in quick task 260406-oca. resolved.` Pending count reduced from 3 to 2. Timestamp updated to `2026-04-06T18:00:00Z`.

**Commit:** f7afa26

## Verification

- TypeScript compilation: no errors in publish-button.tsx (`npx tsc --noEmit`)
- UAT file contains "resolved" for test #3

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `src/components/schedule/publish-button.tsx` — exists, modified
- `.planning/phases/03-draft-publish-statistics/03-HUMAN-UAT.md` — exists, updated
- Commit d03f195 — present in git log
- Commit f7afa26 — present in git log
