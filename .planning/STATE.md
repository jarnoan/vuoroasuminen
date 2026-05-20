---
gsd_state_version: 1.0
milestone: v1.4
milestone_name: Mobile-First Polish
status: planning
stopped_at: Phase 16 context gathered
last_updated: "2026-05-20T04:52:22.153Z"
last_activity: 2026-05-19
progress:
  total_phases: 3
  completed_phases: 2
  total_plans: 5
  completed_plans: 5
  percent: 67
---

# Project State

## Project Reference

See: .planning/PROJECT.md

**Core value:** Both parents always see the same up-to-date custody schedule, reflected in their Google Calendars, without manual coordination.
**Current focus:** Phase --phase — 15

## Current Position

Phase: 16
Plan: Not started
Status: Ready to plan
Last activity: 2026-05-19

Progress: [__________] 0%

## Performance Metrics

**Velocity (v1.1 reference):**

- Total plans completed: 53 (v1.0: 9, v1.1: 9 across 3 phases)

**By Phase (v1.2):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 08 | TBD | - | - |
| 09 | 3 | - | - |
| 10 | 4 | - | - |
| 8 | 8 | - | - |
| 11 | 3 | - | - |
| 12 | 5 | - | - |
| 15 | 3 | - | - |

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

Key decisions and constraints for v1.4 work:

- All v1.4 changes are rendering-layer only — no schema changes, no new Server Actions, no data flow changes
- MOB-02 clear guard: shadcn AlertDialog 2-tap confirm + `max-sm:opacity-100` on the button; long-press rejected (no keyboard equivalent); swipe-to-reveal rejected (WCAG 2.5.1)
- MOB-03 date picker: `useMediaQuery` hook with `defaultValue: false` for conditional render of Drawer vs. Calendar popover; never use `useMediaQuery` in layout render paths (hydration flash risk)
- MOB-01 table reflow: sticky date column + hide/wrap notes on mobile + `min-w-[72px]` child cols; card-per-row rejected (destroys day comparison)
- `position: sticky` thead may break if ancestor has `overflow-hidden` on iOS — replace with `overflow-clip` before testing on physical device
- `h-[calc(100vh-8rem)]` must be replaced with `100svh` for iOS Safari toolbar safety
- Phase 14 (realtime fix) must complete before any visible UI work — silent data loss on background tab is a CRITICAL bug
- Phase 16 (table reflow) is last — depends on toolbar height being settled by Phase 15
- Build order from research: realtime fix → header → clear guard → toolbar → stats → table reflow

### Pending Todos (Operational)

- Start Google OAuth app verification process (3–5 business day wait)
- Upgrade Supabase to Pro before sharing with real users (free tier pauses after 1 week inactivity)
- CR-01: git history scrub (`git filter-repo`) for `src/config/app.ts` — force-push still pending; Phase 12 did NOT add new secrets to git
- Remove legacy env vars from Vercel project settings (Settings → Environment Variables): `PARENT_FATHER_EMAIL`, `PARENT_FATHER_NAME`, `PARENT_FATHER_CALENDAR_ID`, `PARENT_MOTHER_EMAIL`, `PARENT_MOTHER_NAME`, `PARENT_MOTHER_CALENDAR_ID`, `APP_CHILDREN`, `APP_START_DATE`, `APP_FIRST_PARENT`, `APP_CALENDAR_OWNER_EMAIL` — Phase 12 made these unused
- After Vercel env cleanup, redeploy and confirm production app boots (complete wizard on prod if family_config row not yet seeded there)

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260515-u3b | Move remaining hardcoded config values to env vars | 2026-05-15 | e19f43f | [260515-u3b-move-remaining-hardcoded-config-values-i](./quick/260515-u3b-move-remaining-hardcoded-config-values-i/) |

### Blockers/Concerns

None currently.

## Deferred Items

Items acknowledged and deferred at milestone close on 2026-05-17 (v1.3):

| Category | Item | Status |
|----------|------|--------|
| verification_gap | Phase 11: 11-VERIFICATION.md | human_needed |
| verification_gap | Phase 12: 12-VERIFICATION.md | human_needed |
| verification_gap | Phase 13: 13-VERIFICATION.md | human_needed |
| quick_task | 260406-oca-fix-publishbutton-disabled-state-after-p | missing — v1.0 era, likely resolved |
| quick_task | 260406-ogw-fix-publishbutton-re-enable-after-new-dr | missing — v1.0 era, likely resolved |
| quick_task | 260407-r3q-fix-inline-use-server-in-header-tsx-brok | missing — v1.0 era, likely resolved |
| quick_task | 260407-rbx-publish-button-does-not-become-disabled- | missing — v1.0 era, likely resolved |
| quick_task | 260407-rim-publish-button-still-does-not-become-dis | missing — v1.0 era, likely resolved |
| quick_task | 260412-fhd-fix-missing-key-prop-on-fragment-in-sche | missing — v1.0 era, likely resolved |
| quick_task | 260412-fjd-fix-child-columns-not-showing-after-addi | missing — v1.0 era, likely resolved |
| quick_task | 260412-u66-fix-sign-in-button-compatibility-with-ne | missing — v1.0 era, likely resolved |
| quick_task | 260412-ud9-fix-gcal-sync-invalid-grant-by-persistin | missing — v1.0 era, likely resolved |
| quick_task | 260412-ut3-fix-gcal-sync-rate-limit-errors-with-exp | missing — v1.0 era, likely resolved |
| quick_task | 260412-v2m-add-sync-progress-indicator-to-publish-b | missing — v1.0 era, likely resolved |
| quick_task | 260420-p95-fix-re-sign-in-not-persisting-fresh-oaut | missing — v1.1 era, likely resolved |
| quick_task | 260420-qex-deploy-this-app | missing — superseded by Phase 11 |
| quick_task | 260425-g08-address-the-findings-in-security-review- | missing — v1.1 era |
| quick_task | 260515-u3b-move-remaining-hardcoded-config-values-i | missing — has SUMMARY.md, STATE.md stale |

## Session Continuity

Last activity: 2026-05-17 — v1.4 roadmap created; Phase 14 is next
Stopped at: Phase 16 context gathered
