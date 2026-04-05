# Phase 2: Schedule Table UI - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a readable and editable 12-week (84-row) custody schedule table where both parents can view and change each child's daily assignment in real time. Alternating-week defaults are pre-filled on first load. Draft state is visually distinct from published. Shared notes are editable inline. No publish/approve flow (Phase 3), no statistics panel (Phase 3), no Google Calendar sync (Phase 4).

</domain>

<decisions>
## Implementation Decisions

### Table Layout & Navigation
- **D-01:** Vertical scroll with sticky column header row — `Emma | Olivia | Notes` fixed at top; date column scrolls with rows. 84 rows scroll down as a flat list.
- **D-02:** Visual week separators — bold/shaded divider row between each week to aid orientation.
- **D-03:** Jump-to-today — a fixed "Today" button or auto-scroll on page load brings the current week into view.

### Cell Interaction
- **D-04:** Click-to-toggle — clicking a child's cell flips the assigned parent (father ↔ mother) in one click. No dropdown or popover.
- **D-05:** Optimistic update — cell flips immediately in the UI; Server Action fires in background. On failure, revert the cell and show a toast error.

### Draft vs Published Visuals
- **D-06:** Muted/desaturated color distinguishes draft from published — published = full parent color (e.g. solid blue for father, solid red for mother); draft = same hue but washed-out/faded. No extra icons or borders required.

### Notes Field UX
- **D-07:** Inline editable text cell — notes column is a regular table cell with a text input. Click to edit in place; empty cells show a placeholder. No popover or icon-gating.
- **D-08:** Save on blur — notes auto-save when focus leaves the cell (consistent with click-to-toggle pattern; no explicit save button needed).

### Claude's Discretion
- Date format in the date column (e.g. "Mon 6 Jan" vs "2026-01-06" vs locale-formatted)
- Row height and column widths — balanced for readability on desktop and mobile
- Color tokens for father/mother (exact hues and their muted variants)
- Supabase Realtime subscription setup details (channel, filter, payload handling)
- Pre-fill trigger logic: how/when to detect a fresh schedule and seed the alternating-week pattern
- Toast library/approach for error feedback on optimistic update failure

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above and in the following files:

### Project Requirements
- `.planning/REQUIREMENTS.md` — Phase 2 covers: SETP-02, SCHED-01–06, DRFT-01, DRFT-03
- `.planning/ROADMAP.md` — Phase 2 success criteria (section: Phase 2: Schedule Table UI)
- `CLAUDE.md` — Stack decisions, version constraints, what NOT to use

### Existing Code (agents must read before planning)
- `src/config/app.ts` — Parent IDs (`father`/`mother`), children list, startDate, firstParent — drives alternating-week pre-fill logic
- `src/db/schema/domain.ts` — `schedule_entries` table (childId, day DATE, parentId, status enum, notes), `children` table, `schedules` table — authoritative schema
- `src/components/layout/header.tsx` — Existing header component; dashboard layout wraps it
- `src/app/dashboard/page.tsx` — Current placeholder; Phase 2 replaces body with the schedule table

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/button.tsx` — shadcn/ui Button; usable for "Today" jump button and toast actions
- `src/components/layout/header.tsx` — Already rendered in Dashboard; Phase 2 adds content below it
- `src/config/app.ts` — `AppConfig` type with `parents`, `children`, `startDate`, `firstParent` — directly consumed by pre-fill and cell rendering logic

### Established Patterns
- Server Actions + Drizzle for mutations (established in Phase 1)
- Auth.js `auth()` call in Server Components for session (established in Phase 1)
- Tailwind v4 + shadcn/ui for styling (established in Phase 1)
- `date-fns` available in stack for rolling window calculation and week arithmetic

### Integration Points
- `schedule_entries` rows are created/updated by cell toggle Server Action; Supabase Realtime broadcasts row changes to the other parent's browser
- `children` table seeded from `config/app.ts`; schedule grid columns are driven by this table
- `status` enum (`draft`/`published`) on `schedule_entries` drives draft vs published visual distinction
- Dashboard page (`src/app/dashboard/page.tsx`) is the mount point for the schedule table component

</code_context>

<specifics>
## Specific Ideas

- Cell toggle layout: `[ Isä ]` ← click → `[ Äiti ]` (color flips, change saved optimistically)
- Published cell: full parent color (solid). Draft cell: same hue, muted/faded — no extra borders or badges.
- Notes column: inline `<input>` or `<textarea>` in the table cell, auto-save on blur.
- Week separator: a visually distinct row (e.g. bold text or shaded background) between Mon–Sun groups.
- "Today" anchor: on load, `scrollIntoView` to today's row; persistent "Today" button in the UI for re-navigation.

</specifics>

<deferred>
## Deferred Ideas

- Publish/approve button — Phase 3
- Statistics panel — Phase 3
- Google Calendar sync — Phase 4
- Keyboard navigation between cells (arrow keys) — future enhancement if needed
- Multi-cell bulk edit (drag to assign a week at once) — future enhancement; not in scope

</deferred>

---

*Phase: 02-schedule-table-ui*
*Context gathered: 2026-04-05*
