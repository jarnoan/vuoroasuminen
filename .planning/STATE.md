---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: completed
stopped_at: Completed 260515-u3b — moved hardcoded config to env vars, app.ts now tracked in git
last_updated: "2026-05-15T18:55:32.416Z"
progress:
  total_phases: 3
  completed_phases: 3
  total_plans: 16
  completed_plans: 16
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md

**Core value:** Both parents always see the same up-to-date custody schedule, reflected in their Google Calendars, without manual coordination.
**Current focus:** Phase 09 — Row Level Security (complete)

## Current Position

Phase: 09 — Row Level Security — COMPLETE
Plan: 4 of 4
Next: v1.2 milestone complete
Status: All phases complete

Progress: [██████████] 100%

## Performance Metrics

**Velocity (v1.1 reference):**

- Total plans completed: 42 (v1.0: 9, v1.1: 9 across 3 phases)

**By Phase (v1.2):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 08 | TBD | - | - |
| 09 | 3 | - | - |
| 10 | 4 | - | - |
| 8 | 8 | - | - |

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
- APP_CHILDREN and APP_START_DATE added to REQUIRED_ENV_VARS — no safe generic default; names and firstParent use fallbacks so they are optional

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

Last session: 2026-05-15T18:55:27.419Z
Stopped at: Completed 260515-u3b — moved hardcoded config to env vars, app.ts now tracked in git
Resume file: None

**Planned Phase:** 10 (Auth.js Removal) — 4 plans — 2026-05-14T20:37:10.042Z
