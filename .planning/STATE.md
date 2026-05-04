---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Schedule Window Control
status: planning
stopped_at: Phase 5 context gathered
last_updated: "2026-05-04T15:38:54.766Z"
last_activity: 2026-04-27 — Roadmap created for v1.1 (3 phases, 9 requirements mapped)
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-27 after v1.1 milestone start)

**Core value:** Both parents always see the same up-to-date custody schedule, reflected in their Google Calendars, without manual coordination.
**Current focus:** v1.1 — Phase 5: View Window Control

## Current Position

Phase: 5 of 7 (View Window Control)
Plan: — (not yet planned)
Status: Ready to plan
Last activity: 2026-04-27 — Roadmap created for v1.1 (3 phases, 9 requirements mapped)

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity (v1.0 reference):**

- Total plans completed: 9
- v1.0 phases: 4 phases across 9 plans

**By Phase (v1.1):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

*Updated after each plan completion*

## Accumulated Context

### Decisions

All v1.0 decisions logged in PROJECT.md Key Decisions table.

Key decisions to preserve in v1.1 work:

- Split Auth.js config pattern must not be changed
- `prompt:consent + access_type:offline` on every Google sign-in must be preserved
- VIEW-04 per-user storage strategy (localStorage vs DB user_preferences table) — deferred to Phase 5 planning
- "Unassigned" state representation (null parent field vs deleted row) — deferred to Phase 7 planning

### Pending Todos (Operational — pre-deploy)

- Update `src/config/app.ts` with mother's real email before deploying to two users
- Start Google OAuth app verification process (3–5 business day wait)
- Upgrade Supabase to Pro before sharing with real users (free tier pauses after 1 week inactivity)
- CR-01: git history scrub (`git filter-repo`) for `src/config/app.ts` — force-push still pending

### Blockers/Concerns

None currently.

## Session Continuity

Last session: --stopped-at
Stopped at: Phase 5 context gathered
Resume file: --resume-file
