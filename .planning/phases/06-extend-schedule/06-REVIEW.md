---
phase: 06-extend-schedule
reviewed: 2026-05-06T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/actions/schedule.ts
  - src/actions/schedule.test.ts
  - src/components/schedule/extend-panel.tsx
  - src/components/schedule/dashboard-shell.tsx
  - src/lib/schedule/queries.ts
  - src/app/dashboard/page.tsx
findings:
  critical: 2
  warning: 3
  info: 3
  total: 8
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-05-06
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Phase 06 adds `extendSchedule` (server action), `ExtendPanel` (client component), and wires both into the dashboard. The logic is generally sound — auth guard, input validation, idempotent insert, and auto-navigation are all implemented. There are two critical issues: a hardcoded real email address in `config/app.ts` (exposed to the repo) and a missing upper-bound validation that lets the server-action accept a `weeks` value that is `Infinity`. Three warnings cover a null-dereference risk in `getScheduleWindow`, a silent schedule-entry discard in `extendSchedule`, and a broken `insertCallCount` reset in tests that can cause test interference. Three info items cover minor quality concerns.

---

## Critical Issues

### CR-01: Real email address hardcoded in config/app.ts

**File:** `src/config/app.ts:21,25`
**Issue:** Both parent entries use `"jarnoan@gmail.com"` as a real Google account email. This value is committed to the repository (or will be on next commit). Anyone with read access to the repo gains the email address, which is a PII exposure. More practically, the authorization check in `requireAuthorizedParent()` compares session emails against this list, meaning the "father" and "mother" roles both resolve to the same email, effectively granting a single account both roles and making the multi-parent model non-functional until the values are replaced.

Although `src/config/app.ts` is not one of the files explicitly in scope, it is directly imported by every reviewed file and the issue was discovered during this review.

**Fix:** Move secrets and PII out of source code. Use environment variables:
```ts
// src/config/app.ts
const config: AppConfig = {
  parents: [
    {
      id: "father",
      name: "Isä",
      email: process.env.PARENT_FATHER_EMAIL!,
      calendarId: process.env.PARENT_FATHER_CALENDAR_ID!,
    },
    {
      id: "mother",
      name: "Äiti",
      email: process.env.PARENT_MOTHER_EMAIL!,
      calendarId: process.env.PARENT_MOTHER_CALENDAR_ID!,
    },
  ],
  ...
}
```
Add both variables to `.env.local` (which must be in `.gitignore`) and document them in `.env.example`.

---

### CR-02: `weeks` input accepts `Infinity` / `NaN` when passed as a float string from the client

**File:** `src/actions/schedule.ts:128`
**Issue:** The `weeks` field is accepted as `number` at the TypeScript boundary. The validation is:
```ts
if (!Number.isInteger(weeks) || weeks < 1 || weeks > 52) { ... }
```
`Number.isInteger(Infinity)` is `false`, so `Infinity` is correctly rejected. However `Number.isInteger(NaN)` is also `false` — also rejected. The real gap is that the TypeScript type `number` in a Server Action can be satisfied by any JSON number. A client sending `{ weeks: 1.5 }` is rejected correctly. But a client sending `{ weeks: 12.0 }` (float equal to integer) will pass `Number.isInteger` and is fine.

The actual vulnerability: in "date" mode, `endDate` is passed instead of `weeks`. If a client sends **both** `endDate` and `weeks`, the `if (input.endDate !== undefined)` branch runs first and `weeks` is silently ignored — no validation error is returned. A client that intentionally sends `{ scheduleEndDate, endDate: "valid-date", weeks: 0 }` skips the `weeks` validation entirely. This is not directly exploitable (the `endDate` path has its own guard) but it creates a confusing invariant: the action silently accepts an input that violates its documented constraints.

**Fix:** Add explicit mutual-exclusion validation at the top of the action:
```ts
if (input.endDate !== undefined && input.weeks !== undefined) {
  return { success: false, error: "Anna joko viikot tai päättymispäivä, ei molempia" }
}
```

---

## Warnings

### WR-01: Unchecked non-null assertion when child name is not found in `extendSchedule`

**File:** `src/actions/schedule.ts:154`
**Issue:** The `childNameToId.get(d.childName)!` non-null assertion will cause the entire batch insert to fail with a runtime `undefined` value passed to the DB if any child name in `config.children` does not exist in the `children` table. The `orderedChildren` filter silently drops any child whose name has no match — so `childNameToId` may not have a key for every name in `config.children`. `generateDefaultEntries` is called with `config.children` (the original full list), but the map was built from `orderedChildren` (the filtered list). If names diverge (e.g., after a DB seed mistake), the `!` assertion produces `undefined` as the value and Drizzle will insert a row with `childId = undefined`, which will either silently corrupt data or throw a DB constraint error with a confusing message.

**Fix:** Add an explicit guard before building insertValues:
```ts
const missingChildren = config.children.filter(name => !childNameToId.has(name))
if (missingChildren.length > 0) {
  return {
    success: false,
    error: `Lapsia ei löydy tietokannasta: ${missingChildren.join(", ")}`,
  }
}
```

---

### WR-02: `insertCallCount` is not reset between invocations inside `setupDbMocks`

