# Requirements: Vuoroasuminen

**Defined:** 2026-04-04
**Core Value:** Both parents always see the same up-to-date custody schedule, reflected in their Google Calendars, without manual coordination.

## v1 Requirements

### Authentication

- [x] **AUTH-01**: User can sign in with their Google account via OAuth
- [x] **AUTH-02**: User session persists across browser refresh
- [x] **AUTH-03**: User can sign out from any page
- [x] **AUTH-04**: App requests Google Calendar API scope at sign-in so calendar sync works without re-auth

### Setup

- [x] **SETP-01**: A configuration file or environment-level setup defines the two parents (name, Google account, calendar ID), list of children, the default alternating-week start date, and which parent starts first
- [x] **SETP-02**: System pre-fills the 12-week planning window with the alternating-week pattern on first load

### Schedule Table

- [ ] **SCHED-01**: User sees a table with rows = days (rolling 12-week window from today) and columns = one per child plus a shared notes column
- [ ] **SCHED-02**: Each cell shows which parent the child is with on that day (color-coded by parent)
- [x] **SCHED-03**: User can change a cell value (father / mother) for any child on any day
- [x] **SCHED-04**: Each child's location is tracked independently — children can be at different parents on the same day
- [x] **SCHED-05**: User can edit the shared notes field for any day
- [ ] **SCHED-06**: Changes made in draft state are visible immediately to both parents in real time (Supabase Realtime)

### Draft & Publish

- [x] **DRFT-01**: All edits create or modify draft entries — they do not immediately push to Google Calendar
- [ ] **DRFT-02**: Either parent can approve and publish the current draft, which triggers Google Calendar sync
- [ ] **DRFT-03**: The UI clearly distinguishes draft cells from published cells (e.g. visual indicator)

### Google Calendar Sync

- [ ] **GCAL-01**: On publish, the app creates or updates an all-day Google Calendar event for each child on each published day, in that parent's calendar (e.g. "Emma @ isä" in father's calendar)
- [ ] **GCAL-02**: On publish, events are removed from a parent's calendar for days where that child is no longer staying with them
- [ ] **GCAL-03**: Calendar sync is idempotent — re-publishing the same plan does not create duplicate events
- [ ] **GCAL-04**: Each parent's calendar only receives events for the children staying with that parent on each day
- [ ] **GCAL-05**: All calendar events use the `DATE` format (full-day events, timezone-safe)

### Statistics

- [ ] **STAT-01**: Statistics panel shows, for the full 12-week window: number of days each child is with each parent
- [ ] **STAT-02**: Statistics panel shows: number of days each child is alone with each parent (the other children are not present)
- [ ] **STAT-03**: Statistics panel shows: number of child-free days per parent (no children present)
- [ ] **STAT-04**: Statistics panel shows: number of child-free weekends per parent (full weekend Sat+Sun with no children)
- [ ] **STAT-05**: Statistics reflect both published and draft entries so parents can see the effect of their plan before publishing

## v2 Requirements

### Onboarding

- **ONBR-01**: First-run wizard that lets parents enter children names, Google Calendar IDs, and the starting week pattern without editing config/env
- **ONBR-02**: Mobile-optimized layout refinements based on usage data

### Audit

- **AUDT-01**: Per-cell change history showing who changed a cell and when
- **AUDT-02**: Change log visible in the UI

### Future Exports

- **EXPRT-01**: iCal / Outlook export as an alternative to Google Calendar sync
- **EXPRT-02**: Per-month or per-school-term statistics breakdown

## Out of Scope

| Feature | Reason |
|---------|--------|
| Secure / tamper-proof messaging | Adversarial co-parenting feature; this app is for cooperative parents |
| Expense tracking | Separate domain; Splitwise/Venmo handle this better |
| Private per-parent notes | Creates coordination confusion; shared notes only |
| Conflict flagging / merge UI | Last-write-wins is sufficient for two cooperative parents |
| Legal documentation / court export | Wrong audience; adds compliance complexity |
| In-app messaging | Separate product; parents use existing channels |
| Recurring exception templates | Rule engine conflicts with simple table model |
| Push notification system | Google Calendar handles reminders natively once events sync |
| Third-party access (grandparents, lawyers) | Two-parent design is a feature, not a limitation |
| Native mobile app | Responsive web is sufficient |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| AUTH-04 | Phase 1 | Complete |
| SETP-01 | Phase 1 | Complete |
| SETP-02 | Phase 2 | Complete |
| SCHED-01 | Phase 2 | Pending |
| SCHED-02 | Phase 2 | Pending |
| SCHED-03 | Phase 2 | Complete |
| SCHED-04 | Phase 2 | Complete |
| SCHED-05 | Phase 2 | Complete |
| SCHED-06 | Phase 2 | Pending |
| DRFT-01 | Phase 2 | Complete |
| DRFT-02 | Phase 3 | Pending |
| DRFT-03 | Phase 2 | Pending |
| GCAL-01 | Phase 4 | Pending |
| GCAL-02 | Phase 4 | Pending |
| GCAL-03 | Phase 4 | Pending |
| GCAL-04 | Phase 4 | Pending |
| GCAL-05 | Phase 4 | Pending |
| STAT-01 | Phase 3 | Pending |
| STAT-02 | Phase 3 | Pending |
| STAT-03 | Phase 3 | Pending |
| STAT-04 | Phase 3 | Pending |
| STAT-05 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-04*
*Last updated: 2026-04-04 after roadmap creation*
