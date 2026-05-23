# Roadmap: Vuoroasuminen

## Milestones

- ✅ **v1.0 MVP** — Phases 1–4 (shipped 2026-04-20)
- ✅ **v1.1 Schedule Window Control** — Phases 5–7 (shipped 2026-05-06)
- ✅ **v1.2 Supabase Auth Migration** — Phases 8–10 (shipped 2026-05-15)
- ✅ **v1.3 Deploy + Onboarding** — Phases 11–13 (shipped 2026-05-17)
- ✅ **v1.4 Mobile-First Polish** — Phases 14–16 (shipped 2026-05-20)
- 🔄 **v1.5 UI Refinements** — Phases 17–19 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1–4) — SHIPPED 2026-04-20</summary>

- [x] Phase 1: Foundation (2/2 plans) — completed 2026-04-04
- [x] Phase 2: Schedule Table UI (3/3 plans) — completed 2026-04-05
- [x] Phase 3: Draft/Publish + Statistics (2/2 plans) — completed 2026-04-07
- [x] Phase 4: Google Calendar Sync (2/2 plans) — completed 2026-04-12

Full archive: [.planning/milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

<details>
<summary>✅ v1.1 Schedule Window Control (Phases 5–7) — SHIPPED 2026-05-06</summary>

- [x] Phase 5: View Window Control (4/4 plans) — completed 2026-05-04
- [x] Phase 6: Extend Schedule (2/2 plans) — completed 2026-05-05
- [x] Phase 7: Clear Entries (3/3 plans) — completed 2026-05-06

Full archive: [.planning/milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)

</details>

<details>
<summary>✅ v1.2 Supabase Auth Migration (Phases 8–10) — SHIPPED 2026-05-15</summary>

- [x] Phase 8: Supabase Auth Stack (8/8 plans) — completed 2026-05-10
- [x] Phase 9: Row Level Security (4/4 plans) — completed 2026-05-14
- [x] Phase 10: Auth.js Removal (4/4 plans) — completed 2026-05-15

Full archive: [.planning/milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)

</details>

<details>
<summary>✅ v1.3 Deploy + Onboarding (Phases 11–13) — SHIPPED 2026-05-17</summary>

- [x] Phase 11: Production Deploy (3/3 plans) — completed 2026-05-16
- [x] Phase 12: Onboarding Wizard (5/5 plans) — completed 2026-05-16
- [x] Phase 13: Invite + Access Gate (4/4 plans) — completed 2026-05-17

Full archive: [.planning/milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md)

</details>

<details>
<summary>✅ v1.4 Mobile-First Polish (Phases 14–16) — SHIPPED 2026-05-20</summary>

- [x] Phase 14: Realtime Reliability + Mobile Baseline (2/2 plans) — completed 2026-05-18
- [x] Phase 15: Header, Clear Guard, and Toolbar (3/3 plans) — completed 2026-05-19
- [x] Phase 16: Schedule Table Reflow and Stats (2/2 plans) — completed 2026-05-20

Full archive: [.planning/milestones/v1.4-ROADMAP.md](milestones/v1.4-ROADMAP.md)

</details>

### v1.5 UI Refinements (Phases 17–19)

- [x] Phase 17: Schedule Table Structure — Week numbers + desktop full-page scroll (UI-01, UI-02) (completed 2026-05-21)
- [ ] Phase 18: Mobile Cell and Note Interactions — Pen icon, Tyhjennä cell, note attribution (UI-03, UI-04, UI-05)
- [ ] Phase 19: Stats Column Alignment — Stats columns match table columns (UI-06)

## Phase Details

### Phase 17: Schedule Table Structure

**Goal**: The schedule table shows week number labels and scrolls as part of the full page on desktop
**Depends on**: Phase 16
**Requirements**: UI-01, UI-02
**Success Criteria** (what must be TRUE):

  1. A week number label row (e.g. "Viikko 21") appears above each Monday in the schedule table for every week in the view window
  2. On desktop, scrolling the page scrolls the entire schedule — there is no separate inner scroll container on the table
  3. On desktop, the table header row stays sticky as the user scrolls down, the same as on mobile
  4. On mobile, scroll behavior is unchanged from v1.4

**Plans**: 3 plans
Plans:
**Wave 1**

- [x] 17-01-PLAN.md — Replace hairline separator row with "Viikko X" week label row using date-fns getISOWeek (UI-01)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 17-02-PLAN.md — Remove desktop inner scroll container, switch auto-scroll to block:start with scroll-mt-10 offset (UI-02)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 17-03-PLAN.md — Human-verify checkpoint: SC-1..SC-4 on desktop and mobile viewports

**UI hint**: yes

### Phase 18: Mobile Cell and Note Interactions

**Goal**: Mobile users have clearer, friendlier interactions for adding notes and clearing cells
**Depends on**: Phase 16
**Requirements**: UI-03, UI-04, UI-05
**Success Criteria** (what must be TRUE):

  1. On mobile, the button that reveals the note input shows a pen icon, not a plus icon
  2. On mobile, long-pressing a parent custody cell triggers a brief vibration and transforms the entire cell into a full-width "Tyhjennä" button
  3. Tapping the "Tyhjennä" button clears the cell; auto-disarm timeout still applies if not tapped
  4. On desktop, the existing hover × clear behavior is unchanged
  5. On mobile, the note row is visually attributed to its day row — the design makes clear the note belongs to the row above it

**Plans**: 3 plans
Plans:
**Wave 1**

- [x] 18-01-PLAN.md — Extend ScheduleCell with isHolding state, 1s color fade, navigator.vibrate(100), full-cell Tyhjennä armed render, @media (hover) split (UI-04)
- [x] 18-02-PLAN.md — Swap PlusIcon -> Pencil on mobile note button + mobile note row attribution (pt-0 + pl-8, day-row border removal) (UI-03, UI-05)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 18-03-PLAN.md — Human-verify checkpoint: SC-1..SC-5 on mobile and desktop viewports

**UI hint**: yes

### Phase 19: Stats Column Alignment

**Goal**: Stats panel columns align with schedule table columns so the layout is visually coherent when both are on screen
**Depends on**: Phase 17
**Requirements**: UI-06
**Success Criteria** (what must be TRUE):

  1. Each child column in the stats panel is the same width as the corresponding child column in the schedule table above it
  2. The columns visually align when both elements are visible on screen
  3. The alignment holds across viewport widths (both mobile and desktop)

**Plans**: 2 plans
Plans:
**Wave 1**

- [x] 19-01-PLAN.md — Apply table-layout:fixed + min-w-[72px] sm:min-w-[90px] + matching paddings to StatsPanel; remove wrapper horizontal padding (UI-06)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 19-02-PLAN.md — Human-verify checkpoint: SC-1..SC-3 at 360px and 1280px viewports

**UI hint**: yes

### Phase 14: Realtime Reliability + Mobile Baseline

**Goal**: The app stays live and data-correct when a parent returns from a background tab, and the mobile viewport is correctly configured as the foundation for all subsequent UI work
**Depends on**: Nothing (first v1.4 phase)
**Requirements**: RTLT-01
**Success Criteria** (what must be TRUE):

  1. A parent who leaves the app open in a background tab for 15+ minutes returns to see the current schedule without a manual page reload
  2. Any edits made by the other parent during the background period appear automatically within seconds of the tab becoming active
  3. The browser does not display a stale or blank schedule after returning from background

**Plans**: 2 plans
Plans:

- [x] 14-01-PLAN.md — Server Action (getScheduleDays) + mobile viewport baseline (layout.tsx, globals.css)
- [x] 14-02-PLAN.md — RealtimeProvider visibilitychange recovery + viewStart/onRefresh prop threading

**UI hint**: yes

### Phase 15: Header, Clear Guard, and Toolbar

**Goal**: Both parents can navigate the app, clear cells safely on touch, and control their view window without overflow or accidental activation on mobile
**Depends on**: Phase 14
**Requirements**: MOB-02, MOB-03, MOB-03a, MOB-04
**Success Criteria** (what must be TRUE):

  1. The header fits on a 360px viewport — parent name is truncated or hidden and the sign-out control remains tappable
  2. On a touch device, tapping a custody cell does not immediately clear it; a long-press reveals a clear option that requires a second deliberate action to confirm
  3. On desktop, the existing hover × button for clearing behaves exactly as before
  4. The view toolbar controls (date navigation, window controls) fit within a 360–430px viewport without horizontal overflow or clipping
  5. On mobile, tapping the date field opens the native system date picker; on desktop the existing calendar popover appears

**Plans**: 3 plans
Plans:

- [x] 15-01-PLAN.md — Header mobile shrink: title/name hide, avatar fallback, icon-only sign-out, responsive padding (MOB-04)
- [x] 15-02-PLAN.md — ScheduleCell long-press clear guard: isArmed state, pointer event handlers, desktop unchanged (MOB-02)
- [x] 15-03-PLAN.md — ViewToolbar @container + icon Prev + native date input; ClearPanel native date inputs (MOB-03, MOB-03a)

**UI hint**: yes

### Phase 16: Schedule Table Reflow and Stats

**Goal**: Both parents can read and edit the full custody schedule on any modern smartphone without horizontal scrolling, and custody statistics are visible below the table on all viewports
**Depends on**: Phase 15
**Requirements**: MOB-01, MOB-01b, MOB-05
**Success Criteria** (what must be TRUE):

  1. The schedule table fits completely within a 360px viewport without requiring horizontal scrolling
  2. On mobile, each day row shows child custody cells on top and the shared notes text on a second row directly below — no notes are hidden or truncated
  3. On desktop, the existing single-row layout (child cells and notes side by side) is unchanged
  4. The custody statistics panel appears below the schedule table on all screen sizes
  5. On mobile viewports the statistics display in a 2-column grid so all values are visible without scrolling past them

**Plans**: 2 plans
Plans:

- [x] 16-01-PLAN.md — StatsPanel child-column grid redesign (MOB-05 grid)
- [x] 16-02-PLAN.md — ScheduleTable mobile reflow (scroll container, sticky date column, hidden notes column, two-row notes, PlusIcon add-notes) + StatsPanel sibling placement (MOB-01, MOB-01b, MOB-05 positioning)

**UI hint**: yes

## Coverage

- v1.5 requirements: 6 total
- Mapped: 6
- Unmapped: 0 ✓

| Requirement | Phase |
|-------------|-------|
| UI-01 | Phase 17 |
| UI-02 | Phase 17 |
| UI-03 | Phase 18 |
| UI-04 | Phase 18 |
| UI-05 | Phase 18 |
| UI-06 | Phase 19 |
| DPLY-01 | Phase 11 |
| DPLY-02 | Phase 11 |
| DPLY-03 | Phase 11 |
| DPLY-04 | Phase 11 |
| DPLY-05 | Phase 11 |
| ONBR-03 | Phase 12 |
| ONBR-04 | Phase 12 |
| ONBR-05 | Phase 13 |
| ONBR-06 | Phase 13 |
| ONBR-07 | Phase 13 |
| RTLT-01 | Phase 14 |
| MOB-02 | Phase 15 |
| MOB-03 | Phase 15 |
| MOB-03a | Phase 15 |
| MOB-04 | Phase 15 |
| MOB-01 | Phase 16 |
| MOB-01b | Phase 16 |
| MOB-05 | Phase 16 |

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 2/2 | Complete | 2026-04-04 |
| 2. Schedule Table UI | v1.0 | 3/3 | Complete | 2026-04-05 |
| 3. Draft/Publish + Statistics | v1.0 | 2/2 | Complete | 2026-04-07 |
| 4. Google Calendar Sync | v1.0 | 2/2 | Complete | 2026-04-12 |
| 5. View Window Control | v1.1 | 4/4 | Complete | 2026-05-04 |
| 6. Extend Schedule | v1.1 | 2/2 | Complete | 2026-05-05 |
| 7. Clear Entries | v1.1 | 3/3 | Complete | 2026-05-06 |
| 8. Supabase Auth Stack | v1.2 | 8/8 | Complete | 2026-05-10 |
| 9. Row Level Security | v1.2 | 4/4 | Complete | 2026-05-14 |
| 10. Auth.js Removal | v1.2 | 4/4 | Complete | 2026-05-15 |
| 11. Production Deploy | v1.3 | 3/3 | Complete | 2026-05-16 |
| 12. Onboarding Wizard | v1.3 | 5/5 | Complete | 2026-05-16 |
| 13. Invite + Access Gate | v1.3 | 4/4 | Complete | 2026-05-17 |
| 14. Realtime Reliability + Mobile Baseline | v1.4 | 2/2 | Complete | 2026-05-18 |
| 15. Header, Clear Guard, and Toolbar | v1.4 | 3/3 | Complete | 2026-05-19 |
| 16. Schedule Table Reflow and Stats | v1.4 | 2/2 | Complete | 2026-05-20 |
