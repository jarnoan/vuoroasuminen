# Phase 7: Clear Entries - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Either parent can remove child assignments from individual cells or date ranges, leaving them unassigned (no parent, no color). Clearing is immediate — no separate draft state for the clear action itself. GCal cleanup for previously-published cells happens on the next publish. This phase does not change the draft→publish mental model for assignments.

</domain>

<decisions>
## Implementation Decisions

### Clear = Immediate, No Draft State (CLEAR-01, CLEAR-02)
- **D-01:** Clearing is immediate — the cell switches to unassigned (—) right away. There is no "cleared draft" visual state distinct from "unassigned."
- **D-02:** DB implementation: set `parentId = NULL` on the schedule_entry row rather than deleting the row. This preserves the row (and its `gcal_events` link) so the next publish sync can detect and delete the Google Calendar event. Schema migration required: `parentId text NOT NULL` → `parentId text` (nullable).
- **D-03:** GCal cleanup for previously-published cells happens on the next publish, not immediately on clear. Consistent with how reassignments already work — publish is the sync trigger.

### Single Cell Clear Trigger (CLEAR-01)
- **D-04:** Assigned cells show a `×` button on hover/focus. Clicking the cell body toggles (father ↔ mother, same as before). Clicking `×` clears the cell to unassigned.
- **D-05:** Unassigned cells (—) are clickable: clicking one creates a new assignment (father first). Subsequent clicks toggle normally. This makes accidentally-cleared cells recoverable without using extend.

### Bulk Clear UI (CLEAR-02)
- **D-06:** A `[ × Tyhjennä päiväväli ]` button sits below the schedule table (same position zone as `[ + Lisää viikkoja ]`). Clicking it opens an inline expansion panel — same pattern as `ExtendPanel`.
- **D-07:** The panel contains: start date picker, end date picker, a live preview (`Tyhjennetään: N päivää (M lasta)`), and `[ Vahvista ]` / `[ Peruuta ]` buttons.
- **D-08:** Confirms clears ALL children within the date range (per CLEAR-02 requirements). No per-child selection.
- **D-09:** After confirm: view stays in current position. No URL navigation (contrast with extend which auto-navigates to the new range).

### Claude's Discretion
- Exact hover × button styling and positioning within the cell (small, top-right corner or inline)
- Pending/loading state during Server Actions (disable Vahvista + show spinner while in flight)
- Notes handling: if the cleared entry holds the day's shared notes (`notesEntryId`), migrate notes to another entry for that day before setting parentId = null — or omit notes field on the cleared row
- Server Action signatures: `clearCell(entryId: string)` and `clearRange(startDate: string, endDate: string)`
- Optimistic update strategy for bulk clear (update visible cells in local state, re-fetch on return)
- GCal sync logic: on publish, entries with `parentId = NULL` and `status = 'published'` should have their GCal events deleted, then the rows themselves deleted (or parentId left as null permanently if no GCal event existed)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Clear Entries — CLEAR-01, CLEAR-02 definitions

### Roadmap
- `.planning/ROADMAP.md` §Phase 7 — goal, success criteria, UI hint

### Existing implementation (read before touching)
- `src/db/schema/domain.ts` — `scheduleEntries.parentId text NOT NULL` must become nullable; `gcal_events` cascade-on-delete relationship
- `src/lib/schedule/types.ts` — `ScheduleCell.entryId: string | null` (null = unassigned, already handled); `parentId: ParentId` type needs to allow null in cleared state
- `src/actions/schedule.ts` — `toggleCell` pattern for mutation + auth guard; `extendSchedule` for batch insert pattern
- `src/components/schedule/schedule-cell.tsx` — extend with `×` button and `onClear` prop
- `src/components/schedule/schedule-table.tsx` — `handleToggle` pattern; add `handleClear` and `handleAssignEmpty`; unassigned cells (entryId = null) currently render inert `<span>—</span>` — make clickable
- `src/components/schedule/extend-panel.tsx` — UI pattern to follow for `ClearPanel`
- `src/components/schedule/dashboard-shell.tsx` — integration point: add `<ClearPanel>` below `<ExtendPanel>`
- `src/components/ui/popover.tsx` + `src/components/ui/calendar.tsx` — already installed; reuse for date pickers in panel
- `src/lib/gcal/sync.ts` — sync must handle entries with `parentId = NULL`: delete their GCal events on publish

### Prior phase context
- `.planning/phases/05-view-window-control/05-CONTEXT.md` — URL navigation pattern, router.replace()
- `.planning/phases/06-extend-schedule/06-CONTEXT.md` — inline panel pattern, Server Action mutation, onConflictDoNothing

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ExtendPanel` (`src/components/schedule/extend-panel.tsx`): inline panel with shadcn Popover/Calendar, confirm/cancel flow — copy structure for `ClearPanel`
- `ScheduleCell` (`src/components/schedule/schedule-cell.tsx`): extend with hover `×` button and `onClear` callback prop
- shadcn `Popover` + `Calendar` already installed: use for start/end date pickers in `ClearPanel`
- `Button` (`src/components/ui/button.tsx`): all buttons in the panel

### Established Patterns
- Server Component fetches data → Client Component handles UI → Server Action mutates
- Optimistic local state update in `handleToggle` (schedule-table.tsx) → follow same pattern for `handleClear`
- `date-fns` + `fi` locale for date label formatting in panel preview
- Auth guard in every Server Action: `requireAuthorizedParent()`

### Integration Points
- `src/db/schema/domain.ts`: schema migration — `parentId text NOT NULL` → `parentId text` (nullable)
- `src/lib/schedule/types.ts`: `ScheduleCell.parentId` type needs update (allow null for cleared state)
- `src/components/schedule/schedule-table.tsx`: update cell renderer — assigned cells get `onClear` prop; unassigned cells (`entryId = null`) get a clickable element that calls `handleAssignEmpty(childId, day)`
- `src/components/schedule/dashboard-shell.tsx`: render `<ClearPanel>` below `<ExtendPanel>` in main section
- `src/lib/gcal/sync.ts`: update publish sync to handle null-parentId entries

</code_context>

<specifics>
## Specific Ideas

- Hover × button mockup:
  ```
  [ Isa × ]   ← × appears on hover/focus, click × to clear
  ```
- Bulk clear panel mockup:
  ```
  [ × Tyhjennä päiväväli ]

  ┌──────────────────────────────────────┐
  │  Alkaen: [ ma 12.5.2026 📅 ]          │
  │  Päättyy: [ su 31.8.2026 📅 ]          │
  │                                      │
  │  Tyhjennetään: 112 päivää (2 lasta)   │
  │                                      │
  │  [ Vahvista ]  [ Peruuta ]            │
  └──────────────────────────────────────┘
  ```
- After bulk clear: view stays in current position (no auto-navigation, unlike extend)
- After clicking an unassigned (—) cell: assigns to father first (matches alternating default pattern first choice)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 07-clear-entries*
*Context gathered: 2026-05-06*
