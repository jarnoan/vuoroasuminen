---
phase: 06-extend-schedule
plan: "01"
subsystem: server-actions
tags:
  - server-action
  - drizzle
  - schedule
  - extend
  - tdd
dependency_graph:
  requires:
    - src/lib/schedule/generate-default.ts (generateDefaultEntries)
    - src/db/schema/domain.ts (scheduleEntries, schedules, children)
    - src/actions/schedule.ts (requireAuthorizedParent helper)
  provides:
    - extendSchedule Server Action (src/actions/schedule.ts)
  affects:
    - src/actions/schedule.ts (appended, existing actions unchanged)
tech_stack:
  added: []
  patterns:
    - TDD (RED → GREEN cycle)
    - onConflictDoNothing for idempotent batch insert
    - requireAuthorizedParent auth guard pattern
key_files:
  created:
    - src/actions/schedule.test.ts
  modified:
    - src/actions/schedule.ts
decisions:
  - "Used `as any` casts in test mocks for Drizzle builder types — test-only, avoids over-engineering mock types"
  - "endOfWeek with weekStartsOn:1 computes Sunday boundary (D-07 from CONTEXT.md)"
  - "weeks-1 formula: addWeeks(rangeStart, weeks-1) then endOfWeek covers exactly N weeks"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-05"
  tasks_completed: 1
  files_changed: 2
requirements:
  - EXTEND-01
  - EXTEND-03
---

# Phase 6 Plan 1: extendSchedule Server Action Summary

**One-liner:** `extendSchedule` Server Action with week-count and explicit-end-date modes, auth guard, input validation (1–52 weeks / 730-day cap), and idempotent batch insert via `onConflictDoNothing`.

## What Was Built

A new exported async function `extendSchedule` appended to `src/actions/schedule.ts`. The function:

1. **Auth-guards** via `requireAuthorizedParent()` — throws "Not authenticated" or "Forbidden" for non-parents (satisfies T-06-01, T-06-08)
2. **Validates inputs** server-side:
   - `scheduleEndDate` — must be a valid ISO date (`parseISO` + `isValid`)
   - `weeks` — integer 1–52 (default 12 when omitted) (satisfies T-06-02, T-06-06)
   - `endDate` — must be a valid ISO date, 1–730 days after `scheduleEndDate` (satisfies T-06-02, T-06-06)
3. **Computes range**: `rangeStart = scheduleEndDate + 1 day`; `rangeEnd` from either explicit `endDate` or `endOfWeek(addWeeks(rangeStart, weeks-1), { weekStartsOn: 1 })` to snap to Sunday
4. **Fetches children** from DB; maps names to IDs (mirrors `queries.ts` pattern)
5. **Creates a `schedules` row** (same as seed logic in `queries.ts`)
6. **Calls `generateDefaultEntries`** with `(rangeStart, rangeEnd, config.children)` to produce alternating-week defaults
7. **Batch-inserts** with `.onConflictDoNothing()` on the unique `(childId, day)` index — idempotent (satisfies T-06-07)
8. **Returns** `{ success: true, newStartDate }` on success or `{ success: false, error }` on validation failure (Finnish error strings for UI display)

## Contract

```typescript
export async function extendSchedule(input: {
  scheduleEndDate: string   // ISO YYYY-MM-DD — current schedule's last day (inclusive)
  weeks?: number            // EXTEND-01: weeks to add (default 12, range 1–52)
  endDate?: string          // EXTEND-03: explicit ISO end date (snapped to Sunday by client)
}): Promise<
  | { success: true; newStartDate: string }   // newStartDate = scheduleEndDate + 1 day
  | { success: false; error: string }         // Finnish validation error message
>
```

## Test Suite

**File:** `src/actions/schedule.test.ts` — 11 tests, all passing

| # | Test | What It Covers |
|---|------|----------------|
| 1 | week-count mode: 12 weeks | 168 rows inserted, days 2026-06-08..2026-08-30, newStartDate correct |
| 2 | end-date mode: explicit endDate | Rows span exactly scheduleEndDate+1 through endDate |
| 3 | idempotency (onConflictDoNothing) | Second call with same input returns success without error |
| 4a | no session → throws "Not authenticated" | Auth guard rejects unauthenticated callers |
| 4b | non-parent email → throws "Forbidden" | Auth guard rejects non-parents |
| 5a | weeks=0 → validation error | Finnish error mentions "viikk" |
| 5b | weeks=53 → validation error | Finnish error mentions "viikk" |
| 6 | endDate >730 days → validation error | 730-day cap enforced |
| 7a | scheduleEndDate="not-a-date" → validation error | ISO parse failure caught |
| 7b | scheduleEndDate="" → validation error | Empty string rejected |
| 8 | newStartDate = scheduleEndDate+1 regardless of mode | Both week-count and end-date modes agree |

Tests use `vi.mock("@/db")` and `vi.mock("@/auth")` — pure unit, no live DB.

## Acceptance Criteria Verification

- `export async function extendSchedule` — 1 match in schedule.ts
- `await requireAuthorizedParent()` — 5 matches (toggleCell, saveNotes, publishSchedule, syncCalendars, extendSchedule)
- `generateDefaultEntries` — imported and called
- `onConflictDoNothing` — exactly 1 match inside extendSchedule
- `weeks < 1 || weeks > 52` — 1 match
- `daysDelta > 730` — 1 match
- `newStartDate` — 3 matches (return type, variable assignment, return statement)
- `endOfWeek` with `{ weekStartsOn: 1 }` — 1 match
- `schedules` imported and `db.insert(schedules)` called
- `npx tsc --noEmit` exits 0
- `npx vitest run src/actions/schedule.test.ts` exits 0 (11/11 passing)
- Existing actions (`toggleCell`, `saveNotes`, `publishSchedule`, `syncCalendars`) untouched

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 914590a | test(06-01) | Add failing tests for extendSchedule Server Action (TDD RED) |
| 75f44cf | feat(06-01) | Add extendSchedule Server Action (TDD GREEN) |

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

**Minor type-cast adjustment:** The plan's `<behavior>` note suggested `vi.mock` with captured variables. The initial mock had a hoisting conflict (vitest hoists `vi.mock` factories above variable declarations). Fixed by restructuring `setupDbMocks()` to use `mockImplementation` with per-call counters inside `beforeEach`, and using `as any` casts for Drizzle builder return types (test-only, does not affect production types).

## Known Stubs

None — no UI wiring in this plan. `extendSchedule` is a pure Server Action; the UI (ExtendPanel component) is built in Plan 02.

## Threat Flags

No new threat surface beyond what the plan's threat model covers. `extendSchedule` follows the exact same auth pattern as all other actions in the file.

## Self-Check: PASSED

- FOUND: src/actions/schedule.ts
- FOUND: src/actions/schedule.test.ts
- FOUND: .planning/phases/06-extend-schedule/06-01-SUMMARY.md
- FOUND: commit 914590a (TDD RED — failing tests)
- FOUND: commit 75f44cf (TDD GREEN — implementation)
