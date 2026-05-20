# Phase 17: Schedule Table Structure - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

<domain>
## Phase Boundary

The schedule table gains two structural changes — both rendering-layer only (no schema changes, no new Server Actions):

1. **UI-01 (Week numbers):** A "Viikko X" label row appears above every Monday in the schedule table, including the first week in the view. It replaces the existing hairline separator row.
2. **UI-02 (Desktop full-page scroll):** On desktop (sm+), the inner scroll container (`overflow-y-auto` + fixed height) is removed. The entire page scrolls. The sticky `<thead>` behavior (sticky at viewport top) is preserved and unchanged on both mobile and desktop.

</domain>

<decisions>
## Implementation Decisions

### Week Number Row (UI-01)

- **D-01:** Replace the existing `h-px bg-border` separator row entirely — the "Viikko X" label row IS the separator. No separate hairline is kept.
- **D-02:** The row uses a single `<td colSpan={colCount}>` spanning all columns, with "Viikko X" text left-aligned.
- **D-03:** Typography: `text-xs text-muted-foreground` — muted and small, unobtrusive, consistent with secondary labels in the app.
- **D-04:** Show the week label for **every** week including the very first week in the view (not just at boundaries where `index > 0`). The `isWeekStart` check still gates the row, but the `index > 0` guard is removed.
- **D-05:** Week number source: compute `getISOWeek(new Date(day.date))` directly in the component using `date-fns`. No changes to `ScheduleDay` type or `queries.ts`.

### Desktop Full-Page Scroll (UI-02)

- **D-06:** Remove `sm:overflow-y-auto sm:h-[calc(100svh-8rem)]` from the wrapper `<div>` in `schedule-table.tsx`. On mobile (< sm) these classes were already inactive — mobile already used full-page scroll. No mobile change.
- **D-07:** Auto-scroll to today on mount: change `block: "center"` to `block: "start"` so today's row is the first visible row (consistent across mobile and desktop). Add `scroll-margin-top` to today rows equal to the `<thead>` height to prevent the sticky header from obscuring today on load.
- **D-08:** `thead sticky top-0` is correct for full-page scroll — the app header is not sticky and scrolls away first; the thead then sticks at the viewport top. No change needed to current sticky CSS.
- **D-09:** `ExtendPanel` and `ClearPanel` sit below the table in `<main>` — they scroll naturally with the page. No special behavior needed.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — v1.5 requirements; UI-01 and UI-02 definitions with exact acceptance criteria
- `.planning/ROADMAP.md` Phase 17 — success criteria and UI hint

### Key Implementation Files
- `src/components/schedule/schedule-table.tsx` — primary file to modify; contains the scroll wrapper div, `<thead>`, separator row logic (`isWeekStart`), and auto-scroll effect
- `src/lib/schedule/types.ts` — `ScheduleDay` type (no changes needed; `isWeekStart` and `date` fields already present)
- `src/components/schedule/dashboard-shell.tsx` — shell layout context; verifies no ancestor has `overflow-hidden` that would break sticky

### Prior Art / Lessons
- `.planning/STATE.md` §"Accumulated Context / v1.4" — `position: sticky` thead may break with ancestor `overflow: hidden`; use `overflow-clip` (already addressed in current code)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `isWeekStart: boolean` on `ScheduleDay` — already flags Mondays; drives the separator row and will drive the week label row
- `date-fns` — already used in the project; `getISOWeek` can be imported for week number computation
- Existing separator row pattern (`<tr><td colSpan={colCount} className="h-px bg-border" />`) — replace this with the week label row

### Established Patterns
- `colSpan={colCount}` where `colCount = childNames.length + 3` — use the same formula for the week label row
- `className="sticky left-0 bg-background"` — date column is sticky left; no stickiness needed for the week label row
- `text-muted-foreground` — used for secondary info throughout the table (e.g., empty cell "—" button); consistent for week labels

### Integration Points
- **Scroll behavior:** The `useEffect` auto-scroll (`document.querySelector('[data-today="true"]')`) is in `schedule-table.tsx:85`. Change `block: "center"` → `block: "start"` and add `scroll-margin-top` via Tailwind class on the today `<tr>`.
- **Scroll container:** `<div className="sm:overflow-y-auto sm:h-[calc(100svh-8rem)]">` at line 254 of `schedule-table.tsx` — remove the `sm:` classes to enable full-page scroll on desktop.

</code_context>

<specifics>
## Specific Ideas

- "Viikko 21" is the exact Finnish label format specified in REQUIREMENTS.md and ROADMAP.md.
- The week label row replaces (does not supplement) the existing separator — keeps table compact.
- Week label shown for the first week too — a clean, consistent presentation.
- Auto-scroll positions today as the **first visible row** (not centered), using `block: "start"` + `scroll-margin-top` to handle sticky thead offset.

</specifics>

<deferred>
## Deferred Ideas

- Making the app header sticky on desktop — would require sticky header + top offset for thead. User confirmed current behavior (header scrolls away, then thead sticks) is correct. No sticky header needed.

None beyond the above.

</deferred>

---

*Phase: 17-Schedule Table Structure*
*Context gathered: 2026-05-20*
