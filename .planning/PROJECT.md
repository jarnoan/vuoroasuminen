# Vuoroasuminen

## What This Is

A shared web application for co-parents to plan and track which children stay with which parent on each day. Both parents log in with their Google accounts, see and edit the same schedule in real time, and confirmed plans automatically sync to dedicated Google Calendars — one per parent. The name "vuoroasuminen" is Finnish for alternating custody.

v1.0 shipped the full MVP: authentication, collaborative schedule table, draft/publish flow, custody balance statistics, and Google Calendar integration. v1.1 added flexible schedule window control — per-user view window, schedule extension, and cell/range clearing. v1.2 replaces Auth.js with Supabase Auth and enables Row Level Security on all domain tables.

## Current Milestone: v1.2 Supabase Auth Migration

**Goal:** Replace Auth.js v5 with Supabase Auth to unify the auth stack and enable Row Level Security on all domain tables.

**Target features:**
- Supabase Google OAuth replaces Auth.js v5 + DrizzleAdapter
- Supabase cookie-based session management in Next.js App Router
- Custom `user_google_tokens` table — stores Google refresh tokens by email; calendar owner model (one owner sufficient for all calendars)
- `app.ts` gains `ownerEmail` per calendar; GCal sync uses owner's token regardless of which parent publishes
- Auth.js schema tables removed (users, accounts, sessions, verificationTokens)
- Row Level Security enabled on all domain tables (authenticated users only for v1.2)

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
- ✓ View window starts from Monday of current week by default; past days of current week visible — v1.1
- ✓ "Show previous week" button extends view start by one week; repeatable — v1.1
- ✓ User can set explicit start date for the view via date picker — v1.1
- ✓ View window preferences are per-user, not shared — v1.1
- ✓ "+ Lisää viikkoja" button extends schedule forward by N weeks with alternating-week defaults — v1.1
- ✓ Live date range preview shown before confirming extension — v1.1
- ✓ User can specify explicit end date when extending — v1.1
- ✓ User can clear a single cell to unassigned (empty) — v1.1
- ✓ User can select a date range and clear all child assignments within it — v1.1
- ✓ Row Level Security enabled on all 5 domain tables (children, schedules, schedule_entries, gcal_events, user_google_tokens) — v1.2 Phase 9
- ✓ Unauthenticated PostgREST requests return empty arrays (anon blocked by RLS) — v1.2 Phase 9
- ✓ Realtime subscription authenticated via JWT before channel subscribe (race condition fixed) — v1.2 Phase 9

### Active

**Future milestones**
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
- Clear to default pattern — user confirmed "clear = unassigned/empty", not reset-to-default
- Auto-extend on scroll — explicit action preferred over implicit row generation
- Shared view window — each parent controls their own view independently

## Context

- Two parents share custody of multiple children; children can be split between parents on any day
- Planning horizon is ~12 weeks; default pattern is alternating full weeks
- Google is the identity provider and calendar backend — both parents must have Google accounts
- Shipped v1.1 with ~3,879 LOC TypeScript; stack: Next.js 16, Auth.js v5, Drizzle ORM, Supabase, googleapis
- Config-based parent/calendar setup (`src/config/app.ts`) — must be updated with real emails before deploying to two users
- Supabase free tier pauses after 1 week of inactivity — upgrade to Pro before real-user handoff
- Google OAuth app verification takes 3–5 business days — start before sharing with second user
- Git history scrub still pending for `src/config/app.ts` (CR-01)

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
| Config-based parent setup (not DB-driven) | Simplest approach for a known two-user app | ⚠ Revisit — blocks self-service onboarding; next milestone priority |
| viewStart as URL param (not DB preference) | Zero write path; per-user by nature (each browser independent); shareable link | ✓ Good — simple and effective for per-user view control |
| parent_id nullable (unassigned = null, not deleted row) | Preserves draft row; unassigned is a first-class state | ✓ Good — clean semantics through draft/publish/GCal sync |
| Inline expand panels for ExtendPanel and ClearPanel (not modals) | Consistent with schedule table context; no overlay needed | ✓ Good — established pattern for future panels |

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
*Last updated: 2026-05-06 after v1.1 milestone*
