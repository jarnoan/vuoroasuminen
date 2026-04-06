# Roadmap: Vuoroasuminen

## Overview

Four phases deliver a shared co-parenting custody scheduler from zero to full Google Calendar integration. The dependency chain is strict: authenticated users and a correct DB schema come first, then the collaborative schedule table, then the draft/publish workflow with statistics, and finally Google Calendar sync as the last external-dependency layer. Each phase leaves the product in a usable, verifiable state before the next layer is added.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Auth.js v5 + Drizzle ORM + Supabase setup, Google OAuth with Calendar scope, and complete DB schema
- [x] **Phase 2: Schedule Table UI** - Read/write 12-week schedule grid with real-time sync, alternating-week pre-fill, shared notes, and draft state (completed 2026-04-05)
- [ ] **Phase 3: Draft/Publish + Statistics** - Publish flow with confirmation dialog, approve button, and complete statistics panel
- [ ] **Phase 4: Google Calendar Sync** - Write-only GCal integration with idempotent event management, orphan cleanup, and rate-limit handling

## Phase Details

### Phase 1: Foundation
**Goal**: Both parents can sign in with Google accounts and the DB schema supporting all future features is in place
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, SETP-01
**Success Criteria** (what must be TRUE):
  1. A parent can sign in with their Google account and is redirected to the app
  2. The session persists after browser refresh without re-authenticating
  3. A parent can sign out from any page
  4. The OAuth flow requests the Google Calendar API scope so no re-auth is needed for sync later
  5. The `schedule_entries`, `gcal_events`, `children`, `schedules`, and Auth.js tables exist in Supabase with correct types (DATE columns, status enum)
**Plans:** 1/2 plans executed

Plans:
- [x] 01-01-PLAN.md — Bootstrap Next.js project, install deps, create Drizzle schema and app config
- [x] 01-02-PLAN.md — Auth.js v5 Google OAuth with split config, shell UI with sign-in/sign-out

**UI hint**: yes

### Phase 2: Schedule Table UI
**Goal**: Both parents can view and edit the full custody schedule in real time, with alternating-week defaults pre-filled and draft state visible
**Depends on**: Phase 1
**Requirements**: SETP-02, SCHED-01, SCHED-02, SCHED-03, SCHED-04, SCHED-05, SCHED-06, DRFT-01, DRFT-03
**Success Criteria** (what must be TRUE):
  1. On first load the 12-week rolling table is pre-filled with the alternating-week pattern — no blank cells
  2. Each cell shows the assigned parent's color; children can be assigned to different parents on the same day
  3. A parent can change any child's cell to father or mother and the change appears immediately on both parents' screens
  4. A parent can edit the shared notes field for any day and the other parent sees it in real time
  5. Draft cells are visually distinct from published cells so both parents can see what is not yet confirmed
**Plans:** 3/3 plans complete

Plans:
- [x] 02-01-PLAN.md — Data layer: types, alternating-week generator, data queries, Server Actions
- [x] 02-02-PLAN.md — Schedule table UI: 84-row grid with color-coded cells, click-to-toggle, notes, week separators
- [x] 02-03-PLAN.md — Realtime sync: Supabase Postgres Changes subscription, cross-browser state sync
**UI hint**: yes

### Phase 3: Draft/Publish + Statistics
**Goal**: Either parent can publish the current draft to confirm the plan, and the statistics panel shows the custody balance for the full window
**Depends on**: Phase 2
**Requirements**: DRFT-02, STAT-01, STAT-02, STAT-03, STAT-04, STAT-05
**Success Criteria** (what must be TRUE):
  1. Either parent can click "Publish" and a confirmation dialog shows the scope before committing
  2. After publishing, published cells are visually updated and the draft indicator clears for affected days
  3. The statistics panel shows days per child per parent, solo days per child per parent, child-free days per parent, and child-free weekends per parent for the full 12-week window
  4. Statistics update to reflect both draft and published entries so parents can see the effect of their plan before publishing
**Plans:** 2 plans

Plans:
- [ ] 03-01-PLAN.md — Publish flow: Server Action, confirmation dialog, Header button
- [ ] 03-02-PLAN.md — Statistics panel: computation module, StatsPanel component, schedule wiring
**UI hint**: yes

### Phase 4: Google Calendar Sync
**Goal**: Publishing the plan writes the correct all-day events to each parent's Google Calendar and removes stale events when custody assignments change
**Depends on**: Phase 3
**Requirements**: GCAL-01, GCAL-02, GCAL-03, GCAL-04, GCAL-05
**Success Criteria** (what must be TRUE):
  1. After publishing, each parent's Google Calendar contains one all-day event per child for each day that child is with that parent (e.g. "Emma @ isa")
  2. When a custody day is reassigned and republished, the old event is removed from the previous parent's calendar and created in the new parent's calendar
  3. Re-publishing the same plan without changes does not create duplicate events
  4. Each parent's calendar only contains events for children staying with them — events for the other parent's custody days are absent
**Plans:** 2 plans

Plans:
- [ ] 03-01-PLAN.md — Publish flow: Server Action, confirmation dialog, Header button
- [ ] 03-02-PLAN.md — Statistics panel: computation module, StatsPanel component, schedule wiring

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 1/2 | In Progress|  |
| 2. Schedule Table UI | 3/3 | Complete   | 2026-04-05 |
| 3. Draft/Publish + Statistics | 0/? | Not started | - |
| 4. Google Calendar Sync | 0/? | Not started | - |
