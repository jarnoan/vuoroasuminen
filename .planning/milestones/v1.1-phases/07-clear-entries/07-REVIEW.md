---
phase: 07-clear-entries
reviewed: 2026-05-06T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - src/actions/schedule.ts
  - src/components/schedule/clear-panel.tsx
  - src/components/schedule/dashboard-shell.tsx
  - src/components/schedule/schedule-cell.tsx
  - src/components/schedule/schedule-table.tsx
  - src/components/schedule/schedule-with-realtime.tsx
  - src/db/schema/domain.ts
  - src/lib/gcal/sync.ts
  - src/lib/schedule/queries.ts
  - src/lib/schedule/stats.ts
  - src/lib/schedule/types.ts
findings:
  critical: 0
  warning: 5
  info: 3
  total: 8
status: issues_found
---

# Phase 07: Code Review Report

**Reviewed:** 2026-05-06
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

This phase adds two new server actions (`clearCell`, `clearRange`) with a `ClearPanel` UI and a per-cell clear button in `ScheduleCell`. The core clear path is correct: authorization is enforced, optimistic UI with revert is implemented, and the DB schema already supports `parentId: null`. Five warnings were found — no critical issues. The most impactful ones are a logic error in `handleClear` (captured revert state can be stale due to React's batched state update semantics), the `extendSchedule` action creating a dangling `schedules` row before validating that all children exist, and `clearRange` having no upper-bound guard on the number of rows it actually clears (only the date span is validated). Three informational items cover dead code, a magic number, and a missing status filter in `clearRange`.

---

## Warnings

### WR-01: `handleClear` revert captures stale `parentId`/`status` due to closure-over-closure pattern

**File:** `src/components/schedule/schedule-table.tsx:122-158`

**Issue:** `priorParentId` and `priorStatus` are declared with `let` outside the `setDays` updater, then written inside it. React does not guarantee that the updater runs synchronously before the `await clearCell(entryId)` call (in practice it does in React 18 concurrent mode, but relying on this is fragile). If React defers the updater, `priorParentId` is still `null` when the `catch` block reads it, causing the revert to set `parentId: null` instead of the true prior value — the cell visually stays cleared even though the server rejected the change.

A safer pattern is to capture the prior state with a separate synchronous read before calling `setDays`.

**Fix:**
```typescript
async function handleClear(entryId: string) {
  // Capture prior state synchronously before any state update
  let priorParentId: ParentId | null = null
  let priorStatus: "draft" | "published" = "draft"
  // Read current state snapshot
  setDays(prev => {
    for (const day of prev) {
      const cell = day.cells.find(c => c.entryId === entryId)
      if (cell) {
        priorParentId = cell.parentId
        priorStatus = cell.status
        break
      }
    }
    return prev // no mutation yet — just a read
  })

  // Now apply optimistic update
  setDays(prev =>
    prev.map(day => ({
      ...day,
      cells: day.cells.map(cell =>
        cell.entryId === entryId
          ? { ...cell, parentId: null, status: "draft" as const }
          : cell
      ),
    }))
  )
  // ... rest of the function unchanged
}
```

Alternatively, extract the current days via a `ref` that mirrors state — a common pattern when you need a synchronous snapshot in an event handler.

---

### WR-02: `extendSchedule` inserts a `schedules` row before checking that all children exist

**File:** `src/actions/schedule.ts:153-163`

**Issue:** Line 153 creates a `schedules` row unconditionally:
```typescript
const [schedule] = await db.insert(schedules).values({}).returning()
```
The missing-children guard at lines 155–162 runs **after** the insert. If any configured child is absent from the DB, the action returns an error but leaves an orphaned `schedules` row in the database. The `scheduleEntries` child is never inserted (due to the early return), so the `schedules` row becomes permanent orphan data.

**Fix:** Move the missing-children check before the `db.insert(schedules)` call:
```typescript
// --- Verify all configured children exist in DB (BEFORE inserting schedules row) ---
const missingChildren = config.children.filter(name => !childNameToId.has(name))
if (missingChildren.length > 0) {
  return {
    success: false,
    error: `Lapsia ei löydy tietokannasta: ${missingChildren.join(", ")}`,
  }
}

// --- Create a schedules row only after validation passes ---
const [schedule] = await db.insert(schedules).values({}).returning()
```

---

### WR-03: `clearRange` does not filter by children — clears ALL children in the date range with a single broad UPDATE

**File:** `src/actions/schedule.ts:195-230`

**Issue:** The `WHERE` clause for `clearRange` is only `day >= startDate AND day <= endDate`. It has no child scope restriction. This is consistent with the stated intent (clear all cells in a range), but the action also has no authorization scope: it clears entries regardless of which `scheduleId` they belong to. If a future multi-family deployment were ever considered, this would silently clear another family's data. More immediately, the action skips validating that `startDate <= endDate` when the delta is exactly 0 (same day) — `daysDelta < 0` only rejects strictly negative ranges.

The same-day case (`daysDelta === 0`) is valid and works correctly, so this is not a bug. However the lack of a `scheduleId` scope in the WHERE clause is an architectural weakness worth noting here as a warning since the existing codebase has no multi-tenant isolation at the DB query level anywhere — adding scope here would be premature without a broader decision.

More actionably: the action returns `clearedCount` as the number of rows updated, but the client (`ClearPanel`) does not use this value at all — if the operation silently updates 0 rows (e.g. the range is outside all existing entries), the panel collapses without any feedback.

**Fix:** Surface the count in the success path so the UI can optionally show a toast:
```typescript
// In handleConfirm (clear-panel.tsx):
const result = await clearRange({ ... })
if (!result.success) {
  setErrorMsg(result.error)
  return
}
if (result.clearedCount === 0) {
  setErrorMsg("Valitulla aikavälillä ei ole merkintöjä.")
  return
}
resetPanel()
```

---

### WR-04: `ScheduleCell` renders with `parentId` guaranteed non-null by its call site, but accepts `ParentId` type that allows `null` at the type level — inconsistency can mask cleared-cell render bugs

**File:** `src/components/schedule/schedule-cell.tsx:7-13` and `src/components/schedule/schedule-table.tsx:268`

**Issue:** `ScheduleCell`'s `parentId` prop is typed as `ParentId` (not `ParentId | null`). The call site at `schedule-table.tsx:268` only renders `<ScheduleCell>` when `cell.parentId` is truthy:
```typescript
{cell.entryId && cell.parentId ? (
  <ScheduleCell ... parentId={cell.parentId} ... />
) : ...}
```
So the non-null prop contract is actually enforced at runtime. However, `colorMap` at line 15 is indexed with `parentId` without a null guard:
```typescript
const colorClass = colorMap[parentId][status]
```
If `parentId` is somehow `null` (e.g. in tests or a future call site that doesn't have the conditional guard), this will throw a `TypeError: Cannot read properties of undefined`. The type signature promises safety, but the implementation has a latent crash path.

**Fix:** Either narrow the type explicitly or add a fallback:
```typescript
// Option A: add runtime guard
const colorClass = parentId ? colorMap[parentId][status] : "bg-muted/30"

// Option B: keep type as-is but document the precondition
// parentId is guaranteed non-null by call site — see schedule-table.tsx conditional
```

---

### WR-05: `handleAssignEmpty` in `schedule-table.tsx` hardcodes `"father"` as the default parent when assigning an empty cell

**File:** `src/components/schedule/schedule-table.tsx:160-204`

**Issue:** Lines 180 and 187 both hardcode `"father"` as the parent to assign when clicking an empty (cleared) cell:
```typescript
return { ...cell, parentId: "father" as ParentId, status: "draft" as const }
// ...
await toggleCell(entryId, "father")
```
After a cell has been cleared via the new `clearCell` action, clicking it will always assign it to the father regardless of what the prior assignment was. This is a pre-existing issue but becomes user-visible now that clear is implemented: a user clears a mother-assigned cell, then clicks it expecting to assign to the father (reasonable), but if the pattern expectation was mother-first, this is surprising. The UX intent should be confirmed — if it is intentional to always default cleared cells to father, a comment should say so explicitly, referencing `config.firstParent`.

**Fix:** Use `config.firstParent` instead of the magic string `"father"` so the behavior is governed by app configuration:
```typescript
import config from "@/config/app"
// ...
return { ...cell, parentId: config.firstParent as ParentId, status: "draft" as const }
// ...
await toggleCell(entryId, config.firstParent)
```

---

## Info

### IN-01: `childName` prop is declared in `ScheduleCellProps` but never used inside the component body

**File:** `src/components/schedule/schedule-cell.tsx:11`

**Issue:** `childName: string` is part of the interface and is passed from `schedule-table.tsx:273`, but the component never references `childName` — it derives the display name from `config.parents` using `parentId` instead. The unused prop adds noise to the interface.

**Fix:** Remove `childName` from `ScheduleCellProps` and the corresponding prop spread at the call site, unless it is intended for a future feature (in which case add a comment).

---

### IN-02: `extendSchedule` builds `childNameToId` map but then separately iterates `config.children` to find missing children — redundant loop

**File:** `src/actions/schedule.ts:146-163`

**Issue:** `orderedChildren` is built by filtering `allChildren` through `config.children` (line 147–149). Then `childNameToId` is derived from `orderedChildren` (line 150). Then `missingChildren` is computed by filtering `config.children` against `childNameToId` (line 156). This is three passes over the same data. One pass suffices: the `childNameToId` map already implicitly encodes which names were found.

**Fix:**
```typescript
// After building childNameToId:
const missingChildren = config.children.filter(name => !childNameToId.has(name))
// (remove the orderedChildren intermediate if it's only used for childNameToId)
```
The current code is functionally correct — this is purely a readability note.

---

### IN-03: `syncCalendarsAfterPublish` does not sweep orphaned `gcal_events` for cleared entries (parentId = null)

**File:** `src/lib/gcal/sync.ts:170-175`

**Issue:** The orphan filter at line 174 checks `entry.parentId !== parent.id`. Since `parentId` can now be `null` for cleared entries, `null !== "father"` is `true`, so cleared entries will correctly appear as orphans and their calendar events will be deleted — this is the desired behavior per the spec. The code is correct.

However, this is implicit behavior that depends on null-inequality semantics. There is no comment explaining that cleared entries (parentId = null) are handled as orphans by design. Future maintainers may be confused by the null case.

**Fix:** Add a clarifying comment:
```typescript
// entry.parentId !== parent.id covers both re-assigned entries AND cleared entries
// (parentId = null), which ensures calendar events are deleted when a day is cleared.
return entry.parentId !== parent.id
```

---

_Reviewed: 2026-05-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
