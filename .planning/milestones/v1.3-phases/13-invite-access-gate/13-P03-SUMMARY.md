---
phase: 13-invite-access-gate
plan: P03
subsystem: auth
tags: [invite, tokens, oauth, drizzle, auth-callback, error-page, finnish-ui]

# Dependency graph
requires:
  - phase: 13-invite-access-gate
    plan: P01
    provides: invite_token cookie set by InviteSignInButton before OAuth redirect
  - phase: 12-onboarding-wizard
    provides: family_config table with parent2_email column
  - phase: 08-supabase-auth-stack
    provides: auth/callback route structure, service_role Drizzle connection
provides:
  - Invite cookie consumption in auth/callback (validates, redeems, clears cookie)
  - family_config.parent2_email updated to actual Parent B sign-in email
  - inviteTokens.usedAt + usedBy audit stamp on redemption
  - auth/error page unauthorized_email variant with Finnish copy and no retry button
affects: [13-P04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Drizzle isNull + gt operators for invite token validation (unused + non-expired)"
    - "Try/catch around invite redemption — errors log but never block sign-in"
    - "Cookie clear via maxAge=0 after redemption"
    - "useSearchParams + Suspense boundary for Next.js App Router error page variants"

key-files:
  created: []
  modified:
    - src/app/auth/callback/route.ts
    - src/app/auth/error/page.tsx

key-decisions:
  - "Invite redemption wrapped in try/catch — if DB fails, Parent B still signs in successfully; middleware (P04) handles further access control"
  - "auth/error page uses Suspense wrapping AuthErrorContent component — required by Next.js App Router when useSearchParams() is called in a client component"
  - "unauthorized_email variant has no retry button — session is already invalidated by middleware (P04) before redirect; a retry button would immediately re-trigger the same rejection"

requirements-completed: [ONBR-06]

# Metrics
duration: 1min
completed: 2026-05-16
---

# Phase 13 Plan P03: Invite Cookie Consumption + Auth Error Page Summary

**Invite token redemption in auth/callback: validates invite_token cookie, updates parent2_email to actual sign-in email, stamps audit trail; auth/error page extended with Finnish unauthorized_email variant (no retry)**

## Performance

- **Duration:** 1 min
- **Started:** 2026-05-16T21:47:00Z
- **Completed:** 2026-05-16T21:48:10Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- auth/callback now reads `invite_token` cookie after `user_google_tokens` upsert
- Token validated with Drizzle: `isNull(usedAt)` + `gt(expiresAt, new Date())` — forged/replayed tokens fail silently (T-13-P03-01)
- On valid token: `family_config.parent2_email` updated to actual sign-in email (D-09), `inviteTokens.usedAt` + `usedBy` stamped (D-08), cookie cleared with `maxAge=0` (T-13-P03-06)
- Redemption block wrapped in try/catch — DB failures log but do NOT block sign-in redirect (T-13-P03-04)
- auth/error page: `useSearchParams()` detects `?error=unauthorized_email` query param
- unauthorized_email variant: "Pääsy estetty" h1, Finnish explanation, no retry button (D-12)
- Default calendar-scope variant with "Kirjaudu sisään uudelleen" retry button preserved unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Consume invite cookie in auth/callback** - `b41091b` (feat)
2. **Task 2: Add unauthorized_email variant to auth/error page** - `fc139e0` (feat)

## Files Created/Modified

- `src/app/auth/callback/route.ts` — extended with invite token consumption block (57 lines added)
- `src/app/auth/error/page.tsx` — extended with useSearchParams + Suspense + unauthorized_email variant

## Decisions Made

- Invite redemption wrapped in try/catch: if DB fails, Parent B still signs in successfully — middleware (P04) handles further access control. Consistent with T-13-P03-04 accept disposition.
- auth/error page uses `Suspense` wrapping `AuthErrorContent` component — required by Next.js App Router when `useSearchParams()` is called in a client component. Plan anticipated this and included the Suspense pattern.
- No retry button on unauthorized_email variant: session is already invalidated by middleware (P04) before redirect; adding a retry button would immediately re-trigger the same rejection loop.

## Deviations from Plan

None — plan executed exactly as written. The Suspense wrapping was explicitly anticipated in the plan's action description and applied as specified.

## Known Stubs

None — all data paths are wired. The invite token redemption reads from and writes to the actual DB.

## Threat Flags

No new security-relevant surfaces beyond the threat model in the plan. All STRIDE mitigations applied as specified:
- T-13-P03-01: Token validated with `isNull(usedAt)` + `gt(expiresAt)` before any DB write
- T-13-P03-02: `family_config.parent2_email` updated only when valid token found
- T-13-P03-03: `usedAt` + `usedBy` stamped, row not deleted (audit preserved)
- T-13-P03-06: Cookie cleared (`maxAge=0`) immediately after successful redemption

## Self-Check: PASSED

- [x] `src/app/auth/callback/route.ts` exists and contains invite token consumption
- [x] `src/app/auth/error/page.tsx` exists and contains unauthorized_email variant
- [x] Commit b41091b exists (Task 1)
- [x] Commit fc139e0 exists (Task 2)
- [x] `npx tsc --noEmit` exits 0 — verified after each task
