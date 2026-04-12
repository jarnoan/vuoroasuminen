---
quick_id: 260412-fjd
description: fix child columns not showing after adding third child and renaming
date: 2026-04-12
status: planned
---

# Quick Task 260412-fjd: Fix Child Columns Not Showing After Adding Third Child

## Root Cause

`queries.ts:18` builds `orderedChildren` by fetching rows from the `children` DB table and
matching against `config.children` names. The DB still has the old names ("Emma", "Olivia")
from the initial seed; the new names ("Taimi", "Eino", "Hilla") don't match, so
`orderedChildren` is empty. Empty `orderedChildren` → no cell columns rendered.
The window's existing entries also prevent the auto-seed branch from running.

## Fix

Create `src/db/reset.ts` — a script that:
1. Deletes all gcal_events, schedule_entries, schedules, children (in FK order)
2. Re-inserts children from the current config

Add `db:reset` to package.json scripts.

## Tasks

### Task 1: Add reset.ts and db:reset script

**Files:**
- `src/db/reset.ts` (new)
- `package.json` (add db:reset script)

**Action:** Script clears all schedule-related tables in FK dependency order, then re-seeds
children from config. The app auto-seeds fresh schedule entries on next page load.

**Verify:** `npx tsc --noEmit` exits 0.

**Done:** `npm run db:reset` is runnable; columns reappear after running it.
