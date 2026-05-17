---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: Deploy + Onboarding
status: executing
stopped_at: Phase 13 UI-SPEC approved
last_updated: "2026-05-16T21:41:16.733Z"
last_activity: 2026-05-16 -- Phase 13 execution started
progress:
  total_phases: 3
  completed_phases: 2
  total_plans: 12
  completed_plans: 8
  percent: 67
---

# Project State

## Project Reference

See: .planning/PROJECT.md

**Core value:** Both parents always see the same up-to-date custody schedule, reflected in their Google Calendars, without manual coordination.
**Current focus:** Phase 13 — invite-access-gate

## Current Position

Phase: 13 (invite-access-gate) — EXECUTING
Plan: 1 of 4
Status: Executing Phase 13
Last activity: 2026-05-16 -- Phase 13 execution started

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity (v1.1 reference):**

- Total plans completed: 50 (v1.0: 9, v1.1: 9 across 3 phases)

**By Phase (v1.2):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 08 | TBD | - | - |
| 09 | 3 | - | - |
| 10 | 4 | - | - |
| 8 | 8 | - | - |
| 11 | 3 | - | - |
| 12 | 5 | - | - |

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

### Pending Todos (Operational)

- Start Google OAuth app verification process (3–5 business day wait)
- Upgrade Supabase to Pro before sharing with real users (free tier pauses after 1 week inactivity)
- CR-01: git history scrub (`git filter-repo`) for `src/config/app.ts` — force-push still pending; Phase 12 did NOT add new secrets to git
- Remove legacy env vars from Vercel project settings (Settings → Environment Variables): `PARENT_FATHER_EMAIL`, `PARENT_FATHER_NAME`, `PARENT_FATHER_CALENDAR_ID`, `PARENT_MOTHER_EMAIL`, `PARENT_MOTHER_NAME`, `PARENT_MOTHER_CALENDAR_ID`, `APP_CHILDREN`, `APP_START_DATE`, `APP_FIRST_PARENT`, `APP_CALENDAR_OWNER_EMAIL` — Phase 12 made these unused
- After Vercel env cleanup, redeploy and confirm production app boots (complete wizard on prod if family_config row not yet seeded there)
- ~~Configure Google OAuth redirect URI~~ — done in Phase 11 (wsdrguowmcjyfrsjsywn.supabase.co/auth/v1/callback added)
- ~~Add SUPABASE_SERVICE_ROLE_KEY~~ — not used in codebase; removed from requirements

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

Last activity: 2026-05-16 - Phase 12 (Onboarding Wizard) complete; DB-driven family config replaces env vars
Stopped at: Phase 13 UI-SPEC approved
