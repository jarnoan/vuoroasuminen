---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: Deploy + Onboarding
status: ready_to_plan
stopped_at: Phase 11 context gathered
last_updated: "2026-05-16T05:59:47.351Z"
last_activity: 2026-05-16 -- Phase 11 wave 1 complete (11-01, 11-02)
progress:
  total_phases: 3
  completed_phases: 1
  total_plans: 3
  completed_plans: 2
  percent: 33
---

# Project State

## Project Reference

See: .planning/PROJECT.md

**Core value:** Both parents always see the same up-to-date custody schedule, reflected in their Google Calendars, without manual coordination.
**Current focus:** Phase 11 — production-deploy

## Current Position

Phase: 12
Plan: Not started
Status: Ready to plan
Last activity: 2026-05-16

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity (v1.1 reference):**

- Total plans completed: 45 (v1.0: 9, v1.1: 9 across 3 phases)

**By Phase (v1.2):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 08 | TBD | - | - |
| 09 | 3 | - | - |
| 10 | 4 | - | - |
| 8 | 8 | - | - |
| 11 | 3 | - | - |

*Updated after each plan completion*
| Phase 10 P04 | 6 | 3 tasks | 1 files |

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
- vitest.config.ts must exclude **/.{git,claude}/** to prevent abandoned parallel-agent worktrees from causing false-positive suite failures
- db:push verbose mode must be used to confirm no-op; the non-verbose Changes applied message is drizzle-kit completion UX, not DDL execution
- CLAUDE.md grep hits for @auth/drizzle-adapter and next-auth are documentation artifacts in tech stack evaluation tables — accepted, not active code references
- Phase 10 complete: Auth.js fully removed — packages uninstalled, DB tables dropped, env vars renamed, both parents re-signed-in via Supabase OAuth, GCal publish round-trip confirmed

Key decisions and constraints for v1.3 work:

- Next.js 16 requires middleware.ts → proxy.ts rename — build-breaking if not done before deploy (DPLY-05)
- Invite token must be stored in DB with expiry — do not use signed JWTs alone; DB storage enables revocation
- Authenticated role grants must be manually applied to new DB tables (onboarding/family config table) — not inherited automatically from existing RLS policies
- ONBR-07 (access gate middleware) must be implemented after the wizard (Phase 12) is complete — gating before wizard is ready locks everyone out
- Family config table replaces APP_PARENT* env vars; generate-app-config.js must be updated or removed accordingly

### Pending Todos (Operational — pre-deploy)

- Start Google OAuth app verification process (3–5 business day wait)
- Upgrade Supabase to Pro before sharing with real users (free tier pauses after 1 week inactivity)
- CR-01: git history scrub (`git filter-repo`) for `src/config/app.ts` — force-push still pending
- Configure Google OAuth redirect URI in Google Cloud Console to point to `https://<ref>.supabase.co/auth/v1/callback` (Supabase's auth server), NOT the Next.js `/auth/callback`
- Add `https://*.vercel.app/auth/callback` to Supabase allowlist if preview deployments are used
- Add `SUPABASE_SERVICE_ROLE_KEY` to `.env` (required for admin Drizzle connection)

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260515-u3b | Move remaining hardcoded config values to env vars | 2026-05-15 | e19f43f | [260515-u3b-move-remaining-hardcoded-config-values-i](./quick/260515-u3b-move-remaining-hardcoded-config-values-i/) |

### Blockers/Concerns

None currently.

## Deferred Items

Items carried forward to v1.3:

| Category | Item | Status |
|----------|------|--------|
| uat_gap | Phase 07: 07-HUMAN-UAT.md (8 pending scenarios) | partial — v1.1 era, low priority |
| verification_gap | Phase 05: 05-VERIFICATION.md | human_needed — v1.1 era |
| verification_gap | Phase 06: 06-VERIFICATION.md | human_needed — v1.1 era |
| verification_gap | Phase 07: 07-VERIFICATION.md | human_needed — v1.1 era |
| quick_task | 260420-qex-deploy-this-app | pending — plan stale (refs old Auth.js env vars); needs replan for v1.2 stack |
| quick_task | 260421-finnish-date-formats | pending — no plan yet |
| quick_task | 20260515-env-local-dedup | complete — removed 9 unused APP_* vars from .env.local |

Resolved at v1.2 close (had SUMMARY.md, STATE.md was stale):

- 260406-oca, 260406-ogw, 260407-r3q, 260407-rbx, 260407-rim
- 260412-fhd, 260412-fjd, 260412-u66, 260412-ud9, 260412-ut3, 260412-v2m
- 260420-p95, 260421-translate-ui-to-finnish, 260425-g08

## Session Continuity

Last activity: 2026-05-16 - v1.3 roadmap created (Phases 11–13)
Last session: --stopped-at
Stopped at: Phase 11 context gathered
Resume file: --resume-file

**Planned Phase:** 11 (production-deploy) — 3 plans — 2026-05-16T05:53:08.012Z
