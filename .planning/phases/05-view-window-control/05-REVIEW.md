---
phase: 05-view-window-control
reviewed: 2026-05-04T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - package.json
  - src/app/dashboard/__tests__/page.test.ts
  - src/app/dashboard/loading.tsx
  - src/app/dashboard/page.tsx
  - src/components/schedule/dashboard-shell.tsx
  - src/components/schedule/schedule-table.tsx
  - src/components/schedule/view-toolbar.tsx
  - src/components/ui/calendar.tsx
  - src/components/ui/popover.tsx
  - src/lib/schedule/__tests__/generate-default.test.ts
  - src/lib/schedule/generate-default.ts
  - src/lib/schedule/queries.ts
  - vitest.config.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-05-04
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Phase 05 adds view-window control: a URL-driven `viewStart` search param that shifts the 12-week schedule window, a `ViewToolbar` with prev-week and date-picker navigation, and a `getWindowBounds` helper that accepts the pre-validated start date. The overall design is sound — validation is centralized in the RSC page, the toolbar is a pure client component, and tests cover the core helper logic.

Four warnings were found: a potential crash when the DB insert returns no rows; an unsafe non-null assertion when mapping child names to IDs; a timezone-mismatch risk in the date-comparison loop; and a missing `Suspense` boundary required by `useSearchParams`. Three info items cover a misleading test comment, duplicate publish-state logic, and a structural assumption about per-day notes.

---

## Warnings

### WR-01: Unguarded destructure of `db.insert().returning()` result

**File:** `src/lib/schedule/queries.ts:29`
**Issue:** `const [schedule] = await db.insert(schedules).values({}).returning()` destructures the first element of the returned array. If the insert silently returns an empty array (e.g., due to an `onConflictDoNothing` policy added later, or a driver quirk), `schedule` is `undefined` and the subsequent `schedule.id` access on line 36 throws `TypeError: Cannot read properties of undefined`. The seeding block has no try/catch, so the error propagates as an unhandled Server Action failure.

**Fix:**
```typescript
const returning = await db.insert(schedules).values({}).returning()
const schedule = returning[0]
if (!schedule) {
  throw new Error("Failed to create schedule record — insert returned no rows")
}
```

---

### WR-02: Non-null assertion on child name lookup (`!`) can silently produce `undefined`

**File:** `src/lib/schedule/queries.ts:36`
**Issue:** `childNameToId.get(d.childName)!` asserts the value is non-null. If `config.children` contains a name that was not inserted into the `children` DB table (or the name casing differs), `.get()` returns `undefined`, the `!` assertion suppresses the TypeScript error, and the value `undefined` is passed as `childId` to the insert. This triggers a DB-level null constraint violation or silently inserts an invalid row, making the failure mode non-obvious and distant from the root cause.

**Fix:**
```typescript
const childId = childNameToId.get(d.childName)
if (!childId) {
  throw new Error(`Child not found in DB: "${d.childName}". Ensure DB is seeded before generating schedule entries.`)
}
insertValues.push({ scheduleId: schedule.id, childId, day: d.day, parentId: d.parentId, status: "draft" as const })
```
(Change the `defaults.map(...)` to a loop so you can throw early.)

---

### WR-03: Timezone mismatch risk in `generateDefaultEntries` date-comparison loop

**File:** `src/lib/schedule/generate-default.ts:24`
**Issue:** `while (current <= windowEnd)` compares two `Date` objects by numeric value. `windowEnd` is computed via `addDays(start, 83)` where `start` may come from `parseISO(startDate)` (UTC midnight) or `startOfWeek(startOfToday())` (local midnight). `addDays` preserves the time component, so the loop boundary is correct when both dates originate from the same source. However, if the app is ever deployed in a timezone where `startOfToday()` returns a date with a non-zero time offset, `windowEnd` and `current` could have different time components, and the final day could be skipped. The `queries.ts` caller correctly derives both `windowStart` and `windowEnd` from the same `getWindowBounds` call, so the risk is currently low but fragile.

