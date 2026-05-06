---
phase: 07-clear-entries
verified: 2026-05-06T12:00:00Z
status: human_needed
score: 13/13 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Hover an assigned cell and verify the × button appears in the top-right corner without layout shift"
    expected: "Small × button becomes visible on hover at opacity-100; disappears when mouse leaves"
    why_human: "CSS opacity transition and hover state cannot be verified with grep; requires a running browser"
  - test: "Click the cell body (not the ×) and verify the parent toggles father ↔ mother"
    expected: "Cell color changes to the other parent; existing toggle behavior is preserved"
    why_human: "Requires a running browser with a DB-backed schedule"
  - test: "Click the × button and verify the cell immediately shows the unassigned (—) state (optimistic update)"
    expected: "Cell transitions to the unassigned button immediately; no spinner or delay visible to user"
    why_human: "Optimistic update timing is a visual/browser concern"
  - test: "Click the unassigned (—) cell and verify it becomes Isä (light blue draft)"
    expected: "handleAssignEmpty fires, cell turns blue-draft, and DB row is updated"
    why_human: "Requires browser interaction and DB state verification"
  - test: "Tab through the grid; verify the × button receives keyboard focus on an assigned cell"
    expected: "focus:opacity-100 rule makes the × button visible when focused via keyboard"
    why_human: "Keyboard accessibility and CSS focus-visible state cannot be verified statically"
  - test: "Open ClearPanel, select both dates, verify the preview line appears: 'Tyhjennetään: N päivää (M lasta)'"
    expected: "Preview updates live as dates are picked; day count is inclusive (differenceInCalendarDays + 1); Vahvista is enabled"
    why_human: "Requires browser interaction with the Popover/Calendar date pickers"
  - test: "Pick endDate before startDate, verify Vahvista is disabled and preview disappears"
    expected: "previewLabel returns null when days <= 0; disabled={isPending || !previewLabel} greys out Vahvista"
    why_human: "Requires browser interaction"
  - test: "Click Vahvista with a valid range; verify panel collapses, cells in range show (—), and focus returns to trigger button"
    expected: "clearRange Server Action called, panel collapses via resetPanel(), queueMicrotask focus fires on triggerRef"
    why_human: "Focus management and real-time cell update require a running browser with a live DB"
  - test: "Try a range exceeding 730 days; verify the error paragraph shows 'Aikaväli on liian pitkä (max 2 vuotta)'"
    expected: "Server returns success: false, error is set in errorMsg, role='alert' paragraph appears with destructive style"
    why_human: "Requires a live Server Action call and browser error display"
---

# Phase 7: Clear Entries Verification Report

**Phase Goal:** Either parent can remove child assignments from individual cells or date ranges, leaving them unassigned
**Verified:** 2026-05-06T12:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria + PLAN frontmatter)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can clear a single cell — the cell shows an empty/unassigned state with no parent color | VERIFIED | `clearCell` action exists at `src/actions/schedule.ts:180`; sets `parentId: null, status: "draft"`; `handleClear` in `schedule-table.tsx:122` performs optimistic update; `cell.entryId && cell.parentId` branch renders `<ScheduleCell>` vs unassigned `<button>` |
| 2 | User can select a start and end date and clear all child assignments within that range in one action | VERIFIED | `clearRange` action at `src/actions/schedule.ts:195`; `ClearPanel` at `src/components/schedule/clear-panel.tsx` wired to it via `await clearRange({startDate, endDate})`; `<ClearPanel />` rendered in `dashboard-shell.tsx:44` below `<ExtendPanel>` |
| 3 | Cleared cells are distinct from assigned cells in the UI and sync correctly through draft/publish | VERIFIED (automated portion) | Three-way render branch (`cell.entryId && cell.parentId` vs unassigned button) is in place. GCal orphan filter (`entry.parentId !== parent.id`) evaluates `null !== "father"` as true — cleared published entries get their GCal events deleted on next publish. Human verification required for visual appearance |
| 4 | `schedule_entries.parent_id` column accepts NULL | VERIFIED | `src/db/schema/domain.ts:34` — `parentId: text("parent_id")` with no `.notNull()` |
| 5 | `ScheduleCell.parentId` TypeScript type accepts null | VERIFIED | `src/lib/schedule/types.ts:9` — `parentId: ParentId \| null` |
| 6 | `clearCell(entryId)` Server Action exists and sets `parentId=NULL`, `status='draft'` | VERIFIED | `src/actions/schedule.ts:180-193` — calls `requireAuthorizedParent()` first; sets `{ parentId: null, status: "draft" }` |
| 7 | `clearRange(input)` Server Action exists, validates dates, sets `parentId=NULL` across the range | VERIFIED | `src/actions/schedule.ts:195-230` — validates with `parseISO`/`isValid`, rejects negative deltas and >730-day ranges; sets `{ parentId: null, status: "draft" }` |
| 8 | Both new Server Actions call `requireAuthorizedParent()` before mutating | VERIFIED | `clearCell` at line 184, `clearRange` at line 202; total `await requireAuthorizedParent()` count in file: 7 (5 pre-existing + 2 new) |
| 9 | `stats.ts` skips cells with `parentId=null` instead of crashing | VERIFIED | `src/lib/schedule/stats.ts:57` — `if (cell.parentId === null) continue` |
| 10 | GCal publish sync deletes Google Calendar events for entries whose `parentId` is now NULL | VERIFIED | `PublishedEntry.parentId: string \| null` at `src/lib/gcal/sync.ts:142`; orphan filter at line 174: `entry.parentId !== parent.id` evaluates `null !== "father"` as true |
| 11 | Hovering an assigned cell reveals a small × button in the corner | VERIFIED (code) | `schedule-cell.tsx:49` — `opacity-0 group-hover:opacity-100 focus:opacity-100 focus-visible:opacity-100`; `aria-label="Tyhjennä"`, `title="Tyhjennä tämä päivä"` |
| 12 | Clicking the × button clears the cell — UI immediately shows unassigned (—) state | VERIFIED (code) | `onClear={handleClear}` at `schedule-table.tsx:275`; `handleClear` sets `parentId: null` optimistically before Server Action resolves |
| 13 | `ClearPanel` is visible below `ExtendPanel` in the dashboard | VERIFIED | `dashboard-shell.tsx:43-44` — `<ExtendPanel ... />` then `<ClearPanel />`; import at line 8 |

