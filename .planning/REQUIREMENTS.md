# Requirements: Vuoroasuminen

**Defined:** 2026-05-17
**Core Value:** Both parents always see the same up-to-date custody schedule, reflected in their Google Calendars, without manual coordination.

## v1.4 Requirements

Requirements for milestone v1.4 — Mobile-First Polish.

### Realtime Reliability

- [ ] **RTLT-01**: User returning to app after 15+ minutes in background sees up-to-date schedule without manual page reload

### Mobile Layout

- [ ] **MOB-01**: Schedule table fits 360–430px viewport without horizontal scrolling
- [ ] **MOB-01b**: Each day row on mobile shows child cells on top and notes text on a second row below (desktop layout unchanged)
- [ ] **MOB-02**: Long-press on a custody cell shows a clear option on touch devices; existing hover × button unchanged on desktop
- [ ] **MOB-03**: Date picker on mobile uses native `<input type="date">`; desktop keeps existing calendar popover
- [ ] **MOB-03a**: View toolbar controls fit within mobile viewport without overflow
- [ ] **MOB-04**: Header fits on mobile — parent name truncated or hidden; sign-out accessible
- [ ] **MOB-05**: Statistics panel positioned below the schedule table on all viewports; 2-column grid on mobile

## Future Requirements

### Audit Trail

- **AUDT-01**: User can see who last changed a custody cell and when
- **AUDT-02**: User can view the change history for a specific cell

## Out of Scope

| Feature | Reason |
|---------|--------|
| Native mobile app | Responsive web handles mobile browsers |
| Bottom tab bar navigation | Two-item nav is below HIG/MD3 minimum of 3; top nav is sufficient |
| Swipe-to-reveal clear | WCAG 2.5.1 violation; conflicts with screen reader gestures |
| Card-per-row table layout | Destroys day-to-day comparison which is the core use case |
| Push notifications | Google Calendar handles reminders once events sync |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| RTLT-01 | Phase 14 | Pending |
| MOB-04 | Phase 15 | Pending |
| MOB-02 | Phase 15 | Pending |
| MOB-03 | Phase 15 | Pending |
| MOB-03a | Phase 15 | Pending |
| MOB-01 | Phase 16 | Pending |
| MOB-01b | Phase 16 | Pending |
| MOB-05 | Phase 16 | Pending |

**Coverage:**
- v1.4 requirements: 8 total
- Mapped to phases: 8
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-17*
*Last updated: 2026-05-17 after roadmap creation (phases 14–16)*
