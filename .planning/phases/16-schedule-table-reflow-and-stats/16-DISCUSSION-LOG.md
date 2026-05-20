# Phase 16: Schedule Table Reflow and Stats - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-20
**Phase:** 16-schedule-table-reflow-and-stats
**Areas discussed:** Mobile scroll model, Notes row behavior, Stats 2-column grid layout

---

## Mobile Scroll Model

| Option | Description | Selected |
|--------|-------------|----------|
| Page scroll on mobile | Remove height constraint on mobile; whole page scrolls naturally; stats fall below table in DOM | ✓ |
| Contained scroll, stats outside | Keep fixed-height scroll container; stats render as separate block outside it | |

**User's choice:** Page scroll on mobile

| Option | Description | Selected |
|--------|-------------|----------|
| Not sticky — toolbar scrolls away | Simpler; toolbar scrolls with the page | ✓ |
| Sticky toolbar on mobile | Toolbar stays pinned as page scrolls; more implementation work | |

**User's choice:** Not sticky — toolbar scrolls away

**Notes:** Page scroll is the natural mobile pattern. Stats will be in normal document flow below the table. Toolbar scrolling away is acceptable for the primary use case (reading/editing days, not repeatedly changing the date).

---

## Notes Row Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Always shown | Second row for every day, even if empty | |
| Only when non-empty | Second row only appears when day.notes has content | ✓ |

**User's choice:** Only when non-empty

| Option | Description | Selected |
|--------|-------------|----------|
| Still editable | Same NotesCell component — tap to edit on mobile | ✓ |
| Read-only on mobile | Notes display as plain text; no editing on mobile | |

**User's choice:** Still editable

| Option | Description | Selected |
|--------|-------------|----------|
| Small + icon in the day row | Compact + icon in main row to trigger note creation | ✓ |
| Tap anywhere on the day row | Tapping the date or an empty area opens the notes editor | |
| Long-press on the day row | Long-press to open notes context | |

**User's choice:** Small + icon in the day row

**Notes:** The + icon is needed for discoverability — without it, users on mobile have no affordance for adding notes to empty days. Exact placement (after last child cell) is Claude's discretion.

---

## Stats 2-Column Grid Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Father col / Mother col | Left = father stats, right = mother stats | |
| Child rows, stats wrap within each row | Each child row wraps father/mother within it | |
| Stacked rows, full-width | No grid; full-width lines that wrap | |

**User's choice (freeform):** Transposed grid — children are columns, parents are rows. One row for father stats, one for mother, then separate freetime rows. User requested a sketch before deciding.

| Option | Description | Selected |
|--------|-------------|----------|
| Freetime in one combined row | Father and mother freetime share one spanning row | |
| Freetime in two separate rows | Vapaa Isä + Vapaa Äiti as two separate full-width rows | ✓ |

**User's choice:** Freetime in two separate rows

| Option | Description | Selected |
|--------|-------------|----------|
| Desktop keeps existing layout | Desktop stays horizontal flex; grid only on mobile | |
| Grid everywhere | Same child-column grid on all viewports | ✓ |

**User's choice:** Grid everywhere

| Option | Description | Selected |
|--------|-------------|----------|
| Sub-row below (as sketched) | Solo days on second line below the day count | ✓ |
| Inline with day count | Solo days in parentheses on same line | |

**User's choice:** Sub-row below (as sketched)

**Notes:** The stats panel becomes a transposed grid where children are columns and parents are rows — a cleaner structure than the existing horizontal per-child rows. The grid applies to all viewports. Freetime stats get their own two rows at the bottom.

---

## Claude's Discretion

- Exact position and icon for the mobile "add notes" affordance (+ icon or pencil; after last child cell suggested)
- Whether to remove or keep the unused `renderAbove` prop from `ScheduleTable`
- Single-child grid degradation (grid with one data column)
- Whether to use CSS grid or HTML `<table>` for the stats panel
- Whether to show or omit the child name header row in the stats grid
- `touch-action: manipulation` on interactive cells — add if not already present

## Deferred Ideas

- Safe area insets — already deferred to Phase 15 if QA reveals notch issues
- Per-month statistics breakdown — out of scope for v1.4
- Collapsible stats panel — not discussed; future milestone if desired
