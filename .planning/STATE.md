---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Schedule Window Control
status: defining_requirements
stopped_at: ~
last_updated: "2026-04-27T00:00:00.000Z"
last_activity: 2026-04-27
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-27 after v1.1 milestone start)

**Core value:** Both parents always see the same up-to-date custody schedule, reflected in their Google Calendars, without manual coordination.
**Current focus:** v1.1 — Schedule Window Control

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-04-27 — Milestone v1.1 started

## Accumulated Context

### Decisions

All v1.0 decisions logged in PROJECT.md Key Decisions table.

Key architectural decisions to preserve:
- Split Auth.js config pattern must be preserved in any future auth changes
- `prompt:consent + access_type:offline` on every Google sign-in must be preserved to prevent invalid_grant
- Config-based parent setup (`src/config/app.ts`) — marked ⚠ Revisit for future onboarding milestone

### Pending Todos (Operational — pre-deploy)

- Update `src/config/app.ts` with mother's real email before deploying to two users (FINDING-03)
- Start Google OAuth app verification process (3–5 business day wait)
- Upgrade Supabase to Pro before sharing with real users (free tier pauses after 1 week inactivity)
- CR-01: git history scrub (`git filter-repo`) for `src/config/app.ts` — force-push still pending

### v1.1 Scope

- VIEW-01/02/03/04: Flexible per-user view window (Monday-start default, show previous week, explicit start date)
- EXTEND-01/02/03: Extend schedule forward (add N weeks, show date range, explicit end date)
- CLEAR-01/02: Clear single cell or date range to unassigned

## Session Continuity

Last session: 2026-04-27
Stopped at: v1.1 milestone started — defining requirements and roadmap
