---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: MVP
status: complete
stopped_at: v1.0 milestone archived and tagged
last_updated: "2026-04-20T00:00:00.000Z"
last_activity: 2026-04-20
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 9
  completed_plans: 9
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-20 after v1.0 milestone)

**Core value:** Both parents always see the same up-to-date custody schedule, reflected in their Google Calendars, without manual coordination.
**Current focus:** v1.0 complete — planning v1.1 next milestone

## Current Position

Milestone v1.0 MVP — COMPLETE and ARCHIVED

All 4 phases shipped. 25/25 requirements satisfied. Git tag v1.0 created.

Next step: `/gsd:new-milestone` to define v1.1 scope.

## Accumulated Context

### Decisions

All decisions logged in PROJECT.md Key Decisions table (updated 2026-04-20).

Key architectural decisions for next milestone:
- Config-based parent setup is a known v1.1 blocker for self-service onboarding — marked ⚠ Revisit
- Split Auth.js config pattern must be preserved in any future auth changes
- `prompt:consent + access_type:offline` on every Google sign-in must be preserved to prevent invalid_grant

### Pending Todos

- Update `src/config/app.ts` with mother's real email before deploying to two users (FINDING-03)
- Start Google OAuth app verification process (3–5 business day wait)
- Upgrade Supabase to Pro before sharing with real users (free tier pauses after 1 week inactivity)

### Open Questions for v1.1

- Onboarding wizard (ONBR-01) — replaces config.ts for parent/child/calendar setup
- Mobile layout refinements (ONBR-02)
- Per-cell change history (AUDT-01, AUDT-02)

### Quick Tasks Completed (v1.0)

| # | Description | Date | Commit |
|---|-------------|------|--------|
| 260406-oca | Fix PublishButton disabled state after publishing | 2026-04-06 | d03f195 |
| 260406-ogw | Fix PublishButton re-enable after new drafts | 2026-04-06 | 5d2fc25 |
| 260407-r3q | Fix inline use server in header.tsx build error | 2026-04-07 | 1dcd532 |
| 260407-rbx | Fix publish button not becoming disabled after publish | 2026-04-07 | 948610b |
| 260407-rim | Fix publish button CDC overwrite re-enabling after publishing | 2026-04-07 | 663efae |
| 260412-fhd | Fix missing key prop on fragment in ScheduleTable map | 2026-04-12 | ac9bf22 |
| 260412-fjd | Fix child columns not showing after adding third child | 2026-04-12 | 7d397e7 |
| 260412-u66 | Fix sign-in button compatibility with next-auth@beta | 2026-04-12 | f5320fa |
| 260412-ud9 | Fix GCal sync invalid_grant by persisting refreshed tokens | 2026-04-12 | 1273119 |
| 260412-ut3 | Fix GCal sync rate limit with exponential backoff | 2026-04-12 | b050fdf |
| 260412-v2m | Add sync progress indicator to publish button | 2026-04-12 | ffc09a2 |
| 260420-p95 | Fix re-sign-in not persisting fresh OAuth tokens | 2026-04-20 | 3dedc7f |
| 260425-g08 | Address all SECURITY-REVIEW.md findings (13 code fixes + 3 operator decisions) | 2026-04-25 | ae0ec6b |

## Session Continuity

Last session: 2026-04-25
Stopped at: Security hardening complete — git history scrub (CR-01) pending force-push
