---
phase: 13-invite-access-gate
plan: P04
subsystem: auth
tags: [supabase, drizzle, middleware, nextjs, postgres, authentication, authorization]

# Dependency graph
requires:
  - phase: 13-P01
    provides: familyConfig table in domain.ts schema with parent1Email/parent2Email columns
  - phase: 08-supabase-auth-stack
    provides: createSupabaseMiddlewareClient, D-09 getUser() constraint, D-10 module-scope client constraint
provides:
  - Three-tier onboarding gate in src/proxy.ts enforcing auth, setup completeness, and email membership
  - Exempt routes: /, /auth/*, /invite/*, /setup
  - Unauthorized email users are signed out and redirected to /auth/error?error=unauthorized_email
affects:
  - Any future phase adding new protected routes (all pass through proxy.ts)
  - Phase 13 P02/P03 (auth callback and error page complement this gate)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Three-tier middleware gate: auth → setup completeness → email membership"
    - "Drizzle service_role db import used inside middleware function body for RLS-bypass reads"
    - "Supabase signOut() in middleware: cookies copied to fresh redirect response before and after signOut"

key-files:
  created: []
  modified:
    - src/proxy.ts

key-decisions:
  - "D-09 enforced: getUser() used (not getSession()) for server-side JWT validation"
  - "D-10 enforced: Supabase client created inside proxy() function body, not at module scope"
  - "D-13 enforced: family_config reads use module-scope Drizzle db (service_role) — stateless, safe to reuse; NOT Supabase anon client which would be blocked by RLS"
  - "DB error handling: allows through rather than hard-locking (transient errors should not lock a two-user app)"
  - "signOut() cookie copy pattern: cookies copied to redirect response both before and after signOut() to ensure session-clearing headers reach the browser"

patterns-established:
  - "Three-tier gate pattern: isExempt early-return → tier 1 unauthenticated redirect → tier 2 no-config redirect → tier 3 email mismatch signout+redirect"

requirements-completed:
  - ONBR-07

# Metrics
duration: 5min
completed: 2026-05-16
---

# Phase 13 Plan P04: Proxy Three-Tier Onboarding Gate Summary

**Three-tier middleware gate in proxy.ts: unauthenticated → /, no family_config → /setup, unrecognized email → signOut + /auth/error?error=unauthorized_email**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-16T21:48:30Z
- **Completed:** 2026-05-16T21:48:48Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Extended `src/proxy.ts` from single auth check to full three-tier onboarding gate per D-11
- Tier 1: unauthenticated requests to unexempt routes redirect to /
- Tier 2: authenticated users with no family_config row redirect to /setup
- Tier 3: authenticated users with email not matching parent1Email or parent2Email are signed out and redirected to /auth/error?error=unauthorized_email
- /invite/*, /auth/*, /setup, and / are exempt from tiers 2 and 3
- All three constraints (D-09, D-10, D-13) enforced and documented in code comments

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend proxy.ts with three-tier onboarding gate** - `02cf600` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified
- `src/proxy.ts` - Extended with three-tier gate: Drizzle family_config query, isExempt routing, signOut+redirect for unrecognized emails

## Decisions Made
- Used module-scope `db` export from `@/db` for family_config reads (D-13 clarification: Drizzle db is stateless/safe to reuse; only Supabase client must be created inside handler per D-10)
- Used `user!.email` non-null assertion at tier 3 — at that point unauthenticated requests have already been redirected or returned early, so user is definitively non-null
- DB error handling: allow-through rather than hard lockout (dashboard's own guard handles missing config; transient DB errors should not hard-lock a two-user app)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript TS18047 error — user possibly null at tier 3**
- **Found during:** Task 1 (TypeScript verification)
- **Issue:** TypeScript could not narrow `user` to non-null after the tier 1 guard because of the early-return structure; `user.email` flagged as TS18047
- **Fix:** Added `user!.email` with explanatory comment — at tier 3 the unauthenticated path has already redirected, making user definitively non-null
- **Files modified:** src/proxy.ts
- **Verification:** `npx tsc --noEmit` exits 0 with no errors
- **Committed in:** 02cf600 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — TypeScript narrowing)
**Impact on plan:** Necessary for TypeScript compliance. No scope change.

## Issues Encountered
- Worktree was created before P01 was merged into main; familyConfig table was absent. Resolved by merging main (which includes the P01 merge commit e4cce85) into the worktree branch before starting implementation.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- proxy.ts three-tier gate is complete and ready for production
- P02 (setup wizard RLS policies) and P03 (auth/callback invite flow) complement this gate
- All protected routes now enforce the full onboarding gate automatically

---
*Phase: 13-invite-access-gate*
*Completed: 2026-05-16*

## Self-Check: PASSED
- `src/proxy.ts` exists and contains all required imports and gate logic
- Commit `02cf600` exists in git log
- TypeScript compiles clean (0 errors)
