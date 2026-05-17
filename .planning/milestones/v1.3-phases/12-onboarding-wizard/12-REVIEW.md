---
phase: 12-onboarding-wizard
reviewed: 2026-05-16T00:00:00Z
depth: standard
files_reviewed: 33
files_reviewed_list:
  - src/actions/schedule.test.ts
  - src/actions/schedule.ts
  - src/actions/setup.test.ts
  - src/actions/setup.ts
  - src/app/dashboard/page.tsx
  - src/app/setup/page.tsx
  - src/app/setup/setup-wizard.tsx
  - src/app/setup/step-indicator.tsx
  - src/app/setup/steps/step-calendars.tsx
  - src/app/setup/steps/step-complete.tsx
  - src/app/setup/steps/step-family-data.tsx
  - src/app/setup/steps/step-review.tsx
  - src/components/schedule/clear-panel.tsx
  - src/components/schedule/dashboard-shell.tsx
  - src/components/schedule/schedule-cell.tsx
  - src/components/schedule/schedule-table.tsx
  - src/components/schedule/schedule-with-realtime.tsx
  - src/components/schedule/stats-panel.tsx
  - src/components/ui/command.tsx
  - src/components/ui/input.tsx
  - src/components/ui/label.tsx
  - src/components/ui/radio-group.tsx
  - src/components/ui/select.tsx
  - src/components/ui/separator.tsx
  - src/config/app.test.ts
  - src/config/app.ts
  - src/db/reset.ts
  - src/db/schema/domain.ts
  - src/db/seed.ts
  - src/env.ts
  - src/lib/gcal/sync.ts
  - src/lib/schedule/generate-default.ts
  - src/lib/schedule/queries.ts
findings:
  critical: 2
  warning: 5
  info: 4
  total: 11
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-05-16T00:00:00Z
**Depth:** standard
**Files Reviewed:** 33
**Status:** issues_found

## Summary

This phase introduces the onboarding wizard (`/setup`), migrates app configuration from environment variables to a DB-backed `family_config` table, and adds supporting schedule actions (`extendSchedule`, `clearRange`, `clearCell`). The architecture is well-structured overall — Server Actions are properly guarded, Zod validation is applied, and optimistic UI patterns are consistently used.

Two critical issues were found: a race condition in `extendSchedule` that can create an orphaned `schedules` row when children are missing, and a missing `isPending` guard in the `ClearPanel` `handleConfirm` prevents double-submission protection from taking effect properly. Five warnings cover logic gaps including a stale-closure revert bug in `handleClear`, an unsafe non-null assertion in `queries.ts`, and unrestricted input on calendar IDs. Four informational items cover dead code and minor quality issues.

---

## Critical Issues

### CR-01: Orphaned `schedules` row created before children validation in `extendSchedule`

**File:** `src/actions/schedule.ts:158-166`

**Issue:** The action inserts a new `schedules` row at line 158 (`await db.insert(schedules).values({}).returning()`), then checks whether all configured children exist in the DB at lines 161-167. If any child is missing, the function returns an error — but the `schedules` row already exists and is never rolled back. Each failed call leaks a `schedules` row. Over time this accumulates garbage rows with no referencing entries, and repeated wizard re-submissions after a seeding error will grow the table unboundedly.

**Fix:** Reorder so validation runs before any DB writes:

```typescript
// --- Verify all configured children exist in DB FIRST (before any insert) ---
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

### CR-02: `saveWizardConfig` does not validate that `parent1Id`/`parent2Id` are stored as hardcoded strings — the column values are never user-controlled, but the `firstParent` field is stored as-is from DB and returned by `getAppConfig` with an unsafe cast

**File:** `src/config/app.ts:64`

**Issue:** `getAppConfig` casts `row.firstParent` to `ParentId` without any runtime check: `firstParent: row.firstParent as ParentId`. If the DB contains an unexpected value (manual edit, migration mistake, or a future schema change), this cast silently produces an invalid `ParentId` that propagates throughout the app — into schedule generation, GCal sync, and toggle logic. The same unsafe cast applies to `row.parent1Id` and `row.parent2Id` on lines 47 and 54.

`saveWizardConfig` validates `firstParent` via Zod's `z.enum(["father", "mother"])` on write, but there is no corresponding guard on read.

**Fix:** Validate the cast at read time:

```typescript
const VALID_PARENT_IDS = ["father", "mother"] as const

function assertParentId(val: string, field: string): ParentId {
  if (val !== "father" && val !== "mother") {
    throw new Error(`Invalid ${field} in family_config: "${val}"`)
  }
  return val
}

