# Phase 16: Schedule Table Reflow and Stats - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Three remaining v1.4 mobile requirements — all rendering-layer only (no schema changes, no new Server Actions, no data-flow changes):

- **MOB-01** — Schedule table fits 360–430px viewport without horizontal scrolling
- **MOB-01b** — Each day row on mobile shows child custody cells on top; shared notes text on a second row below (desktop single-row layout unchanged)
- **MOB-05** — Statistics panel positioned below the schedule table on all viewports; redesigned as a child-column grid (replaces existing horizontal flex layout)

</domain>

<decisions>
## Implementation Decisions

### Mobile Scroll Model (MOB-01)
- **D-01:** Page scroll on mobile — the existing `overflow-y-auto h-[calc(100vh-8rem)]` scroll container on `ScheduleTable`'s inner `<div>` becomes `sm:overflow-y-auto sm:h-[calc(100svh-8rem)]`. On mobile (below `sm:` breakpoint), no height constraint — the table grows to its full height and the whole page scrolls naturally. Desktop keeps contained scroll.
- **D-02:** ViewToolbar is NOT sticky on mobile — it scrolls away with the page. No `position: sticky` added to the toolbar. Simple, no extra z-index management.
- **D-03:** Fix existing iOS Safari viewport: `h-[calc(100vh-8rem)]` → `h-[calc(100svh-8rem)]` on the desktop breakpoint. This ensures the scroll container uses the correct viewport height excluding Safari's dynamic toolbar.
- **D-04:** Verify `thead`'s `position: sticky` ancestor does NOT have `overflow-hidden`. If found, replace with `overflow-clip`. (Per STATE.md decision — iOS sticky thead fix.)
- **D-05:** Stats panel moves outside the scroll container — see D-12 below. `renderAbove` in `ScheduleTable` becomes unused after this change.

### Table Column Layout (MOB-01)
- **D-06:** Notes `<td>` in the main day `<tr>` gets `max-sm:hidden` — the `min-w-[160px]` notes column is hidden on mobile. This eliminates the primary horizontal overflow source.
- **D-07:** Child custody columns get `min-w-[72px]` (down from `min-w-[90px]`) on mobile via responsive class. Sticky date column stays with `position: sticky left-0 z-10 bg-background`.
- **D-08:** The notes `<th>` column header also gets `max-sm:hidden`.

### Two-Row Notes Layout (MOB-01b)
- **D-09:** A conditional second `<tr>` is rendered immediately after each day's main row on mobile, ONLY when `day.notes` is non-empty. This second row has a single `<td colSpan={childCount + 2}>` (spanning date + all child columns) containing the existing `NotesCell` component. The `<tr>` itself gets `max-sm:table-row sm:hidden` (visible on mobile, hidden on desktop).
- **D-10:** The `NotesCell` in the second row is fully editable on mobile — same component, same tap-to-edit behavior. No read-only mode.
- **D-11:** When a day has no notes, a small + icon button appears in the main day `<tr>` on mobile to allow adding notes. Position: a trailing `<td>` or `<span>` within the notes `<td>` (hidden on mobile via `max-sm:flex sm:hidden`). Tapping it triggers the notes editor for that day. Exact placement within the row is Claude's discretion (after the last child cell is the suggested position).
- **D-12:** Desktop layout is UNCHANGED — one `<tr>` per day with notes as the final `<td>` in the same row.

### Statistics Panel Architecture (MOB-05)
- **D-13:** `StatsPanel` moves OUTSIDE and BELOW `ScheduleTable`'s scroll container. In `ScheduleWithRealtime`, `StatsPanel` is rendered as a sibling AFTER `<ScheduleTable />` — not via `renderAbove`. The `renderAbove` prop in `ScheduleTable` becomes unused (leave or remove — Claude's discretion).
- **D-14:** Stats panel displays as a child-column grid on ALL viewports (mobile and desktop). This completely replaces the existing horizontal `flex items-center gap-4` layout.

### Statistics Grid Layout (MOB-05)
- **D-15:** Grid structure — children are columns, parents are rows:
  - **Column headers:** child names (e.g., `| Lapsi1 | Lapsi2 |`), preceded by an empty label column for the row headers
  - **Father row:** row label "Isä" + per-child cells: custody day count on the first line, solo days on a second sub-line below (e.g., `45 pv` / `yksin 12`)
  - **Mother row:** same structure for mother
  - **Separator**
  - **Vapaa Isä row:** full-width spanning row — `Isä X pv (Y vkl)` 
  - **Vapaa Äiti row:** full-width spanning row — `Äiti X pv (Y vkl)`
- **D-16:** Solo days appear as a separate sub-line below the day count within the grid cell (not inline on the same line). Example cell content: `45 pv` on line 1, `yksin 12` on line 2 (smaller/muted text).
- **D-17:** If only 1 child exists, grid degrades to a single data column — Claude's discretion on the exact implementation.
- **D-18:** CSS grid implementation: `grid-cols-[auto_repeat(N,1fr)]` where N = number of children. Or a `<table>` — Claude's discretion on the exact element.

