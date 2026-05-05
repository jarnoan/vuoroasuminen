# Phase 6: Extend Schedule - Context

**Gathered:** 2026-05-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Either parent can generate new weeks of schedule beyond the current end date. New weeks are pre-filled with the alternating default pattern. This phase adds forward extension only; backward navigation and view window control belong to Phase 5.

</domain>

<decisions>
## Implementation Decisions

### Entry Point (UI placement)
- **D-01:** The "Add weeks" trigger is a `[ + Lisää viikkoja ]` button placed **below the schedule table** — visually anchored to where new weeks will appear, not in the ViewToolbar.
- **D-02:** Clicking the button reveals an **inline expansion panel** directly below it (not a modal/dialog). The panel stays in context — no overlay friction.

### Confirm Flow (EXTEND-02)
- **D-03:** The inline panel shows:
  1. A range input (see D-04)
  2. A computed date preview: `Ajanjakso: ma 9.6. – su 31.8.` (start = day after current schedule end, end = derived from input)
  3. `[ Vahvista ]` and `[ Peruuta ]` buttons
- **D-04:** The date preview updates live as the user changes the range input. No separate confirm-preview step needed.

### Range Input (EXTEND-01 + EXTEND-03)
- **D-05:** Default mode: number input pre-filled with **12 weeks**. Label: `Lisätään: [12] viikkoa`.
- **D-06:** A toggle link `tai valitse päättymispäivä →` switches to date picker mode. In date picker mode, a `tai määritä viikkoina ←` link switches back.
- **D-07:** In date picker mode: user picks an explicit end date via shadcn Calendar/Popover (already installed). Shown as `Päättyy: [su 31.8.2026 📅]`. The end date snaps to Sunday of the selected week (end of week).
- **D-08:** Only one mode is shown at a time. Both satisfy EXTEND-03 (explicit end date via date picker) and EXTEND-01 (week count via number input).

### Post-Extend Navigation
- **D-09:** After confirming, the view **auto-navigates** to the first newly added week. URL updates to `?viewStart=<new-start>` via `router.replace()`. User immediately sees the new content.

### Claude's Discretion
- Server Action for the DB insert (consistent with existing mutation pattern)
- Conflict handling for the new range: upsert or skip entries that already exist (use `onConflictDoNothing` — same as existing seeding logic)
- Exact styling of the inline panel (border, padding, background)
- Week count input: `<input type="number" min="1" max="52">` or shadcn equivalent
- Whether "end of week" snap for date picker is Sunday or Saturday (use Sunday — consistent with `getWindowBounds` which ends on Sunday)
- Loading/pending state during Server Action (disable Vahvista button while pending)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Extend Schedule — EXTEND-01, EXTEND-02, EXTEND-03 definitions

### Roadmap
- `.planning/ROADMAP.md` §Phase 6 — goal, success criteria, UI hint

### Existing implementation (read before touching)
- `src/lib/schedule/generate-default.ts` — `generateDefaultEntries(windowStart, windowEnd, childNames)`: reuse for new range; `getWindowBounds()`: reference for current window end calculation
- `src/lib/schedule/queries.ts` — `getScheduleWindow()`: understand the seeding logic; extending adds entries directly without touching this function's all-or-nothing guard
- `src/components/schedule/view-toolbar.tsx` — existing toolbar (NOT where the extend button lives, but reference for router.replace() pattern and date-fns usage)
- `src/components/schedule/dashboard-shell.tsx` — integration point: extend panel renders below ScheduleTable inside DashboardShell
- `src/components/ui/popover.tsx` + `src/components/ui/calendar.tsx` — already installed shadcn components; reuse for date picker mode in range input

### Prior phase context
- `.planning/phases/05-view-window-control/05-CONTEXT.md` — URL navigation pattern, router.replace(), date-fns + fi locale decisions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `generateDefaultEntries(windowStart, windowEnd, childNames)` (`src/lib/schedule/generate-default.ts`): takes a date range and returns entries — exact signature needed for extension logic
- shadcn `Popover` + `Calendar` (`src/components/ui/popover.tsx`, `src/components/ui/calendar.tsx`): already installed; use for date picker mode toggle
- `Button` (`src/components/ui/button.tsx`): use for all buttons in the extend panel
- `router.replace()` pattern from `ViewToolbar`: reuse for post-extend navigation to new viewStart

### Established Patterns
- Server Component fetches data, passes `initialData` to Client Components — the extend panel is a Client Component that calls a Server Action
- `onConflictDoNothing` for batch insert (used in seeding logic) — apply same for extension to avoid duplicate errors if user extends twice into overlapping range
- `date-fns` + `fi` locale for date label formatting

### Integration Points
- `src/components/schedule/dashboard-shell.tsx`: add `<ExtendPanel>` Client Component below `<ScheduleTable>`. Pass current schedule end date as a prop (derived from the existing `DateWindow.endDate` already available in DashboardShell).
- New Server Action (e.g., `src/app/dashboard/actions.ts` or co-located): receives `{ endDate: string, weeks?: number }`, computes new range, calls `generateDefaultEntries`, batch-inserts, returns new range start for navigation.

</code_context>

<specifics>
## Specific Ideas

- Inline expand panel mockup chosen by user:
  ```
  [ + Lisää viikkoja ]

  ┌──────────────────────────────────────┐
  │  Lisätään:  [12] viikkoa             │
  │  tai valitse päättymispäivä →        │
  │                                      │
  │  Ajanjakso: ma 9.6. – su 31.8.       │
  │                                      │
  │  [ Vahvista ]  [ Peruuta ]           │
  └──────────────────────────────────────┘
  ```
- Date picker mode toggle (EXTEND-03):
  ```
  Päättyy: [ su 31.8.2026 📅 ]
  tai määritä viikkoina ←
  ```
- After confirm: view jumps to first new week (URL `?viewStart=<new-start>`).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-extend-schedule*
*Context gathered: 2026-05-05*