// In getAppConfig():
return {
  parents: [
    {
      id: assertParentId(row.parent1Id, "parent1Id"),
      // ...
    },
    {
      id: assertParentId(row.parent2Id, "parent2Id"),
      // ...
    },
  ],
  // ...
  firstParent: assertParentId(row.firstParent, "firstParent"),
}
```

---

## Warnings

### WR-01: Stale closure in `handleClear` optimistic revert — revert always uses `"draft"` regardless of original status

**File:** `src/components/schedule/schedule-table.tsx:119-151`

**Issue:** `priorStatus` is declared and initialized to `"draft"` outside the `setDays` updater (line 120), then captured inside the updater callback at line 128 (`priorStatus = cell.status`). However, `setDays` in React is called with a state updater function — the updater runs asynchronously and the outer scope variables `priorParentId` and `priorStatus` are captured by reference. If `setDays` batches the call, the variable may be read before the updater runs, meaning the revert at lines 141-149 could use uninitialized values (`null` and `"draft"`) instead of the actual prior state.

This is a known React pattern pitfall: capturing mutable variables in concurrent updater callbacks. The captured value is only reliably set after React actually calls the updater.

**Fix:** Return the prior values from the updater, then use them in the catch block via a ref or by restructuring:

```typescript
// Capture prior state before the optimistic update
let priorParentId: ParentId | null = null
let priorStatus: "draft" | "published" = "draft"

// First pass: just find the prior state
setDays((prev) => {
  for (const day of prev) {
    for (const cell of day.cells) {
      if (cell.entryId === entryId) {
        priorParentId = cell.parentId
        priorStatus = cell.status
        break
      }
    }
  }
  // Then apply the optimistic update
  return prev.map((day) => ({
    ...day,
    cells: day.cells.map((cell) =>
      cell.entryId !== entryId ? cell : { ...cell, parentId: null, status: "draft" as const }
    ),
  }))
})
```

Alternatively, use `useRef` to store prior state synchronously before calling `setDays`.

---

### WR-02: Non-null assertion on `childNameToId.get(d.childName)!` can throw at runtime

**File:** `src/lib/schedule/queries.ts:37`

**Issue:** The insert values map uses `childNameToId.get(d.childName)!` (non-null assertion). If `generateDefaultEntries` produces a child name that has no corresponding DB row (e.g., a child was added to config after seeding, or the `orderedChildren` filter silently dropped some names), the `!` assertion will produce `undefined` at runtime, which will be sent to the DB as a null `child_id` and violate the NOT NULL constraint — causing an unhandled DB error rather than a clear application error.

The same pattern exists in `src/actions/schedule.ts:174`.

**Fix:** Validate before insert:

```typescript
const insertValues = defaults.map(d => {
  const childId = childNameToId.get(d.childName)
  if (!childId) {
    throw new Error(`Child not found in DB: "${d.childName}"`)
  }
  return {
    scheduleId: schedule.id,
    childId,
    day: d.day,
    parentId: d.parentId,
    status: "draft" as const,
  }
})
```

---

### WR-03: `clearRange` in `schedule.ts` clears entries across ALL children without a per-child scope check — clears across all schedule entries regardless of schedule ownership

**File:** `src/actions/schedule.ts:224-232`

**Issue:** The `clearRange` DB update clears all `schedule_entries` rows whose `day` falls in the range, without filtering by `scheduleId`. If there are multiple schedules in the DB (which `extendSchedule` creates a new `schedules` row each time it runs), rows belonging to older schedules that happen to cover overlapping dates will also be cleared. This is an unintended side effect — the UI intent is to clear the current/active schedule's entries.

**Fix:** Add a schedule scope to the query. The most practical approach given the current schema is to also filter by the canonical `scheduleId` (retrieved from the latest schedule row), or add a `scheduleId` filter based on config. At minimum, document the behavior clearly in a comment so future developers understand the cross-schedule risk.

---

### WR-04: `dashboard/page.tsx` catches all errors from `getAppConfig` and redirects to `/setup`, masking real DB errors

**File:** `src/app/dashboard/page.tsx:33-36`

**Issue:** The `try/catch` block around `getAppConfig()` redirects to `/setup` on any thrown error, not just the expected "Family config not found" error. A transient DB connectivity failure, a Drizzle query error, or any other unexpected exception will silently redirect the user to the setup wizard. This makes it impossible to distinguish "onboarding not done" from "database is down" — both send the user to `/setup`.

**Fix:** Check the error message or type before redirecting:

```typescript
try {
  config = await getAppConfig()
} catch (err) {
  if (err instanceof Error && err.message.includes("Family config not found")) {
    redirect("/setup")
  }
  throw err // Re-throw real errors for Next.js error boundary
}
```

---

### WR-05: Calendar ID validation regex in `step-calendars.tsx` rejects valid IDs containing `%` or `+` characters and has an overly narrow `https?://` check