### Claude's Discretion
- Exact position and icon for the mobile "add notes" affordance (+ icon or pencil; after last child cell is suggested)
- Whether to remove or keep the unused `renderAbove` prop from `ScheduleTable`
- Single-child grid degradation details
- Whether to use CSS grid or HTML `<table>` for the stats grid layout
- Whether to show or omit the child name header row in the stats grid
- `touch-action: manipulation` on interactive cells — add to `schedule-cell.tsx` and `notes-cell.tsx` if not already present

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §MOB-01, §MOB-01b, §MOB-05 — requirement definitions, out-of-scope items (card-per-row rejected, native mobile app out of scope)

### Roadmap
- `.planning/ROADMAP.md` §Phase 16 — goal, 5 success criteria (especially SC1: fits 360px; SC2: child cells on top, notes second row; SC3: desktop unchanged; SC4: stats below table; SC5: 2-column grid on mobile)

### Prior phase decisions (carry forward)
- `.planning/phases/15-header-clear-guard-and-toolbar/15-CONTEXT.md` — D-16: `@container` with `@sm:` prefixes is the v1.4 responsive strategy; D-12: CSS toggle pattern (render both, hide via `sm:hidden` / `max-sm:hidden`) — same pattern applies here
- `.planning/phases/14-realtime-reliability-mobile-baseline/14-CONTEXT.md` — D-06: viewport meta already added; D-07: `html { overflow-x: hidden }` already in globals.css; D-08/D-09: safe-area insets and touch-action are component-level (not global)
- `.planning/STATE.md` §v1.4 decisions — sticky date column, `min-w-[72px]`, `overflow-clip` vs `overflow-hidden` (iOS sticky fix), `100svh` replacement, rendering-layer only constraint

### Files to modify
- `src/components/schedule/schedule-table.tsx` — scroll container class (D-01, D-03), thead sticky ancestor check (D-04), notes column hide (D-06, D-07, D-08), two-row notes layout (D-09, D-10, D-11, D-12), remove renderAbove from StatsPanel usage
- `src/components/schedule/stats-panel.tsx` — complete redesign to child-column grid (D-14 through D-18)
- `src/components/schedule/schedule-with-realtime.tsx` — move StatsPanel outside ScheduleTable, render as sibling after ScheduleTable (D-13)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/schedule/notes-cell.tsx` — existing `NotesCell` component; tap-to-edit behavior reused unchanged in the mobile second-row layout
- `lucide-react` — already installed; use `PlusIcon` or `PencilIcon` for the mobile notes affordance
- Tailwind `max-sm:hidden` / `sm:hidden` — already used in Phase 15 (header, toolbar); same CSS-toggle pattern applies here

### Current Layout (what changes)
- `ScheduleTable` line 221: `<div className="overflow-y-auto h-[calc(100vh-8rem)]">` — wrap with `sm:` to add page scroll on mobile
- `ScheduleTable` line 223: `<table className="w-full border-collapse">` — table itself stays; no `overflow-x-auto` wrapper (scrolling is prevented by column width decisions, not by cutting off)
- `ScheduleTable` line 236: `<th ... min-w-[90px]>` — reduce to `min-w-[72px]` on mobile; add `max-sm:hidden` to notes `<th>` (line 237)
- `ScheduleTable` line 286: `<td className="px-1 py-1">` (notes td) — add `max-sm:hidden`
- `stats-panel.tsx` line 19: `<div className="border rounded-lg p-3 mb-4 bg-muted/30 text-sm space-y-1">` with `flex items-center gap-4` rows — full redesign to grid
- `schedule-with-realtime.tsx` line 45: `renderAbove={(days) => <StatsPanel ... />}` — remove; add `<StatsPanel ... />` as sibling after `<ScheduleTable />`

### Established Patterns
- `hidden sm:block` / `max-sm:hidden`: standard responsive visibility — used in Phase 15 header (D-07) and toolbar (D-16)
- CSS toggle (both elements rendered, one hidden per breakpoint) — Phase 15 D-12 for date pickers; same approach for notes column / notes second row
- `border-collapse` table with sticky `thead` — already established; sticky date column follows same `position: sticky left-0` pattern

### Integration Points
- `ScheduleWithRealtime` owns both `ScheduleTable` and `StatsPanel` — moving StatsPanel from inside to after ScheduleTable is a local restructure within this component
- `StatsPanel` receives `days` and `parents` props — same props stay; no data flow change

</code_context>

<specifics>
## Specific Ideas

- Stats grid sketch (confirmed by user):
  ```
            | Lapsi1     | Lapsi2
  ----------+------------+----------
  Isä       | 45 pv      | 38 pv
            | yksin 12   | yksin 10
  Äiti      | 39 pv      | 46 pv
            | yksin 8    | yksin 7
  ----------+------------+----------
  Vapaa Isä  14 pv (3 vkl)
  Vapaa Äiti  9 pv (2 vkl)
  ```
- Solo days style: muted/smaller text on the sub-line (e.g., `text-xs text-muted-foreground`)
- Stats grid colors: keep existing `text-blue-700` for father, `text-rose-700` for mother

</specifics>

<deferred>
## Deferred Ideas

- Safe area insets (`env(safe-area-inset-*)`) — not needed for table/stats; may be needed for Phase 15 elements if iPhone QA reveals issues (already deferred there)
- Per-month or per-term statistics breakdown — out of scope per PROJECT.md
- Collapsible stats panel — out of scope; not discussed

</deferred>

---

*Phase: 16-schedule-table-reflow-and-stats*
*Context gathered: 2026-05-20*