**Fix:** Normalize both bounds to midnight UTC when computing the window, or use date-fns `isBefore`/`isEqual` comparisons which are time-component-aware:
```typescript
// In generate-default.ts, replace the while condition:
while (!isAfter(current, windowEnd)) { ... }
// And import isAfter from date-fns
```
This makes the boundary comparison semantically explicit regardless of time components.

---

### WR-04: `useSearchParams()` requires a `<Suspense>` boundary

**File:** `src/components/schedule/view-toolbar.tsx:19`
**Issue:** `useSearchParams()` in a Client Component causes Next.js to deopts the entire subtree to client-side rendering unless the component is wrapped in `<Suspense>`. Without a `Suspense` boundary, Next.js 15 will throw a warning (and in some configurations an error) during static generation or streaming. `DashboardShell` renders `<ViewToolbar>` directly at line 34 without a boundary.

In practice the dashboard page is fully dynamic (reads `searchParams` in the RSC), so static generation is already opted out. However, the pattern is fragile — adding ISR or edge caching later would cause a hard error.

**Fix:** Wrap `ViewToolbar` in `Suspense` in `dashboard-shell.tsx`:
```tsx
import { Suspense } from "react"

// Inside DashboardShell render:
<Suspense fallback={<div className="h-10 border-b" />}>
  <ViewToolbar initialViewStart={initialViewStart} />
</Suspense>
```
The `loading.tsx` already has a matching `h-10 border-b` placeholder that can serve as the fallback.

---

## Info

### IN-01: Misleading test comment — date is not a Monday

**File:** `src/lib/schedule/__tests__/generate-default.test.ts:52`
**Issue:** The test comment says `"Monday passed directly"` but passes `"2026-04-28"`, which is a **Tuesday**. The test correctly verifies that `getWindowBounds` uses the provided date as-is (trusting the caller to snap), but the comment will confuse future readers who check against a calendar.

**Fix:**
```typescript
it("uses the provided date as start (caller is responsible for snapping)", () => {
  // 2026-04-28 is a Tuesday — getWindowBounds trusts the caller, no snapping applied
  const { start } = getWindowBounds("2026-04-28")
  expect(toLocalDateStr(start)).toBe("2026-04-28")
})
```

---

### IN-02: Publish-state update duplicated in `DashboardShell` and `ScheduleTable`

**File:** `src/components/schedule/dashboard-shell.tsx:20-28` and `src/components/schedule/schedule-table.tsx:60-67`
**Issue:** The `draft → published` mapping logic is copy-pasted identically in both `handlePublished` (DashboardShell) and `applyPublished` (ScheduleTable). The comment on line 27 of DashboardShell explains why: the shell needs its own `days` state for the publish button, and `ScheduleTable` also needs its internal state updated to make realtime CDC events for published cells no-ops. The duplication is intentional but creates two maintenance points if the status enum ever changes.

**Fix (optional):** Extract a shared pure function:
```typescript
// In a shared utility or schedule/types.ts:
export function applyPublishedStatus(days: ScheduleDay[]): ScheduleDay[] {
  return days.map(day => ({
    ...day,
    cells: day.cells.map(cell =>
      cell.status === "draft" ? { ...cell, status: "published" as const } : cell
    ),
  }))
}
```
Both components import and call this function.

---

### IN-03: Per-day notes use first entry's data — structural assumption

**File:** `src/lib/schedule/queries.ts:64` and `83-84`
**Issue:** `firstEntry` is derived from `dayEntries?.values().next().value` — the first entry in the `Map` for that day, which is insertion-order dependent. Notes (`firstEntry?.notes`) and `notesEntryId` (`firstEntry?.id`) are taken from this arbitrary first entry. The assumption is that notes are per-day (not per-child) and all entries for a day share the same notes field. This is a silent structural coupling: if the schema ever allows per-child notes, or if a notes-only entry is inserted separately, this lookup will silently use the wrong entry's notes.

A more explicit approach would be to store notes in a separate per-day notes field or use a dedicated first-child's entry consistently:
```typescript
const notesEntry = orderedChildren[0] ? dayEntries?.get(orderedChildren[0].id) : undefined
```
This is deterministic (first ordered child) rather than insertion-order-dependent.

---

_Reviewed: 2026-05-04_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
