---
phase: "07"
plan: "07-01"
subsystem: "data-layer"
tags: [schema, drizzle, server-actions, gcal-sync, typescript]
dependency_graph:
  requires: []
  provides: [clearCell-action, clearRange-action, nullable-parentId-schema, ScheduleCell-null-parentId]
  affects: [schedule_entries-table, ScheduleCell-type, stats-computation, gcal-sync]
tech_stack:
  added: []
  patterns: [nullable-column-drizzle, server-action-auth-guard, drizzle-parameterized-update]
key_files:
  created: []
  modified:
    - src/db/schema/domain.ts
    - src/lib/schedule/types.ts
    - src/lib/schedule/queries.ts
    - src/lib/schedule/stats.ts
    - src/actions/schedule.ts
    - src/lib/gcal/sync.ts
decisions:
  - "NULL represents cleared/unassigned state; row is preserved so gcal_events FK allows GCal cleanup on next publish"
  - "clearCell/clearRange set status='draft' so cleared cells are re-published and GCal orphan cleanup runs"
  - "stats.ts null guard skips cleared cells from both parent tallies — they count toward neither parent"
metrics:
  duration: "3m"
  completed_date: "2026-05-06"
  tasks_completed: 5
  files_modified: 6
---

# Phase 7 Plan 01: Schema + Actions Foundation Summary

One-liner: Nullable `schedule_entries.parent_id` column, widened TypeScript types, and auth-guarded `clearCell`/`clearRange` Server Actions with GCal orphan-cleanup type fix.

## What Was Built

The data and server foundation for clearing schedule cells. No UI shipped — this plan establishes the contract that Wave 2 UI plans (07-02, 07-03) consume.

### Changes by file

**`src/db/schema/domain.ts`** — Removed `.notNull()` from `parentId` column. Column now accepts NULL to represent a cleared/unassigned cell. The row is preserved (not deleted) so the `gcal_events` FK cascade can clean up GCal events on the next publish.

**`src/lib/schedule/types.ts`** — Widened `ScheduleCell.parentId` from `ParentId` to `ParentId | null`. This is the source-of-truth shape consumed by all UI components and the stats system.

**`src/lib/schedule/queries.ts`** — Updated the cell builder to propagate `null` when a row exists with `parent_id IS NULL`, while preserving `config.firstParent` as the default when no DB row exists at all (seed-data case).

**`src/lib/schedule/stats.ts`** — Added `if (cell.parentId === null) continue` guard in the STAT-01 loop. Cleared cells count toward neither parent's tally.

**`src/actions/schedule.ts`** — Appended `clearCell(entryId)` and `clearRange({startDate, endDate})` Server Actions. Both call `requireAuthorizedParent()` as their first statement. `clearRange` validates dates with `parseISO`/`isValid`, rejects negative deltas and ranges >730 days, and returns `clearedCount`.

**`src/lib/gcal/sync.ts`** — Widened `PublishedEntry.parentId` from `string` to `string | null`. The existing orphan filter (`entry.parentId !== parent.id`) already evaluates `null !== "father"` as `true`, so cleared entries with `status='published'` get their GCal events deleted naturally on the next publish without any logic change.

## Migration Applied

Task 2 ran `npx drizzle-kit push` which executed:
```sql
ALTER TABLE "schedule_entries" ALTER COLUMN "parent_id" DROP NOT NULL;
```
Verified via `information_schema.columns.is_nullable = YES` and a successful NULL INSERT test.

## Verification Results

- `npx vitest run src/lib/schedule/__tests__/` — 12 tests across 2 files, all passed
- DB NULL insert test — `parent_id: null` returned from INSERT, cleanup successful
- TypeScript: sync.ts line 117 error (`parentId: string | null` not assignable) resolved; remaining tsc errors are all pre-existing (cascade from missing generated `src/config/app.ts` in worktree context — not caused by this plan)

## Deviations from Plan

None — plan executed exactly as written.

**Note on pre-existing tsc errors:** The worktree does not have `src/config/app.ts` (a generated file that lives only in the main working tree). This causes `Cannot find module '@/config/app'` errors which cascade into additional `implicit any` and Drizzle overload errors in `schedule.ts`, `queries.ts`, `reset.ts`, `seed.ts`. These errors existed before this plan started (confirmed by stash test) and are not caused by our changes. The main repo where `app.ts` exists will compile cleanly.

## Known Stubs

None.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries beyond what is documented in the plan's threat model.

## Self-Check: PASSED

All 6 modified files exist on disk. All 4 task commits found in git log. SUMMARY.md present.
