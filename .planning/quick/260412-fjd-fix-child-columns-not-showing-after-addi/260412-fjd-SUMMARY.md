---
quick_id: 260412-fjd
status: completed
date: 2026-04-12
commit: 7d397e7
---

# Quick Task 260412-fjd: Summary

## Root Cause

`queries.ts` builds the columns list by fetching `children` rows from the DB and matching
against `config.children` names. The DB had old names ("Emma", "Olivia") from the initial
seed; the new names ("Taimi", "Eino", "Hilla") produced zero matches, leaving `orderedChildren`
empty — no columns rendered. The existing schedule_entries also prevented the auto-seed branch
from running for the new children.

## What Was Done

Created `src/db/reset.ts`:
- Deletes gcal_events → schedule_entries → schedules → children (FK-safe order)
- Re-inserts children from `config.children`
- App auto-seeds schedule entries for new children on next page load

Added `"db:reset": "npx tsx src/db/reset.ts"` to `package.json`.

## To Fix Immediately

Run:
```
npm run db:reset
```

Then open the app — columns for Taimi, Eino, and Hilla will appear with a freshly seeded
12-week schedule.
