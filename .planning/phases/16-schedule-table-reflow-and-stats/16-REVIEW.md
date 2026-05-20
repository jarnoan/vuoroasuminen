---
phase: 16-schedule-table-reflow-and-stats
reviewed: 2026-05-20T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - src/components/schedule/schedule-table.tsx
  - src/components/schedule/schedule-with-realtime.tsx
  - src/components/schedule/stats-panel.tsx
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Phase 16: Code Review Report

**Reviewed:** 2026-05-20
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Three files were reviewed: the main schedule table component, the realtime wrapper, and the new stats panel. The realtime plumbing and optimistic-update logic are generally sound. However two bugs rise to BLOCKER severity: a stale-closure in `handleClear` that silently captures the wrong revert values in concurrent edits, and a notes-update logic error in `handleRealtimeEntry` that can silently drop notes from days that have more than one child. Four warnings cover missing error handling, a colCount miscalculation, a missing `key` prop, and a hard-coded "father" default. Three info items cover residual code clarity and a minor accessibility gap.

---

## Critical Issues

### CR-01: Stale closure in `handleClear` — revert values silently capture wrong state under concurrent saves

**File:** `src/components/schedule/schedule-table.tsx:121-155`

**Issue:** `priorParentId` and `priorStatus` are declared as plain `let` variables in the outer function scope and are captured by the `setDays` updater closure. Because `setDays` is called with a functional updater, React may batch or defer the call. If two `handleClear` calls race (e.g., the user double-taps, or a realtime update fires between the optimistic write and the server response), the second closure captures and then overwrites the `priorParentId`/`priorStatus` of the first, so a failure in either reverts the cell to the wrong value. This is a silent data-integrity bug — no crash, but the cell ends up in an incorrect state.

Additionally the pattern tries to capture cell state *inside* a `setDays` functional updater, which is called at an arbitrary future time by React. This is wrong: side effects inside a `setState` updater are not guaranteed to run once, and must not be relied on for capturing state.

**Fix:** Capture the prior values from `days` (the current prop snapshot) *before* calling `setDays`, not inside it:

```tsx
async function handleClear(entryId: string) {
  // Capture prior state from current prop snapshot — safe, synchronous
  let priorParentId: ParentId | null = null
  let priorStatus: "draft" | "published" = "draft"
  for (const day of days) {
    const cell = day.cells.find((c) => c.entryId === entryId)
    if (cell) {
      priorParentId = cell.parentId
      priorStatus = cell.status
      break
    }
  }

  // Optimistic clear
  setDays((prev) =>
    prev.map((day) => ({
      ...day,
      cells: day.cells.map((cell) =>
        cell.entryId === entryId
          ? { ...cell, parentId: null, status: "draft" as const }
          : cell
      ),
    }))
  )

  try {
    const result = await clearCell(entryId)
    if (!result.success) throw new Error(result.error)
  } catch {
    setDays((prev) =>
      prev.map((day) => ({
        ...day,
        cells: day.cells.map((cell) =>
          cell.entryId === entryId
            ? { ...cell, parentId: priorParentId, status: priorStatus }
            : cell
        ),
      }))
    )
    toast.error("Tyhjennys epäonnistui. Yritä uudelleen.")
  }
}
```

The same pattern applies to `handleAssignEmpty` (lines 165–178) which also captures `priorParentId`/`priorStatus` inside a `setDays` updater.

---

### CR-02: `handleRealtimeEntry` incorrectly propagates notes to every day that touches the entry ID

**File:** `src/components/schedule/schedule-table.tsx:31-45`

**Issue:** The realtime handler updates `day.notes` unconditionally for any day whose `date` matches `entry.day`:

```ts
notes: entry.notes ?? day.notes,
```

This line runs even when `entry.id` does not match `day.notesEntryId` and none of the cells matched the entry. When a family has two or more children, each day has *two* `schedule_entries` rows — one per child. Only the first child's entry (`notesEntryId`) actually carries the notes. When the *second* child's entry fires a realtime update with `notes: null`, the expression `null ?? day.notes` keeps the existing value, which is correct. However, when the second child's entry has `notes: ""` (empty string, which is falsy but not null), `"" ?? day.notes` evaluates to `""`, silently clearing the day's notes in the UI. `??` only guards against `null`/`undefined`, not an empty string.

