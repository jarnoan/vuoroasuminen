---
phase: 17-schedule-table-structure
reviewed: 2026-05-21T00:00:00Z
depth: standard
files_reviewed: 1
files_reviewed_list:
  - src/components/schedule/schedule-table.tsx
findings:
  critical: 2
  warning: 4
  info: 2
  total: 8
status: issues_found
---

# Phase 17: Code Review Report

**Reviewed:** 2026-05-21
**Depth:** standard
**Files Reviewed:** 1
**Status:** issues_found

## Summary

Reviewed `src/components/schedule/schedule-table.tsx` — the main schedule grid component responsible for rendering the table, handling optimistic mutations (toggle, clear, assign, notes), and wiring up realtime and publish callbacks. Cross-referenced against `src/lib/schedule/types.ts`, `src/actions/schedule.ts`, `src/components/schedule/notes-cell.tsx`, and `src/components/schedule/schedule-cell.tsx`.

The component has two correctness bugs (one causing silent data loss, one causing a broken revert on the toggle path) and several robustness gaps. No security vulnerabilities were found.

---

## Critical Issues

### CR-01: `handleToggle` revert logic assumes only two parents — breaks with any other `ParentId` value

**File:** `src/components/schedule/schedule-table.tsx:110`

**Issue:** When `toggleCell` throws, the revert calculates the prior `parentId` by hardcoding the inverse:
```typescript
const revertParentId: ParentId = newParentId === "father" ? "mother" : "father"
```
This is the *new* parent ID, not the *prior* one. If the cell originally held any value other than the exact inverse (e.g., the cell was `null` / unassigned, or `ParentId` is later extended), the revert overwrites the cell with a wrong value. More concretely: `handleToggle` is only called from `ScheduleCell.onToggle`, which always supplies `newParentId = parentId === "father" ? "mother" : "father"` — the toggled value — so the revert of `newParentId` back via the same formula produces the pre-toggle value. This logic accidentally works for the current two-parent binary toggle, but it is fragile and incorrect in principle.

The real bug is that the prior value is never captured before the optimistic update; if the server errors partway through a rapid sequence of toggles (user double-clicks), the `days` snapshot captured in the revert closure is already stale, so the revert may restore an intermediate state, not the pre-action state.

**Fix:** Capture the prior value synchronously from `days` before the optimistic update — the same pattern used correctly in `handleClear` and `handleAssignEmpty`:
```typescript
async function handleToggle(entryId: string, newParentId: ParentId) {
  // Capture prior state before optimistic update
  let priorParentId: ParentId | null = null
  for (const day of days) {
    const cell = day.cells.find((c) => c.entryId === entryId)
    if (cell) { priorParentId = cell.parentId; break }
  }

  // Optimistic update
  setDays((prev) => prev.map((day) => ({
    ...day,
    cells: day.cells.map((cell) =>
      cell.entryId === entryId ? { ...cell, parentId: newParentId } : cell
    ),
  })))

  try {
    await toggleCell(entryId, newParentId)
  } catch {
    setDays((prev) => prev.map((day) => ({
      ...day,
      cells: day.cells.map((cell) =>
        cell.entryId === entryId ? { ...cell, parentId: priorParentId } : cell
      ),
    })))
    toast.error("Tallennus epäonnistui. Yritä uudelleen.")
  }
}
```

---

### CR-02: `handleNoteSave` silently drops realtime note updates received while the user is typing

**File:** `src/components/schedule/schedule-table.tsx:225-248`

**Issue:** `handleNoteSave` performs an optimistic update by calling `setDays` with the new `notes` value immediately, before `await saveNotes(...)`. If a realtime event arrives from the other parent between the optimistic update and the server response, the `handleRealtimeEntry` callback (line 33-49) checks `isNotesEntry` and writes the remote notes into `days`. However, when `saveNotes` then fails and the revert runs (line 241-245), it restores `priorNotes` that was captured *before* the optimistic update — potentially overwriting the remote realtime update that arrived in between.

More critically, there is no guard for the case where `day.notesEntryId` is `null` on entry to `handleNoteSave`. The function receives `entryId: string` (already guarded at `NotesCell` level by the `disabled={entryId === null}` prop), but the matching loop at line 228 uses `day.notesEntryId === entryId`. If `notesEntryId` is `null` for all days (empty schedule), `priorNotes` stays `""` and `setDays` silently no-ops — this is safe. The actual concern is the revert stomping remote data; this is a correctness gap, not a crash.

