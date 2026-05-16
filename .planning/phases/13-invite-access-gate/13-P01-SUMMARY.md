---
phase: 13-invite-access-gate
plan: P01
subsystem: auth
tags: [invite, tokens, oauth, supabase, drizzle, server-actions, next-app-router]

# Dependency graph
requires:
  - phase: 12-onboarding-wizard
    provides: invite_tokens DB table schema (already exists, no schema changes needed)
  - phase: 08-supabase-auth-stack
    provides: createSupabaseServerClient, auth guard pattern, service_role Drizzle connection
provides:
  - generateInviteToken Server Action (43-char base64url, 72h expiry, one-token-per-creator)
  - getActiveInviteToken Server Action (returns active/expired/used status)
  - /invite/[token] page (server-side token validation + OAuth entry point)
  - InviteSignInButton client component (sets invite_token cookie, triggers Google OAuth)
affects: [13-P02, 13-P03, 13-P04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "crypto.randomBytes(32).toString('base64url') for 43-char URL-safe invite tokens"
    - "Hard-delete prior unused tokens before insert (one outstanding invite per creator)"
    - "invite_token cookie set via document.cookie before OAuth redirect (Max-Age=600)"
    - "InviteSignInButton extracted to separate client file per Next.js App Router convention"

key-files:
  created:
    - src/actions/invite.ts
    - src/app/invite/[token]/page.tsx
    - src/app/invite/[token]/invite-sign-in-button.tsx
  modified: []

key-decisions:
  - "InviteSignInButton extracted to its own file (invite-sign-in-button.tsx) rather than inlined in page.tsx — Next.js App Router requires separate files for client components within server component files"
  - "invite_token cookie uses SameSite=Lax (not Strict) to survive the Google OAuth cross-origin redirect"

patterns-established:
  - "Invite Server Actions: follow same auth guard pattern as setup.ts (supabase.auth.getUser + user?.email check)"
  - "Token status determination order: usedAt check first, then expiresAt, then active"

requirements-completed: [ONBR-05, ONBR-06]

# Metrics
duration: 2min
completed: 2026-05-16
---

# Phase 13 Plan P01: Invite Token Server Action + Acceptance Page Summary

**generateInviteToken Server Action with 43-char base64url tokens and 72h expiry, plus /invite/[token] page that validates tokens server-side and triggers Google OAuth with invite_token cookie**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-16T21:42:12Z
- **Completed:** 2026-05-16T21:44:06Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- generateInviteToken Server Action: 43-char base64url token (D-04), 72h expiry (D-05), hard-delete prior unused tokens (D-06), auth-gated (T-13-P01-01)
- getActiveInviteToken Server Action: returns latest token with active/expired/used status for Dashboard (P02)
- /invite/[token] Server Component: validates token against DB server-side (usedAt + expiresAt checks), renders correct Finnish surface
- InviteSignInButton client component: sets invite_token cookie before OAuth redirect (D-07), triggers Google OAuth with prompt:consent + access_type:offline

## Task Commits

Each task was committed atomically:

1. **Task 1: generateInviteToken Server Action** - `f081686` (feat)
2. **Task 2: /invite/[token] acceptance page** - `441b2f6` (feat)

**Plan metadata:** see final commit below

## Files Created/Modified

- `src/actions/invite.ts` — generateInviteToken + getActiveInviteToken Server Actions
- `src/app/invite/[token]/page.tsx` — Server Component: token validation, valid/invalid state render
- `src/app/invite/[token]/invite-sign-in-button.tsx` — Client Component: cookie-set + OAuth trigger

## Decisions Made

- `InviteSignInButton` extracted to `invite-sign-in-button.tsx` (separate file) rather than inlined in `page.tsx`. Next.js App Router requires `"use client"` to be the first directive in a module — mixing server and client exports in one file only works if the client component is defined at the bottom with no default export conflict. Separate file is the cleaner conventional approach.
- Cookie uses `SameSite=Lax` not `Strict` — `Strict` would block the cookie from being sent after the Google OAuth cross-origin redirect back to our origin. `Lax` allows top-level navigation redirects to include the cookie.

## Deviations from Plan

None — plan executed exactly as written, with one implementation detail adjusted (client component file extraction) that follows the convention the plan itself anticipated in its "File structure" comment.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- generateInviteToken is ready for P02 (StepComplete + Dashboard invite section)
- getActiveInviteToken is ready for P02 (Dashboard link status display)
- /invite/[token] page is ready for P03 (/auth/callback invite cookie consumption)
- InviteSignInButton sets the invite_token cookie that P03 will read at /auth/callback

---
*Phase: 13-invite-access-gate*
*Completed: 2026-05-16*
