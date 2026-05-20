---
phase: 16-schedule-table-reflow-and-stats
fixed_at: 2026-05-20T00:00:00Z
review_path: .planning/phases/16-schedule-table-reflow-and-stats/16-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 16: Code Review Fix Report

**Fixed at:** 2026-05-20
**Source review:** `.planning/phases/16-schedule-table-reflow-and-stats/16-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (2 Critical + 4 Warning; 3 Info findings excluded per scope)
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01: Stale closure in `handleClear` and `handleAssignEmpty`

**Files modified:** `src/components/schedule/schedule-table.tsx`
**Commit:** b882de0
**Applied fix:** Both `handleClear` and `handleAssignEmpty` now capture `priorParentId`/`priorStatus` by iterating over the `days` prop directly (synchronous, before any `setDays` call) rather than capturing them as side-effects inside the `setDays` functional updater. The `setDays` updater is now a pure, side-effect-free function. `handleAssignEmpty` also derives `assignedParentId` from `currentParentId` (new prop, see WR-02) before calling `setDays`.

### CR-02: `handleRealtimeEntry` incorrectly propagates notes

**Files modified:** `src/components/schedule/schedule-table.tsx`
**Commit:** b882de0
**Applied fix:** Added `const isNotesEntry = day.notesEntryId === entry.id` guard inside the `setDays` updater. Notes are now only updated (`notes: isNotesEntry ? (entry.notes ?? "") : day.notes`) and `notesEntryId` only reassigned when the incoming realtime event actually belongs to the notes-bearing entry for that day. Child-cell realtime events no longer touch `day.notes`.

### WR-01: `colCount` calculation counts notes column twice

**Files modified:** `src/components/schedule/schedule-table.tsx`
**Commit:** b882de0
**Applied fix:** Changed `childNames.length + 2` to `childNames.length + 3` with updated comment `// Date + children + mobile-notes-btn + desktop-notes`. The week-separator and mobile-notes expansion `colSpan` now span all rendered columns including the hidden-on-desktop mobile notes button cell.

### WR-02: `handleAssignEmpty` hard-codes `"father"`

**Files modified:** `src/components/schedule/schedule-table.tsx`, `src/components/schedule/schedule-with-realtime.tsx`, `src/components/schedule/dashboard-shell.tsx`, `src/app/dashboard/page.tsx`
**Commit:** ae722e3
**Applied fix:** Threaded `currentParentId?: ParentId` prop through the component hierarchy. `dashboard/page.tsx` now calls `createSupabaseServerClient()`, gets `user.email`, and matches it against `config.parents[].email` to derive `currentParentId`, which is passed down through `DashboardShell` -> `ScheduleWithRealtime` -> `ScheduleTable`. In `handleAssignEmpty`, `assignedParentId` is now `currentParentId ?? parents[0]?.id ?? ("father" as ParentId)` — the hard-coded `"father"` string only serves as a final fallback.

### WR-03: `handleNoteSave` does not revert on failure

**Files modified:** `src/components/schedule/schedule-table.tsx`
**Commit:** b882de0
**Applied fix:** Added `priorNotes` capture before the optimistic `setDays` call (iterating `days` prop synchronously) and a revert `setDays` call in the `catch` block, consistent with the pattern used by `handleClear` and `handleToggle`.

### WR-04: Duplicate `key` props on `<tr>` elements inside Fragment

**Files modified:** `src/components/schedule/schedule-table.tsx`
**Commit:** b882de0
**Applied fix:** Removed `key={`sep-${day.date}`}` from the week-separator `<tr>` and `key={day.date}` from the data `<tr>`. `<React.Fragment key={day.date}>` is the keyed list item; inner `<tr>` elements inside a Fragment do not need their own keys.

## Skipped Issues

None — all in-scope findings were fixed.

---

_Fixed: 2026-05-20_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