**Score:** 13/13 must-haves verified (automated checks). Human verification required for visual and interactive behaviors.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/schema/domain.ts` | `parent_id` nullable column | VERIFIED | Line 34: `parentId: text("parent_id")` — no `.notNull()` |
| `src/lib/schedule/types.ts` | `ScheduleCell.parentId: ParentId \| null` | VERIFIED | Line 9 |
| `src/lib/schedule/queries.ts` | Propagates null when row exists, uses `config.firstParent` when no row | VERIFIED | Line 72: `entry ? (entry.parentId as ParentId \| null) : config.firstParent` |
| `src/lib/schedule/stats.ts` | Null guard before `stats[cell.parentId]++` | VERIFIED | Line 57 |
| `src/actions/schedule.ts` | `clearCell` and `clearRange` exported Server Actions | VERIFIED | Lines 180 and 195 |
| `src/lib/gcal/sync.ts` | `PublishedEntry.parentId: string \| null` | VERIFIED | Line 142 |
| `src/components/schedule/schedule-cell.tsx` | `onClear` prop, hover × button, correct aria | VERIFIED | `onClear: (entryId: string) => void` at line 12; × button with `aria-label="Tyhjennä"` at line 55 |
| `src/components/schedule/schedule-table.tsx` | `handleClear`, `handleAssignEmpty`, three-way render branch | VERIFIED | `handleClear` at line 122, `handleAssignEmpty` at line 160, branch condition at line 268 |
| `src/components/schedule/schedule-with-realtime.tsx` | `EntryUpdate.parentId: ParentId \| null` | VERIFIED | Line 13 |
| `src/components/schedule/clear-panel.tsx` | `ClearPanel` with date pickers, preview, confirm/cancel | VERIFIED | All key patterns present (lines 14, 29, 46, 140, 153, 162, 167) |
| `src/components/schedule/dashboard-shell.tsx` | `<ClearPanel />` below `<ExtendPanel>` | VERIFIED | Lines 43-44 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `schedule-cell.tsx` × button onClick | `schedule-table.tsx handleClear` | `onClear` prop | WIRED | `onClear: (entryId: string) => void` at schedule-cell.tsx:12; `onClear={handleClear}` at schedule-table.tsx:275 |
| `schedule-table.tsx handleClear` | `src/actions/schedule.ts clearCell` | `await clearCell(entryId)` | WIRED | schedule-table.tsx:140 |
| `schedule-table.tsx handleAssignEmpty` | `src/actions/schedule.ts toggleCell` | `await toggleCell(entryId, "father")` | WIRED | schedule-table.tsx:187 |
| `clear-panel.tsx Vahvista button` | `src/actions/schedule.ts clearRange` | `await clearRange({ startDate, endDate })` | WIRED | clear-panel.tsx:46 |
| `dashboard-shell.tsx <main>` | `ClearPanel` | JSX child below ExtendPanel | WIRED | dashboard-shell.tsx:44 |
| `clearCell/clearRange` | `schedule_entries` table | `db.update(...).set({ parentId: null, status: "draft" })` | WIRED | schedule.ts:188-191, 219-226 |
| `src/lib/gcal/sync.ts` orphan filter | GCal event delete | `entry.parentId !== parent.id` evaluating null as true | WIRED | sync.ts:174 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `schedule-table.tsx handleClear` | `cell.parentId` → set to `null` | `clearCell` Server Action → Drizzle `db.update` | Yes — DB mutation confirmed in action | FLOWING |
| `clear-panel.tsx handleConfirm` | `pickedStart`, `pickedEnd` → `clearRange({startDate, endDate})` | User date picker state → `clearRange` Server Action → Drizzle `db.update` | Yes — parameterized bulk UPDATE | FLOWING |
| `queries.ts` cell builder | `entry.parentId` → `ScheduleCell.parentId` | Drizzle `db.select().from(scheduleEntries)` | Yes — reads actual DB column (nullable after migration) | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — requires a running Next.js server and live database for meaningful tests. All Server Actions and UI components require network context.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| CLEAR-01 | 07-01, 07-02 | User can clear a single cell — assignment becomes unassigned | SATISFIED | `clearCell` Server Action + `handleClear` in schedule-table + `onClear` prop in schedule-cell — full chain verified |
| CLEAR-02 | 07-01, 07-03 | User can select a date range and clear all child assignments within it | SATISFIED | `clearRange` Server Action + `ClearPanel` component + wiring in `dashboard-shell.tsx` — full chain verified |

Both CLEAR-01 and CLEAR-02 are the only Phase 7 requirements in REQUIREMENTS.md. Both are addressed and implemented. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `clear-panel.tsx` | 25, 27 | `return null` | Info | These are legitimate early returns inside a `useMemo` hook (`previewLabel`) — not a stub. The returned null disables the Vahvista button and hides the preview. Not a stub. |

No blockers, no TODO/FIXME comments, no hardcoded empty arrays/objects flowing to rendered output.

### Human Verification Required

The automated code checks all pass. The following interactive behaviors require a running browser with a live database to verify:

#### 1. Single-cell clear interaction

**Test:** Sign in, hover an assigned cell in the schedule grid
**Expected:** Small × button appears in the top-right corner of the cell with no layout shift; disappears when hover ends
**Why human:** CSS `group-hover:opacity-100` transition and the `relative group` wrapper positioning cannot be verified without a rendered browser

#### 2. Cell body still toggles on click

**Test:** Click the body area of an assigned cell (not the × button)
**Expected:** Cell color switches to the other parent; `handleToggle` fires, not `handleClear`
**Why human:** Click event routing with `e.stopPropagation()` requires browser event system

#### 3. × button clear and unassigned state

**Test:** Hover a cell, click the × button
**Expected:** Cell immediately becomes the unassigned `—` button (optimistic update); DB row gets `parentId=NULL` on the server
**Why human:** Optimistic UI timing and visual state change require browser

#### 4. Unassigned cell re-assignment

**Test:** Click a `—` unassigned cell
**Expected:** Cell becomes "Isä" (light blue, draft); DB row updated via `toggleCell(entryId, "father")`
**Why human:** Requires browser interaction and DB state check

#### 5. Keyboard accessibility for × button

**Test:** Tab through the schedule grid to an assigned cell's × button
**Expected:** × button becomes visible (opacity-100) when focused; has accessible name "Tyhjennä"
**Why human:** CSS `focus:opacity-100` and keyboard navigation order require browser testing

#### 6. ClearPanel date picker and preview

**Test:** Click `× Tyhjennä päiväväli`, select start and end dates
**Expected:** Live preview shows `Tyhjennetään: N päivää (M lasta)` where N is inclusive day count and M is child count from config
**Why human:** Popover/Calendar interaction requires a running browser

#### 7. ClearPanel invalid range disables Vahvista

**Test:** Pick end date before start date in ClearPanel
**Expected:** Preview disappears; Vahvista button is disabled
**Why human:** Date picker interaction requires browser

#### 8. ClearPanel confirm clears cells and restores focus

**Test:** Select a valid range containing assigned cells, click Vahvista
**Expected:** Panel collapses; visible cells in range become `—`; keyboard focus returns to the `× Tyhjennä päiväväli` trigger button
**Why human:** Focus management (`queueMicrotask` + `triggerRef.current?.focus()`) and real-time cell updates require browser

#### 9. Server-side range validation error surfaced

**Test:** Try a range > 730 days and click Vahvista
**Expected:** Destructive error paragraph appears: `Aikaväli on liian pitkä (max 2 vuotta)`
**Why human:** Requires a live Server Action call and visual error display

### Gaps Summary

No code gaps found. All 13 must-haves are implemented and wired correctly in the codebase. The data foundation (nullable schema, TypeScript types, Server Actions, GCal sync type) is solid. The single-cell clear UI (× button, handleClear, three-way render branch) is fully wired. The bulk clear panel (ClearPanel, DashboardShell integration, clearRange call) is fully wired. Auth guards are in place on both new Server Actions. The stats null guard prevents crashes on cleared cells.

Human verification is required to confirm the visual and interactive behaviors work correctly in a running browser.

---

_Verified: 2026-05-06T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
