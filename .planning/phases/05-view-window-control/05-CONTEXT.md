# Phase 5: View Window Control - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Each parent can independently control how far back the schedule view starts. Default is Monday of the current week. The view window is per-user (VIEW-04) — one parent's change does not affect the other's. This phase adds backward navigation only; forward extension belongs to Phase 6.

</domain>

<decisions>
## Implementation Decisions

### Preference Storage (VIEW-04)
- **D-01:** View start date stored as a URL search parameter: `?viewStart=YYYY-MM-DD`. No DB table, no localStorage.
- **D-02:** Reload preserves the view (URL unchanged). Fresh navigation to the dashboard (no `?viewStart` param) defaults to Monday of current week.
- **D-03:** The URL approach satisfies VIEW-04 naturally — each parent controls their own browser URL. One parent sharing a URL with the other would let them see the same window, which is a bonus, not a bug.

### Data Fetching
- **D-04:** URL change triggers a full server re-render of the dashboard page. `searchParams.viewStart` is read by the Server Component, passed to `getScheduleWindow(startDate)`. No client-side data management.
- **D-05:** URL updates use `router.replace()` (not `router.push`). No history stack accumulation — back button exits dashboard, not undo-previous-week.

### Controls (Toolbar)
- **D-06:** A toolbar row is added between the page header and the schedule table. Contains: `‹ Prev week` button, `Pick date 📅` button (shadcn DatePicker), and `Tänään` button.
- **D-07:** The existing floating `Tänään` button (fixed bottom-right) is removed. Its functionality moves to the toolbar.
- **D-08:** `Tänään` button in toolbar does two things: (1) clears `viewStart` from URL (resets to default Mon of current week), (2) scrolls to today's row.

### Date Picker
- **D-09:** shadcn/ui DatePicker pattern — Popover + Calendar + react-day-picker. Consistent with existing shadcn component usage. Install: `npx shadcn@canary add popover calendar`.

### Backward Navigation Limit
- **D-10:** No hard limit on how far back user can go. `‹ Prev week` is always enabled. The view shows whatever schedule data exists in the DB for that range.

### Claude's Discretion
- Loading state / skeleton while server re-renders on URL change — standard Next.js `loading.tsx` or Suspense boundary.
- Exact styling of toolbar (padding, alignment, gap between buttons) — match existing button/header styles.
- Whether `viewStart` URL param snaps to Monday automatically or allows any date — snapping to Monday is logical given week-based navigation, but explicit date picker may allow any weekday.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §View Window — VIEW-01, VIEW-02, VIEW-03, VIEW-04 definitions

### Roadmap
- `.planning/ROADMAP.md` §Phase 5 — success criteria and UI hint

### Existing implementation (read before touching)
- `src/lib/schedule/generate-default.ts` — `getWindowBounds()` hardcoded start; must be refactored to accept a start date param
- `src/lib/schedule/queries.ts` — `getScheduleWindow()` must accept optional `startDate: string` param
- `src/app/dashboard/page.tsx` — Server Component; must read `searchParams.viewStart` and pass to query
- `src/components/schedule/schedule-table.tsx` — accepts `initialData: DateWindow`; toolbar renders above this
- `src/components/schedule/today-button.tsx` — existing floating Tänään button; to be removed and replaced by toolbar version
- `src/lib/schedule/types.ts` — `DateWindow` type; `startDate`/`endDate` fields already exist

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TodayButton` component (`src/components/schedule/today-button.tsx`): scroll-to-today logic is reusable; move it into the new toolbar component rather than keeping it as a standalone file.
- `Button` (`src/components/ui/button.tsx`): use for `‹ Prev week` and `Tänään` buttons in toolbar.
- shadcn/ui `Dialog` (`src/components/ui/dialog.tsx`): already installed — confirms shadcn pattern is established; DatePicker follows same pattern.

### Established Patterns
- Server Components fetch data, pass `initialData` to Client Components — maintain this pattern. Toolbar navigation updates URL; page re-renders server-side with new data.
- `router.replace()` for URL updates — no history stack (same as scroll-to-today behavior with no back-navigation side effects).
- `date-fns` + `fi` locale already in use for date formatting; use it for toolbar date display.

### Integration Points
- `src/app/dashboard/page.tsx`: add `searchParams` prop, extract `viewStart`, validate it (must be a valid ISO date string; fall back to default if invalid), pass to `getScheduleWindow`.
- `getWindowBounds()` → refactor to `getWindowBounds(startDate?: string)`: if `startDate` provided, use it as the start (snapped to Monday of that week or used as-is — Claude's discretion); if not, use existing logic (Mon of current week).
- New toolbar component sits between `<Header />` and `<ScheduleTable />` in `DashboardShell`.

</code_context>

<specifics>
## Specific Ideas

- Toolbar mockup chosen by user:
  ```
  [ Header: Vuoroasuminen | Sign out ]

  [ ‹ Prev week ]  [ Pick date 📅 ]  [ Tänään ]

  ┌────────┬──────┬────────────────┐
  │ Päivä  │ Lapsi│ Muistiinpanot  │
  │ ma 4.5 │  🟥  │                │
  │ ti 5.5 │  🟦  │                │
  ```
- `Tänään` in toolbar = reset view to default + scroll to today (two-in-one).
- URL param is shareable: if one parent sends the other a URL with `?viewStart=...`, they see the same window — treated as a feature, not a problem.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-view-window-control*
*Context gathered: 2026-05-04*