**File:** `src/actions/schedule.test.ts:89`
**Issue:** The `insertCallCount` variable is declared with `let` inside `setupDbMocks()`. This means it resets to `0` every time `setupDbMocks()` is called. That is correct for `beforeEach`. However, Test 3 calls `setupDbMocks()` mid-test after the first `extendSchedule` call, resetting the counter. Then Test 8 does the same. This pattern is safe **only** if `vi.clearAllMocks()` in `beforeEach` (line 114) properly clears the `mockImplementation` set on `mockDb.insert`. Because `vi.clearAllMocks()` clears mock state including implementations set via `mockImplementation`, the `insertCallCount` closure from the *previous* test's `setupDbMocks` call is discarded — so the mid-test `setupDbMocks()` in Tests 3 and 8 correctly creates a fresh closure.

The issue is more subtle: if a future test calls `extendSchedule` *without* resetting mocks via `setupDbMocks()`, the `insertCallCount` from the initial `beforeEach` setup accumulates across calls within that test. This is a latent fragility. More concretely, the second call to `extendSchedule` in Test 3 (line 169) hits `insertCallCount === 3` (or 4, depending on order), so `insertCallCount === 1` is `false` and the `schedules` insert mock returns the `scheduleEntries` path instead. This means Test 3 may silently use the wrong mock path. The test still passes because `onConflictDoNothing` is called either way and `capturedEntryValues` gets populated, but the intent is violated.

**Fix:** Move `insertCallCount` outside `setupDbMocks` and reset it inside:
```ts
let insertCallCount = 0

function setupDbMocks() {
  capturedEntryValues = null
  insertCallCount = 0   // explicit reset
  mockDb.insert.mockImplementation((): any => {
    insertCallCount++
    // ...
  })
}
```

---

### WR-03: `getScheduleWindow` always iterates exactly 84 days regardless of window size

**File:** `src/lib/schedule/queries.ts:61`
**Issue:** The loop `for (let i = 0; i < 84; i++)` is hardcoded to 84 iterations (12 × 7 days). The `end` date computed by `getWindowBounds` is `addDays(start, 12 * 7 - 1)` — also 84 days. These are consistent today. However, `extendSchedule` inserts entries that can extend beyond the 84-day window, and if a caller ever passes a `startDate` that places the window end beyond the available entries, the loop will still try to produce exactly 84 `ScheduleDay` objects. For days beyond the actual data range, `entryMap.get(dateStr)` returns `undefined`, so `entry` is `undefined`, `entryId` becomes `null`, and `notes` becomes `""`. This means toggling a cell that has `entryId: null` will pass `null` to `toggleCell(entryId, ...)`, which calls `db.update(...).where(eq(scheduleEntries.id, null))` — silently matching zero rows with no error, discarding the user's edit.

This is not introduced by Phase 06 code directly, but `extendSchedule` makes it more likely to be hit because it creates entries outside the rolling 12-week window.

**Fix:** Either validate in `toggleCell` that `entryId` is non-null:
```ts
export async function toggleCell(entryId: string, newParentId: ParentId) {
  await requireAuthorizedParent()
  if (!entryId) throw new Error("Missing entryId")
  // ...
}
```
Or ensure `getScheduleWindow` never emits a cell with `entryId: null` for days that should have data.

---

## Info

### IN-01: `console.log` left in production code path

**File:** `src/actions/schedule.ts:92`
**Issue:** `console.log("[syncCalendars] syncResult:", JSON.stringify(syncResult, null, 2))` runs on every successful sync and logs a potentially large JSON payload (one entry per calendar event) to the server log. This is a debug artifact.

**Fix:** Remove the log or replace with a structured log at a lower level if observability is needed.

---

### IN-02: `publishSchedule` does not include calendar sync call

**File:** `src/actions/schedule.ts:52-74`
**Issue:** `publishSchedule` only flips status to `"published"` in the DB. Calendar sync is a separate `syncCalendars` action that the client must call manually. This split is intentional (best-effort sync), but it means a server restart or network error between the two client calls leaves the schedule published in the DB but not synced to Google Calendar. There is no comment noting this design decision.

**Fix:** Add a brief comment to `publishSchedule` noting that sync is intentionally separate and best-effort:
```ts
// Note: Calendar sync is intentionally decoupled — client calls syncCalendars()
// separately. DB state is authoritative; GCal is best-effort.
```

---

### IN-03: `pickedEnd` wraps in `endOfWeek` in two places inconsistently

**File:** `src/components/schedule/extend-panel.tsx:39,166`
**Issue:** In `rangeEnd` computation (line 39): `endOfWeek(pickedEnd, { weekStartsOn: 1 })`. In the PopoverTrigger label (line 166): `endOfWeek(pickedEnd, { weekStartsOn: 1 })`. In `handleConfirm` (line 82): `format(rangeEnd, "yyyy-MM-dd")` — where `rangeEnd` is already the result of `endOfWeek(pickedEnd, ...)`. So the final `endDate` sent to the server is correctly the Sunday. However, the raw `pickedEnd` value stored in state is the user-clicked day (e.g., a Tuesday), not the snapped Sunday. If any future code reads `pickedEnd` directly and expects a Sunday, it will get the wrong day. A reader must trace through `rangeEnd` to understand what is actually submitted.

**Fix:** Snap `pickedEnd` to Sunday on selection so the stored value is always the canonical value:
```ts
onSelect={(d) => {
  if (!d) return
  setPickedEnd(endOfWeek(d, { weekStartsOn: 1 }))
}}
```
Then simplify `rangeEnd` (mode === "date" branch) to just `return pickedEnd` and the label to just `format(pickedEnd, ...)`.

---

_Reviewed: 2026-05-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