**Fix:** After a successful `saveNotes`, do not touch state — the realtime event from the server will carry the authoritative value. On failure, revert only if the user's notes have not been superseded by a more recent remote update. A simple guard:
```typescript
async function handleNoteSave(entryId: string, notes: string) {
  let priorNotes = ""
  for (const day of days) {
    if (day.notesEntryId === entryId) { priorNotes = day.notes; break }
  }

  setDays((prev) =>
    prev.map((day) =>
      day.notesEntryId === entryId ? { ...day, notes } : day
    )
  )
  try {
    await saveNotes(entryId, notes)
  } catch {
    // Only revert if the local state still matches what we optimistically set
    setDays((prev) =>
      prev.map((day) =>
        day.notesEntryId === entryId && day.notes === notes
          ? { ...day, notes: priorNotes }
          : day
      )
    )
    toast.error("Muistiinpanon tallennus epäonnistui.")
  }
}
```

---

## Warnings

### WR-01: `colCount` miscalculates when `days[0]` is undefined — renders broken colspan

**File:** `src/components/schedule/schedule-table.tsx:251-252`

**Issue:**
```typescript
const childNames = days[0]?.cells.map((c) => c.childName) ?? []
const colCount = childNames.length + 3
```
When `days` is empty (e.g., loading state, or the window has been cleared entirely), `childNames` is `[]` and `colCount` is `3`. The week-separator row uses `colSpan={colCount}`, producing `colSpan={3}` instead of the actual number of rendered columns (which is 0 children + 3 = 3 in this edge case, so it happens to be harmless). However, the formula comment says `Date + children + mobile-notes-btn + desktop-notes` which is 4 structural columns when there are no children — the constant `3` should be `4`. With 2 children the table actually has 5 columns but `colCount` is 5, which is correct for the 2-child case if the "mobile-notes-btn" column is always present (it is, on all breakpoints it is a `table-cell`). Re-auditing: `<th>Päivä</th>` + N child `<th>` + implicit mobile-notes-td (no `<th>`) + `<th>Muistiinpanot</th>`. The thead row has only N+2 `<th>` elements (the mobile add-note `<td>` has no header). So `colCount = N + 3` correctly counts 4 columns when the mobile-notes `<td>` is included. No functional bug here in the 2-child typical case, but the formula is underdocumented and the missing-days edge case should be hardened.

**Fix:** Guard the week-label `colSpan` against the empty-days case or derive it from the actual column count:
```typescript
const colCount = Math.max(childNames.length + 3, 1)
```

### WR-02: `handleRealtimeEntry` matches cells by `entryId === null` fallback — can assign update to wrong cell

**File:** `src/components/schedule/schedule-table.tsx:40`

**Issue:**
```typescript
cell.entryId === entry.id || (cell.childId === entry.childId && cell.entryId === null)
```
The second OR clause matches *any* cell on the same day with a matching `childId` AND a null `entryId`. If a schedule is partially seeded and multiple children share names (or a bug in the seed produces two null-entryId cells for the same child on the same day), this would incorrectly hydrate more cells than intended. More practically: when the realtime event arrives for a child whose cell has `entryId === null` on the client, the update correctly assigns the `entryId` — but if the event arrives late and the cell has already received an `entryId` from a prior realtime event, the first clause handles it and the second clause is a no-op (good). The subtle bug is that this can match a cell for the *wrong* child if the realtime event's `entry.childId` matches a cell that was already assigned a different entry. Given the data model (one entry per `(childId, day)`), this is extremely unlikely but not impossible during race conditions.

The more immediate concern: `entry.status` is applied but `entry.parentId` updates are applied without checking whether the event is for the correct `day`. The outer `day.date !== entry.day` guard on line 35 handles this, but inside the `.cells.map()` the filter relies on `entryId` identity, not on verifying the cell's `childId` matches `entry.childId` when matching by `entryId`. A realtime event for a child can match a cell of a different child if somehow `entryId` values collide (UUIDs: negligible risk, but worth noting).

