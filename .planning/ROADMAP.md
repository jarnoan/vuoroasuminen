# Roadmap: Vuoroasuminen

## Milestones

- ✅ **v1.0 MVP** — Phases 1–4 (shipped 2026-04-20)
- 🚧 **v1.1 Schedule Window Control** — Phases 5–7 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1–4) — SHIPPED 2026-04-20</summary>

- [x] Phase 1: Foundation (2/2 plans) — completed 2026-04-04
- [x] Phase 2: Schedule Table UI (3/3 plans) — completed 2026-04-05
- [x] Phase 3: Draft/Publish + Statistics (2/2 plans) — completed 2026-04-07
- [x] Phase 4: Google Calendar Sync (2/2 plans) — completed 2026-04-12

Full archive: [.planning/milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

### 🚧 v1.1 Schedule Window Control (In Progress)

**Milestone Goal:** Give parents flexible control over what date range the schedule shows — past, present, and future — plus the ability to clear assignments.

- [ ] **Phase 5: View Window Control** — Per-user control over which date range is shown in the schedule
- [ ] **Phase 6: Extend Schedule** — Add weeks beyond the current schedule end with pre-filled alternating defaults
- [ ] **Phase 7: Clear Entries** — Clear single cells or date ranges to unassigned

## Phase Details

### Phase 5: View Window Control
**Goal**: Each parent can independently control how far back the schedule view starts
**Depends on**: Phase 4
**Requirements**: VIEW-01, VIEW-02, VIEW-03, VIEW-04
**Success Criteria** (what must be TRUE):
  1. Schedule view starts from Monday of the current week by default, showing past days of that week
  2. User can click "Show previous week" and the view expands one week back; clicking again expands another week
  3. User can pick an explicit start date via a date picker and the view updates to that date
  4. After a parent adjusts the view start, the other parent's view is unaffected
**Plans**: 4 plans
Plans:
- [x] 05-01-PLAN.md — Refactor backend data layer (getWindowBounds, getScheduleWindow, page.tsx) to accept viewStart URL param
- [x] 05-02-PLAN.md — Install shadcn popover and calendar components
- [x] 05-03-PLAN.md — Create ViewToolbar Client Component and loading.tsx skeleton
- [x] 05-04-PLAN.md — Wire ViewToolbar into DashboardShell; remove legacy TodayButton
**UI hint**: yes

### Phase 6: Extend Schedule
**Goal**: Either parent can generate new weeks of schedule beyond the current end date, pre-filled with the alternating default pattern
**Depends on**: Phase 5
**Requirements**: EXTEND-01, EXTEND-02, EXTEND-03
**Success Criteria** (what must be TRUE):
  1. User can click an "Add weeks" action and new entries appear in the schedule, pre-filled with the alternating-week default
  2. Before confirming, the UI displays the exact start and end dates of the range about to be added
  3. User can specify an explicit end date instead of a week count, and only entries up to that date are created
**Plans**: TBD
**UI hint**: yes

### Phase 7: Clear Entries
**Goal**: Either parent can remove child assignments from individual cells or date ranges, leaving them unassigned
**Depends on**: Phase 6
**Requirements**: CLEAR-01, CLEAR-02
**Success Criteria** (what must be TRUE):
  1. User can clear a single cell — the cell shows an empty/unassigned state with no parent color
  2. User can select a start and end date and clear all child assignments within that range in one action
  3. Cleared cells are distinct from assigned cells in the UI and sync correctly through draft/publish
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 2/2 | Complete | 2026-04-04 |
| 2. Schedule Table UI | v1.0 | 3/3 | Complete | 2026-04-05 |
| 3. Draft/Publish + Statistics | v1.0 | 2/2 | Complete | 2026-04-07 |
| 4. Google Calendar Sync | v1.0 | 2/2 | Complete | 2026-04-12 |
| 5. View Window Control | v1.1 | 0/4 | Not started | - |
| 6. Extend Schedule | v1.1 | 0/? | Not started | - |
| 7. Clear Entries | v1.1 | 0/? | Not started | - |
