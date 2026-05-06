---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Schedule Window Control
status: planning
stopped_at: Phase 7 UI-SPEC approved
last_updated: "2026-05-06T18:10:50.402Z"
last_activity: 2026-05-06
progress:
  total_phases: 3
  completed_phases: 2
  total_plans: 9
  completed_plans: 6
  percent: 67
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-27 after v1.1 milestone start)

**Core value:** Both parents always see the same up-to-date custody schedule, reflected in their Google Calendars, without manual coordination.
**Current focus:** Phase --phase — 06

## Current Position

Phase: 7
Plan: Not started
Status: Ready to plan
Last activity: 2026-05-06

Progress: [██████████] 100%

## Performance Metrics

**Velocity (v1.0 reference):**

- Total plans completed: 15
- v1.0 phases: 4 phases across 9 plans

**By Phase (v1.1):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 05 | 4 | - | - |
| 06 | 2 | - | - |

*Updated after each plan completion*
| Phase 05 P04 | 5min | 2 tasks | 3 files |

## Accumulated Context

### Decisions

All v1.0 decisions logged in PROJECT.md Key Decisions table.

Key decisions to preserve in v1.1 work:

- Split Auth.js config pattern must not be changed
- `prompt:consent + access_type:offline` on every Google sign-in must be preserved
- VIEW-04 per-user storage strategy (localStorage vs DB user_preferences table) — deferred to Phase 5 planning
- "Unassigned" state representation (null parent field vs deleted row) — deferred to Phase 7 planning
- ViewToolbar wired between header and publish bar in DashboardShell; today-button.tsx deleted

### Pending Todos (Operational — pre-deploy)

- Update `src/config/app.ts` with mother's real email before deploying to two users
- Start Google OAuth app verification process (3–5 business day wait)
- Upgrade Supabase to Pro before sharing with real users (free tier pauses after 1 week inactivity)
- CR-01: git history scrub (`git filter-repo`) for `src/config/app.ts` — force-push still pending

### Blockers/Concerns

None currently.

## Session Continuity

Last session: --stopped-at
Stopped at: Phase 7 UI-SPEC approved
Resume file: --resume-file

**Planned Phase:** 07 (clear-entries) — 3 plans — 2026-05-06T18:10:50.400Z
