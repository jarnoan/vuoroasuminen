# Vuoroasuminen

## What This Is

A shared web application for co-parents to plan and track which children stay with which parent on each day. Both parents log in with their Google accounts, see and edit the same 12-week schedule in real time, and confirmed plans automatically sync to dedicated Google Calendars — one per parent. The name "vuoroasuminen" is Finnish for alternating custody.

The v1.0 MVP is feature-complete: authentication, collaborative schedule table, draft/publish flow, custody balance statistics, and full Google Calendar integration are all shipped.

## Core Value

Both parents always see the same up-to-date custody schedule, reflected in their Google Calendars, without manual coordination.

## Requirements

### Validated

- ✓ Google OAuth authentication — both parents log in with their own Google accounts — v1.0
- ✓ Both parents share the same schedule data (real-time collaborative view) via Supabase Realtime — v1.0
- ✓ Schedule table UI: rows = days (12-week rolling window), columns = children + shared notes — v1.0
- ✓ Color-coded parent cells; children independently assignable to either parent on any day — v1.0
- ✓ Default schedule pre-filled with alternating-week pattern; users edit exceptions — v1.0
- ✓ Draft mode: edits create draft entries, visually distinct from published — v1.0
- ✓ Shared notes per day (both parents can read and write, real-time sync) — v1.0
- ✓ Either parent can publish the current draft; triggers Google Calendar sync — v1.0
- ✓ Google Calendar integration: one calendar per parent; one all-day event per child per custody day — v1.0
- ✓ Idempotent sync with orphan cleanup on custody switch — v1.0
- ✓ Statistics panel: days/child/parent, solo days, child-free days and weekends — v1.0
- ✓ Statistics computed from both draft and published entries — v1.0

### Active

- [ ] Onboarding wizard: first-run UI to configure parents, children, and calendar IDs without editing config files (ONBR-01)
- [ ] Mobile-optimized layout refinements (ONBR-02)
- [ ] Per-cell change history: who changed a cell and when (AUDT-01, AUDT-02)

### Out of Scope

- Per-parent private notes — only shared notes supported; keeps coordination simple
- Conflict flagging / merge UI — last-write-wins is sufficient for cooperative co-parents
- Native mobile app — responsive web handles mobile browsers
- Per-month or per-term statistics — full window totals are sufficient
- iCal / Outlook export — Google Calendar is the hard integration target
- Secure/adversarial messaging — wrong audience; this app is for cooperative parents
- Third-party access (grandparents, lawyers) — two-parent design is intentional
- Push notification system — Google Calendar handles reminders once events sync

## Context

- Two parents share custody of multiple children; children can be split between parents on any day
- Planning horizon is ~12 weeks; default pattern is alternating full weeks
- Google is the identity provider and calendar backend — both parents must have Google accounts
- Shipped v1.0 with 2,272 LOC TypeScript; stack: Next.js 16, Auth.js v5, Drizzle ORM, Supabase, googleapis
- Config-based parent/calendar setup (`src/config/app.ts`) — must be updated with real emails before deploying to two users
- Supabase free tier pauses after 1 week of inactivity — upgrade to Pro before real-user handoff
- Google OAuth app verification takes 3–5 business days — start before sharing with second user

## Constraints

- **Auth**: Google OAuth only — no email/password; both parents need Google accounts
- **Calendar**: Google Calendar API — integration is a hard requirement
- **Collaboration**: Real-time shared data — both parents must see each other's changes promptly
- **Conflict resolution**: Last-write-wins — no complex merge UI needed

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Google OAuth for auth | Both parents already have Google accounts; avoids managing separate credentials | ✓ Good — Auth.js v5 + DrizzleAdapter; JWT strategy for edge-compatible middleware |
| One calendar per parent (not per child) | Parents want to see their own obligations in their calendar | ✓ Good — clean event isolation per parent |
| One all-day event per child per day | Each child's location is independently visible in the calendar | ✓ Good — DATE format, exclusive end date, timezone-safe |
| Last-write-wins conflict resolution | Co-parents can coordinate informally; complex merge UI is overkill | ✓ Good — no conflicts encountered in testing |
| Draft → publish flow, either parent can publish | Avoids deadlock; either parent taking initiative is enough | ✓ Good — dialog confirmation prevents accidental publish |
| Full 12-week window for statistics (no sub-period breakdown) | Simpler; total balance over the planning period is what matters | ✓ Good — computeStats is a pure function, easily extended |
| Split Auth.js config (auth.config.ts + auth.ts) | Edge-safe middleware requires no adapter import | ✓ Good — required pattern for Next.js 15 middleware |
| JWT strategy WITH DrizzleAdapter | JWT cookie for edge middleware; adapter persists OAuth tokens for GCal sync | ✓ Good — both concerns satisfied without compromise |
| prompt:consent + access_type:offline on every sign-in | Forces refresh_token re-issue; prevents invalid_grant after token expiry | ✓ Good — solved real invalid_grant bug in testing |
| GCal sync best-effort (failure doesn't roll back DB publish) | Sync failure shouldn't block confirmed plans | ✓ Good — warning toast informs user; next publish re-syncs |
| gcal_events mirror table from day one | Needed for idempotent sync; avoids extra GCal API reads on republish | ✓ Good — UNIQUE constraint on (schedule_entry_id, calendar_id) enforces idempotency |
| Config-based parent setup (not DB-driven) | Simplest approach for a known two-user app | ⚠ Revisit — blocks self-service onboarding for v1.1 |

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
*Last updated: 2026-04-20 after v1.0 milestone*