**File:** `src/app/setup/steps/step-calendars.tsx:72-76`

**Issue:** The validation regex `const bad = /[\s]|https?:\/\//` only rejects whitespace and HTTP URLs. It does not reject obviously invalid formats. More importantly, the client-side validation is the only guard — the server-side Zod schema in `setup.ts` uses `z.string().min(1)` for calendar IDs with no format validation beyond non-empty. A user can submit any non-whitespace string as a calendar ID, and it will be stored and later used in Google Calendar API calls where it will fail with an opaque googleapis error instead of a clear validation message.

The real concern is that errors from `listCalendars` returning `{ success: false }` still allow the user to type a raw ID without format checks, and a typo will only surface as a GCal sync failure much later (after `publishSchedule` is called), with no direct feedback to the user.

**Fix:** Tighten the server-side schema to at least detect gross format errors:

```typescript
parent1CalendarId: z.string()
  .min(1, "Valitse tai syötä kalenterin tunnus")
  .regex(
    /^[a-zA-Z0-9._%+\-@#]+$/,
    "Kalenterin tunnus sisältää kiellettyjä merkkejä"
  ),
```

---

## Info

### IN-01: `_parentAName` unused parameter in `StepFamilyData`

**File:** `src/app/setup/steps/step-family-data.tsx:47`

**Issue:** The `parentAName` prop is destructured with an underscore prefix (`parentAName: _parentAName`) indicating it is intentionally unused. The prop is still declared in the `Props` interface and passed by the caller (`setup-wizard.tsx:75`). If it is truly unused, it should be removed from both the interface and the call site to avoid confusion about its purpose.

**Fix:** Remove the prop from `Props`, the destructuring, and the `setup-wizard.tsx:75` call site — or use it (e.g., display the logged-in user's name as read-only context).

---

### IN-02: `console.log` debug statements left in production action code

**File:** `src/actions/schedule.ts:98`, `src/lib/gcal/sync.ts:87`, `src/lib/gcal/sync.ts:136`

**Issue:** `console.log("[syncCalendars] syncResult:", ...)` in a Server Action logs potentially sensitive data (parent IDs, calendar sync counts) to server stdout on every publish. Similarly, `sync.ts` contains multiple `console.log` calls that will appear in production logs. While useful for debugging, verbose structured logging in production server actions should use a proper logger with log-level control, or be removed if not monitored.

**Fix:** Gate log statements behind a dev check, or replace with a structured logger:

```typescript
if (process.env.NODE_ENV !== "production") {
  console.log("[syncCalendars] syncResult:", JSON.stringify(syncResult, null, 2))
}
```

---

### IN-03: `inviteTokens` table is defined in schema but no migration or RLS policy is referenced — creates ambiguity about its state

**File:** `src/db/schema/domain.ts:79-90`

**Issue:** The `inviteTokens` table is declared in the Drizzle schema with a comment noting "No application logic uses it in Phase 12 (D-13)." This means the table is exported and may be included in `drizzle-kit generate` migrations, but there is no corresponding Supabase RLS policy or migration SQL visible in this phase. Future developers may be confused about whether this table is live in the DB or intentionally deferred. Additionally, if it is in the schema but not migrated, the app schema and DB state are out of sync.

**Fix:** Add a comment clarifying the migration status, or move the definition to a separate file that is conditionally included. Consider also noting the expected Phase 13 usage.

---

### IN-04: `db/seed.ts` and `db/reset.ts` do not guard against being run in a production environment

**File:** `src/db/reset.ts:13-14`, `src/db/seed.ts:6`

**Issue:** `reset.ts` correctly requires `--yes` to proceed, which is a good guard. However, neither file checks `NODE_ENV` or any other environment indicator to prevent accidental production execution. A developer who runs `npx tsx src/db/reset.ts --yes` against a production `DATABASE_URL` (perhaps set in their shell) will silently delete all schedule data. This is a data-loss risk in a multi-environment setup.

**Fix:** Add a production environment guard:

```typescript
if (process.env.NODE_ENV === "production") {
  console.error("Refusing to run reset in production environment.")
  process.exit(1)
}
```

---

_Reviewed: 2026-05-16T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
