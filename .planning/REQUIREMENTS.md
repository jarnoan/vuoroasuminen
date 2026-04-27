# Requirements: Vuoroasuminen

**Defined:** 2026-04-27
**Milestone:** v1.1 — Schedule Window Control
**Core Value:** Both parents always see the same up-to-date custody schedule, reflected in their Google Calendars, without manual coordination.

## v1.1 Requirements

### View Window

- [ ] **VIEW-01**: View window starts from Monday of the current week by default — past days of the current week are visible
- [ ] **VIEW-02**: User can tap/click "Show previous week" to extend the view one week back; action is repeatable
- [ ] **VIEW-03**: User can set an explicit start date for the view via a date picker
- [ ] **VIEW-04**: View window preferences (start date) are stored per-user — one parent's changes do not affect the other's view

### Extend Schedule

- [ ] **EXTEND-01**: User can extend the schedule forward by N weeks (default 12); new entries are pre-filled with the alternating-week default pattern
- [ ] **EXTEND-02**: Before confirming, the UI shows the start and end dates of the range being added
- [ ] **EXTEND-03**: User can specify an explicit end date instead of adding a fixed number of weeks

### Clear Entries

- [ ] **CLEAR-01**: User can clear a single cell — the child's assignment on that day becomes unassigned (empty, no parent)
- [ ] **CLEAR-02**: User can select a date range and clear all child assignments within it — all cells in range become unassigned

## Future Requirements

### Onboarding (ONBR)

- **ONBR-01**: User can configure parents, children, and calendar IDs via a first-run UI (no code editing required)
- **ONBR-02**: Mobile-optimized layout refinements

### Audit Log (AUDT)

- **AUDT-01**: User can see who changed a cell and when
- **AUDT-02**: Per-cell change history is accessible from the schedule table

## Out of Scope

| Feature | Reason |
|---------|--------|
| Clear to default pattern | User confirmed "clear = unassigned/empty", not reset-to-default |
| Auto-extend on scroll | Explicit action preferred over implicit row generation |
| Shared view window | Each parent controls their own view independently |
| Per-month / per-term stats | Full window totals sufficient (established in v1.0) |
| iCal / Outlook export | Google Calendar is the hard integration target |
| Push notifications | Google Calendar handles reminders once events sync |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| VIEW-01 | Phase 5 | Pending |
| VIEW-02 | Phase 5 | Pending |
| VIEW-03 | Phase 5 | Pending |
| VIEW-04 | Phase 5 | Pending |
| EXTEND-01 | Phase 6 | Pending |
| EXTEND-02 | Phase 6 | Pending |
| EXTEND-03 | Phase 6 | Pending |
| CLEAR-01 | Phase 7 | Pending |
| CLEAR-02 | Phase 7 | Pending |

**Coverage:**
- v1.1 requirements: 9 total
- Mapped to phases: 9 (100%) ✓
- Unmapped: 0

---
*Requirements defined: 2026-04-27*
*Last updated: 2026-04-27 — traceability populated after roadmap creation*
