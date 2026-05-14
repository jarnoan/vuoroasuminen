---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Supabase Auth Migration
status: planning
stopped_at: Phase 9 context gathered
last_updated: "2026-05-14T20:37:10.045Z"
progress:
  total_phases: 3
  completed_phases: 1
  total_plans: 16
  completed_plans: 11
  percent: 69
---

# Project State

## Project Reference

See: .planning/PROJECT.md

**Core value:** Both parents always see the same up-to-date custody schedule, reflected in their Google Calendars, without manual coordination.
**Current focus:** Phase --phase — 09

## Current Position

Phase: 10
Plan: Not started
Next: Phase 09 — Row Level Security
Status: Ready to plan

Progress: [███░░░░░░░] 33%

## Performance Metrics

**Velocity (v1.1 reference):**

- Total plans completed: 38 (v1.0: 9, v1.1: 9 across 3 phases)

**By Phase (v1.2):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 08 | TBD | - | - |
| 09 | 3 | - | - |
| 10 | TBD | - | - |
| 8 | 8 | - | - |

*Updated after each plan completion*

## Accumulated Context

### Decisions

All v1.0 decisions logged in PROJECT.md Key Decisions table.

Key decisions and constraints for v1.2 work:

- `prompt:consent + access_type:offline` on every Google sign-in MUST be preserved — solved real `invalid_grant` bug in v1.0
- `provider_refresh_token` is available exactly once: inside `/auth/callback` during `exchangeCodeForSession`; never readable from later `getSession()` calls
- Middleware must use `getUser()` (not `getSession()`) for route protection — `getSession()` trusts a spoofable cookie
- Supabase client must NOT be initialized at module scope in middleware — Vercel warm instances share module scope and can leak sessions between users
- `withRLS` wrapper uses `set_config(..., TRUE)` (transaction-local) — never `FALSE`, which persists for the connection and leaks auth context
- GCal sync and `user_google_tokens` reads always use the admin Drizzle connection (service_role), not `withRLS`
- Auth.js table drop order: `verificationTokens` → `sessions` → `accounts` → `users` (FK chain)
- GATE between Phase 8 and Phase 9: sign in end-to-end + confirm token row exists + confirm GCal sync works BEFORE enabling RLS

### Pending Todos (Operational — pre-deploy)

- Update `src/config/app.ts` with mother's real email before deploying to two users
- Start Google OAuth app verification process (3–5 business day wait)
- Upgrade Supabase to Pro before sharing with real users (free tier pauses after 1 week inactivity)
- CR-01: git history scrub (`git filter-repo`) for `src/config/app.ts` — force-push still pending
- Configure Google OAuth redirect URI in Google Cloud Console to point to `https://<ref>.supabase.co/auth/v1/callback` (Supabase's auth server), NOT the Next.js `/auth/callback`
- Add `https://*.vercel.app/auth/callback` to Supabase allowlist if preview deployments are used
- Add `SUPABASE_SERVICE_ROLE_KEY` to `.env` (required for admin Drizzle connection)
- Coordinate simultaneous re-sign-in by both parents immediately after Phase 10 deployment — auth cookies are incompatible with Auth.js; GCal sync fails until both parents have new Supabase sessions

### Blockers/Concerns

None currently.

## Deferred Items

Items carried forward from v1.1 milestone close (2026-05-06):

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
Stopped at: Phase 9 context gathered
Resume file: --resume-file

**Planned Phase:** 10 (Auth.js Removal) — 4 plans — 2026-05-14T20:37:10.042Z
