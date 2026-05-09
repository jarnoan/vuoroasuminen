---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Supabase Auth Migration
status: active
stopped_at: ~
last_updated: "2026-05-09T00:00:00.000Z"
last_activity: 2026-05-09 -- Milestone v1.2 started
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md

**Core value:** Both parents always see the same up-to-date custody schedule, reflected in their Google Calendars, without manual coordination.
**Current focus:** Defining requirements for v1.2

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-05-09

Progress: [██████████] 100%

## Performance Metrics

**Velocity (v1.0 reference):**

- Total plans completed: 18
- v1.0 phases: 4 phases across 9 plans

**By Phase (v1.1):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 05 | 4 | - | - |
| 06 | 2 | - | - |
| 07 | 3 | - | - |

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

## Deferred Items

Items acknowledged and deferred at milestone close on 2026-05-06:

| Category | Item | Status |
|----------|------|--------|
| uat_gap | Phase 07: 07-HUMAN-UAT.md (8 pending scenarios) | partial |
| verification_gap | Phase 05: 05-VERIFICATION.md | human_needed |
| verification_gap | Phase 06: 06-VERIFICATION.md | human_needed |
| verification_gap | Phase 07: 07-VERIFICATION.md | human_needed |
| quick_task | 260406-oca-fix-publishbutton-disabled-state-after-p | missing |
| quick_task | 260406-ogw-fix-publishbutton-re-enable-after-new-dr | missing |
| quick_task | 260407-r3q-fix-inline-use-server-in-header-tsx-brok | missing |
| quick_task | 260407-rbx-publish-button-does-not-become-disabled | missing |
| quick_task | 260407-rim-publish-button-still-does-not-become-dis | missing |
| quick_task | 260412-fhd-fix-missing-key-prop-on-fragment-in-sche | missing |
| quick_task | 260412-fjd-fix-child-columns-not-showing-after-addi | missing |
| quick_task | 260412-u66-fix-sign-in-button-compatibility-with-ne | missing |
| quick_task | 260412-ud9-fix-gcal-sync-invalid-grant-by-persistin | missing |
| quick_task | 260412-ut3-fix-gcal-sync-rate-limit-errors-with-exp | missing |
| quick_task | 260412-v2m-add-sync-progress-indicator-to-publish-b | missing |
| quick_task | 260420-p95-fix-re-sign-in-not-persisting-fresh-oaut | missing |
| quick_task | 260420-qex-deploy-this-app | missing |
| quick_task | 260421-finnish-date-formats | missing |
| quick_task | 260425-g08-address-the-findings-in-security-review | missing |

## Session Continuity

Last session: --stopped-at
Stopped at: Phase 7 UI-SPEC approved
Resume file: --resume-file

**Planned Phase:** 07 (clear-entries) — 3 plans — 2026-05-06T18:10:50.400Z