**Fix:** Tighten the fallback match to also verify `childId` consistency when matching by `entryId`:
```typescript
cells: day.cells.map(cell =>
  (cell.entryId === entry.id && cell.childId === entry.childId)
    || (cell.childId === entry.childId && cell.entryId === null)
    ? { ...cell, entryId: entry.id, parentId: entry.parentId, status: entry.status }
    : cell
),
```

### WR-03: `handleAssignEmpty` falls back to `parents[0]?.id` when `currentParentId` is undefined — may assign to wrong parent silently

**File:** `src/components/schedule/schedule-table.tsx:189`

**Issue:**
```typescript
const assignedParentId = currentParentId ?? parents[0]?.id ?? ("father" as ParentId)
```
If `currentParentId` is not passed (it is optional in the interface, line 27), clicking the "assign" button assigns the cell to the first parent in the `parents` array, not the logged-in user. The triple-fallback chain also ends in a hardcoded `"father"` string — if `parents` is empty, any click silently assigns to "father" without any user feedback. There is no visible indication to the user which parent was assigned; the optimistic update applies the change, and only an error toast fires if the server rejects it.

**Fix:** If `currentParentId` is undefined and `parents[0]` is also absent, show a toast error instead of silently falling back:
```typescript
const assignedParentId = currentParentId ?? parents[0]?.id
if (!assignedParentId) {
  toast.error("Kirjaudu sisään merkintöjen lisäämiseksi.")
  return
}
```

### WR-04: Mobile notes expansion state (`notesOpenDates`) is never cleared when `days` changes

**File:** `src/components/schedule/schedule-table.tsx:93`

**Issue:** `notesOpenDates` is a `Set<string>` of ISO date strings for which the mobile notes row is expanded. When `days` changes (e.g., the user navigates to a different week window or the schedule is reloaded), `notesOpenDates` retains stale date strings that no longer correspond to visible rows. For dates that re-enter the window, the mobile notes row will be rendered expanded even if there are no notes, contradicting the intent of the `!day.notes && !notesOpenDates.has(day.date)` guard on line 325. No crash occurs, but phantom expansion can appear.

**Fix:** Reset `notesOpenDates` when the `days` prop changes structurally (e.g., when the day window shifts). A simple effect:
```typescript
const prevDaysLengthRef = useRef(days.length)
useEffect(() => {
  if (days.length !== prevDaysLengthRef.current) {
    setNotesOpenDates(new Set())
    prevDaysLengthRef.current = days.length
  }
}, [days.length])
```
Or, if the `days` array is a stable reference per window, use `days` directly as the dependency.

---

## Info

### IN-01: `colCount` constant `3` is a magic number with a misleading comment

**File:** `src/components/schedule/schedule-table.tsx:252`

**Issue:** The comment says `// Date + children + mobile-notes-btn + desktop-notes` which lists 4 extra columns, but the constant adds 3. The mobile-notes-btn `<td>` does not have a `<th>` header and is not counted in `<thead>`. The constant is mathematically correct for the data rendered, but the comment is misleading and will cause future confusion when columns are added.

**Fix:** Update the comment to accurately describe what `+3` accounts for (`+1 date-col + 1 mobile-notes-td + 1 desktop-notes-td`) or extract named constants.

### IN-02: `useEffect` for ref assignment performs redundant runtime type guard

**File:** `src/components/schedule/schedule-table.tsx:53`

**Issue:**
```typescript
if (realtimeRef && 'current' in realtimeRef) {
  (realtimeRef as React.MutableRefObject<...>).current = handleRealtimeEntry
}
```
`React.RefObject<T>` always has a `current` property (it may be `null` but the key exists), so `'current' in realtimeRef` is always `true` for any valid ref object. The cast to `React.MutableRefObject` is also needed because `RefObject` types `current` as `readonly` — the runtime check does not provide any actual guard. The same pattern is repeated for `publishRef` (lines 75-82).

**Fix:** Simplify to the type cast only, and document why the cast is needed:
```typescript
useEffect(() => {
  if (realtimeRef) {
    // RefObject.current is readonly in types but writable at runtime; cast is intentional
    (realtimeRef as React.MutableRefObject<typeof handleRealtimeEntry | null>).current = handleRealtimeEntry
    return () => { (realtimeRef as React.MutableRefObject<typeof handleRealtimeEntry | null>).current = null }
  }
}, [handleRealtimeEntry, realtimeRef])
```

---

_Reviewed: 2026-05-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