In the current schema `notes` is always either a non-empty string or `null` (enforced by the server action's validation), so the empty-string case may not be triggered today. But the guard is wrong by design and will silently corrupt notes if that invariant ever drifts.

Additionally, the same update block unconditionally overwrites `day.notes` even when the matched entry is a child cell (not the notes entry). The correct behaviour is: only apply the notes update when the matched entry IS the notes entry for that day.

**Fix:**

```ts
const handleRealtimeEntry = useCallback((entry: RealtimeEntry) => {
  setDays(prev => prev.map(day => {
    if (day.date !== entry.day) return day

    const isNotesEntry = day.notesEntryId === entry.id

    return {
      ...day,
      cells: day.cells.map(cell =>
        cell.entryId === entry.id || (cell.childId === entry.childId && cell.entryId === null)
          ? { ...cell, entryId: entry.id, parentId: entry.parentId, status: entry.status }
          : cell
      ),
      // Only update notes when this realtime event is for the notes-bearing entry
      notes: isNotesEntry ? (entry.notes ?? "") : day.notes,
      notesEntryId: isNotesEntry ? entry.id : day.notesEntryId,
    }
  }))
}, [])
```

---

## Warnings

### WR-01: `colCount` calculation is wrong — notes column is counted twice

**File:** `src/components/schedule/schedule-table.tsx:218`

**Issue:**

```ts
const colCount = childNames.length + 2 // Date + children + Notes
```

The comment says "Date + children + Notes" which is `1 + N + 1 = N + 2`. But the rendered table actually has the following columns on mobile:

- 1 sticky date column
- N child columns
- 1 mobile notes-button column (`max-sm:table-cell sm:hidden`, line 289)
- 1 desktop notes column (`max-sm:hidden`, line 302)

On desktop the mobile notes-button column is hidden (`sm:hidden`) but it is still a rendered `<td>` that participates in the table model. The week-separator `<tr>` uses `colSpan={colCount}` (line 247) and the mobile notes expansion row uses `colSpan={colCount}` (line 312). On mobile, both rows have 4 columns (`1 + N + 1 + 1 = N + 3` when N=2 → 5), but `colCount` is only `N + 2 = 4`. The separator `<td>` will not span all columns on mobile, leaving a visual gap at the right edge.

**Fix:** The formula should add 3, not 2, to account for both note cells:

```ts
const colCount = childNames.length + 3 // Date + children + mobile-notes-btn + desktop-notes
```

---

### WR-02: `handleAssignEmpty` always hard-codes `"father"` as the default parent

**File:** `src/components/schedule/schedule-table.tsx:177,184`

**Issue:** When a user clicks an empty cell, the optimistic update and the server call both hard-code `"father"` as the assigned parent regardless of who is currently logged in or what the configured `firstParent` is:

```ts
return { ...cell, parentId: "father" as ParentId, status: "draft" as const }
// ...
await toggleCell(entryId, "father")
```

The server `toggleCell` action accepts any `ParentId`, so there is no server-side default — this is purely a UI decision. If a "mother"-role user clicks an empty cell they would expect the cell to be assigned to themselves, not to "father". This is a logic bug rather than just a style preference.

**Fix:** Derive the current user's parentId from the `parents` prop. The logged-in user's parent entry is available to the parent component; it should be threaded down (or the component should derive it from session context). At minimum, avoid hard-coding "father":

```ts
// Derive from props — requires `currentParentId: ParentId` prop or similar
const defaultParentId = currentParentId ?? parents[0]?.id ?? "father"
```

---

### WR-03: `handleNoteSave` optimistic update does not revert on server failure

**File:** `src/components/schedule/schedule-table.tsx:203-213`

**Issue:** When `saveNotes` throws, the catch block only shows a toast — it does not revert the optimistic UI update. Unlike `handleToggle` and `handleClear`, notes do not revert on failure, meaning the local UI can show unsaved text that was never persisted.

```ts
async function handleNoteSave(entryId: string, notes: string) {
  setDays(...)       // optimistic update applied
  try {
    await saveNotes(entryId, notes)
  } catch {
    toast.error(...)  // ← no revert
  }
}
```

**Fix:** Capture the prior value before the optimistic write and revert on failure:

```ts
async function handleNoteSave(entryId: string, notes: string) {
  // Capture prior value
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
    // Revert
    setDays((prev) =>
      prev.map((day) =>
        day.notesEntryId === entryId ? { ...day, notes: priorNotes } : day
      )
    )
    toast.error("Muistiinpanon tallennus epäonnistui.")
  }
}
```

---

### WR-04: Duplicate `key` prop on week-separator `<tr>` — React warning in production

**File:** `src/components/schedule/schedule-table.tsx:243-248`

**Issue:** The outer `<React.Fragment key={day.date}>` (line 243) and the inner week-separator `<tr key={\`sep-${day.date}\`}>` (line 245) are both inside the `days.map()` loop. The Fragment already provides a key for the list item. The `<tr>` inside it has its own `key` prop, which is valid since it is a sibling element — however when there is no separator rendered (i.e., `!day.isWeekStart || index === 0`) the Fragment contains only the main `<tr>` which has no `key` prop. React does not require keys on non-list children inside a Fragment, so this is not a crash, but it is inconsistent and will emit a development warning if the Fragment's children are ever treated as a dynamic list.

More importantly, line 253 assigns `key={day.date}` to the data `<tr>` (line 253) — this is a `key` on a direct child of a Fragment that already has `key={day.date}`. Both the Fragment and the `<tr>` carry the same key string, which React ignores (keys on Fragment children are not forwarded), but it is confusing and will trip up future maintainers.

**Fix:** Remove the redundant `key` props on the inner `<tr>` elements; the Fragment key is the list identifier:

```tsx
<React.Fragment key={day.date}>
  {day.isWeekStart && index > 0 && (
    <tr>                          {/* ← no key needed */}
      <td colSpan={colCount} className="h-px bg-border" />
    </tr>
  )}
  <tr                             {/* ← no key needed */}
    data-date={day.date}
    ...
  >
```

---

## Info

### IN-01: `colCount` variable is computed but used only in two JSX locations — consider inlining or a constant

**File:** `src/components/schedule/schedule-table.tsx:218`

**Issue:** `colCount` is derived from `childNames.length + 2` and used only at lines 247 and 312. The comment `// Date + children + Notes` is already incorrect (see WR-01). Since the value is also wrong and is a small arithmetic expression, it would be clearer as an inline expression with a correct comment at each call site, or as a component-level constant with a clear name like `totalColumnCount`.

**Fix:** After fixing WR-01, rename or add an explanatory comment:

```ts
// 1 (date) + N (children) + 1 (mobile note btn) + 1 (desktop note col)
const totalColCount = childNames.length + 3
```

---

### IN-02: `stats-panel.tsx` — `StatsPanel` has no empty-state handling when `days` is empty

**File:** `src/components/schedule/stats-panel.tsx:13`

**Issue:** `computeStats` derives child names from `days[0]?.cells`, so when `days` is an empty array the stats table renders with zero columns and zero rows, producing an empty bordered box. There is no empty-state message, making it unclear to users whether the panel is loading or the schedule truly has no data.

**Fix:** Add an explicit empty-state guard:

```tsx
if (days.length === 0) {
  return (
    <div className="border rounded-lg p-3 mt-4 bg-muted/30 text-sm text-muted-foreground">
      Ei aikataulutietoja.
    </div>
  )
}
```

---

### IN-03: Mobile notes `<button>` (line 291) has no visible label text — relies solely on `aria-label`

**File:** `src/components/schedule/schedule-table.tsx:291-299`

**Issue:** The mobile "add note" button renders only a `<PlusIcon>` with no visible text. An `aria-label` is present, which covers screen readers. However the icon alone with no tooltip and only an `aria-label` may be unclear to sighted users who are not familiar with the UI. This is a minor UX concern — not a bug — but relevant given the project targets non-technical co-parents.

**Fix:** Consider adding a `title` attribute (tooltip on hover/long-press) or a short visually-hidden label via `sr-only` span. The `title` approach is one line:

```tsx
<button
  ...
  title="Lisää muistiinpano"
  aria-label={`Lisää muistiinpano — ${day.dayLabel}`}
>
```

---

_Reviewed: 2026-05-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
