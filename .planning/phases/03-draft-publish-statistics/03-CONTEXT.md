# Phase 3: Draft/Publish + Statistics - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver (1) a publish flow — a Publish button in the header that opens a confirmation dialog and bulk-marks all draft `schedule_entries` as `published` — and (2) a statistics panel above the schedule table showing custody balance counts for the full 12-week window. No Google Calendar writes in this phase (Phase 4). No per-cell granularity — publish is always a bulk action.

</domain>

<decisions>
## Implementation Decisions

### Publish Scope
- **D-01:** Publish action marks **all draft entries in the 84-row window** as `published` — past and future alike. Simple, predictable, matches "publish the plan" semantics. No date-range filtering.

### Confirmation Dialog
- **D-02:** The dialog shows count + date range before committing: e.g. "Publish 48 draft entries (6 Jan – 29 Mar)? This will lock the schedule and sync to Google Calendar." No per-child breakdown — count + range is sufficient.
- **D-03:** A shadcn/ui Dialog component (not yet in codebase — will need to be added). Confirm / Cancel actions.

### Statistics Panel Layout
- **D-04:** Stats appear as a compact strip **above the schedule table** (between header and the scrollable table). Always visible — no toggle, no tabs.
- **D-05:** One row per child, showing days with each parent. Also rows for child-free days and child-free weekends per parent (STAT-01 through STAT-04).
- **D-06:** Stats reflect both draft and published entries (STAT-05) — computed from the full `schedule_entries` dataset, not filtered by status.

### Publish Button Placement
- **D-07:** Publish button lives in the **existing `Header` component**, right side alongside the user avatar/sign-out control. Always visible while scrolling through the 84-row table.
- **D-08:** Button state: if there are no draft entries, the button is disabled (or hidden) — no point publishing an already-clean schedule.

### Claude's Discretion
- Exact label on the Publish button ("Publish" or "Publish Draft")
- How to count draft entries for the dialog (computed server-side in the Server Action or client-side from existing `days` state)
- Whether the dialog fetches a live count or derives it from the already-loaded schedule data
- Disabled vs hidden state for the Publish button when no drafts exist
- Statistical formatting details (e.g. "42 days" vs "42d", compact vs full labels)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above and in the following files:

### Project Requirements
- `.planning/REQUIREMENTS.md` — Phase 3 covers: DRFT-02, STAT-01, STAT-02, STAT-03, STAT-04, STAT-05
- `.planning/ROADMAP.md` — Phase 3 success criteria (section: Phase 3: Draft/Publish + Statistics)
- `CLAUDE.md` — Stack decisions, version constraints, what NOT to use

### Existing Code (agents must read before planning)
- `src/db/schema/domain.ts` — `schedule_entries` table with `status` enum (`draft`/`published`) — the publish action bulk-updates this column
- `src/actions/schedule.ts` — Existing `toggleCell` and `saveNotes` Server Actions — pattern for the new `publishDraft` Server Action
- `src/components/schedule/schedule-table.tsx` — Main table component; stats panel inserts above this; Publish button goes in the Header
- `src/components/schedule/schedule-cell.tsx` — Already renders published vs draft colors via `colorMap` — no changes needed for visual distinction
- `src/components/layout/header.tsx` — Publish button mounts here; needs to become a Client Component or accept a slot for the button
- `src/lib/schedule/queries.ts` — `getScheduleWindow` query returns all 84 rows with status — stats can be computed from the same data
- `src/config/app.ts` — Parent IDs, children list — drives stats labels and counts

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/button.tsx` — shadcn/ui Button; Publish button and dialog actions use this
- `ScheduleCell` colorMap — draft/published distinction already works; no changes needed
- `getScheduleWindow` data — stats can be computed from the same `DateWindow` payload already fetched for the table; no extra DB query needed at page load

### Established Patterns
- Server Actions + Drizzle for mutations (established in Phases 1–2)
- `auth()` in Server Components / Server Actions for session guard
- Tailwind v4 + shadcn/ui for styling
- `sonner` Toaster for error feedback (mounted at root layout)
- Optimistic UI + revert on failure (established in Phase 2 cell toggle)

### Integration Points
- **Header:** Currently a Server Component; adding a Publish button that needs client interaction may require extracting the button into a Client Component wrapper or using a slot pattern
- **Stats panel:** Inserts between `<Header />` and `<ScheduleWithRealtime />` in `src/app/dashboard/page.tsx`; computed from `schedule` data already fetched
- **Publish action:** New Server Action `publishDraft()` — bulk `UPDATE schedule_entries SET status='published' WHERE status='draft'`; after success, schedule data must re-render to show updated colors (revalidate or trigger Supabase Realtime update)
- **Supabase Realtime:** Bulk publish will fire multiple row-change events — the existing realtime handler in `schedule-table.tsx` already handles per-entry updates; bulk publish should work without changes

</code_context>

<specifics>
## Specific Ideas

- Header layout: `[ Vuoroasuminen    [Publish]  [User] ]`
- Stats strip layout (compact, one row per child + summary rows):
  ```
  [ Stats: Emma: 42d dad / 42d mum   ]
  [ Stats: Olivia: 38d dad / 46d mum ]
  [ Child-free: dad 8d (3 wknds) / mum 6d (2 wknds) ]
  ```
- Dialog: "Publish 48 draft entries (6 Jan – 29 Mar)? This will lock the schedule and sync to Google Calendar." with Confirm / Cancel.
- Publish button disabled when no draft entries exist in the window.

</specifics>

<deferred>
## Deferred Ideas

- Per-cell or per-week granular publish — could be a future enhancement if parents want to confirm weeks incrementally
- Undo / revert published entries back to draft — out of scope; last-write-wins is sufficient
- Stats breakdown by month or school term — v2 requirement (EXPRT-02), not in scope for v1

</deferred>

---

*Phase: 03-draft-publish-statistics*
*Context gathered: 2026-04-06*
