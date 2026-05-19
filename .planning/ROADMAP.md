# Roadmap: Vuoroasuminen

## Milestones

- ✅ **v1.0 MVP** — Phases 1–4 (shipped 2026-04-20)
- ✅ **v1.1 Schedule Window Control** — Phases 5–7 (shipped 2026-05-06)
- ✅ **v1.2 Supabase Auth Migration** — Phases 8–10 (shipped 2026-05-15)
- ✅ **v1.3 Deploy + Onboarding** — Phases 11–13 (shipped 2026-05-17)
- 🔄 **v1.4 Mobile-First Polish** — Phases 14–16 (in progress)

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

### v1.4 Mobile-First Polish

- [ ] **Phase 14: Realtime Reliability + Mobile Baseline** — Fix silent data loss on background tab; establish mobile viewport foundation
- [x] **Phase 15: Header, Clear Guard, and Toolbar** — Adapt header, clear interactions, and view toolbar for mobile (completed 2026-05-19)
- [ ] **Phase 16: Schedule Table Reflow and Stats** — Full table reflow for 360–430px; stats panel repositioning

## Phase Details

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
**Plans**: TBD
**UI hint**: yes

## Coverage

- Requirements: 8 total
- Mapped: 8
- Unmapped: 0 ✓

| Requirement | Phase |
|-------------|-------|
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
| 14. Realtime Reliability + Mobile Baseline | v1.4 | 0/2 | Not started | - |
| 15. Header, Clear Guard, and Toolbar | v1.4 | 3/3 | Complete    | 2026-05-19 |
| 16. Schedule Table Reflow and Stats | v1.4 | 0/? | Not started | - |
