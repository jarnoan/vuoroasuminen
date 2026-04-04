# Vuoroasuminen

## What This Is

A shared web application for co-parents to plan and track which children stay with which parent on each day. Both parents log in with their Google accounts, see and edit the same schedule, and the plan automatically syncs to dedicated Google Calendars — one per parent. The name "vuoroasuminen" is Finnish for alternating custody.

## Core Value

Both parents always see the same up-to-date custody schedule, reflected in their Google Calendars, without manual coordination.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Schedule table UI: rows = days (12-week rolling window), columns = children + shared notes column
- [ ] Each cell shows which parent the child is with that day; any child can independently be at either parent
- [ ] Default schedule pre-filled based on alternating weeks pattern; users edit exceptions
- [ ] Draft mode: plan future dates as drafts before publishing to real calendars
- [ ] Either parent can approve a draft and publish it to Google Calendar
- [ ] Google Calendar integration: one calendar per parent; one all-day event per child per day they are with that parent (e.g. "Emma @ dad")
- [ ] Changes made in the UI are reflected in Google Calendar in real time (once approved/published)
- [ ] Google OAuth authentication — both parents log in with their own Google accounts
- [ ] Both parents share the same schedule data (real-time collaborative view)
- [ ] Last-write-wins conflict resolution for simultaneous edits
- [ ] Statistics panel: full 12-week window totals per child per parent — days with each parent, days alone with each parent, child-free days and weekends per parent
- [ ] Shared notes column per day (both parents can read and write)

### Out of Scope

- Per-parent private notes — only shared notes are supported; keeps coordination simple
- Conflict flagging / merge UI — last-write-wins is sufficient for this use case
- Mobile app — web interface only; responsive design handles mobile browsers
- Per-month or per-term counter breakdowns — full window totals are enough

## Context

- Two parents share custody of multiple children; children can be split between parents on any day
- Planning horizon is ~12 weeks ahead; default pattern is alternating weeks (each week all children go to the same parent, alternating)
- Google is the identity provider and calendar backend — both parents must have Google accounts
- The Finnish word "vuoroasuminen" describes the domain (alternating custody living)

## Constraints

- **Auth**: Google OAuth only — no email/password auth; both parents need Google accounts
- **Calendar**: Google Calendar API — integration is a hard requirement, not optional
- **Collaboration**: Real-time shared data — both parents must see each other's changes promptly
- **Conflict resolution**: Last-write-wins — no complex merge UI needed

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Google OAuth for auth | Both parents already have Google accounts; avoids managing separate credentials | — Pending |
| One calendar per parent (not per child) | Parents want to see their own obligations in their calendar | — Pending |
| One all-day event per child per day | Each child's location is independently visible in the calendar | — Pending |
| Last-write-wins conflict resolution | Co-parents can coordinate informally; complex merge UI is overkill | — Pending |
| Draft → approve flow, either parent can publish | Avoids deadlock; either parent taking initiative is enough to confirm a plan | — Pending |
| Full 12-week window for statistics (no sub-period breakdown) | Simpler; total balance over the planning period is what matters | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-04 after initialization*
