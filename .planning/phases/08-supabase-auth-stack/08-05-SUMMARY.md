---
phase: 08-supabase-auth-stack
plan: "05"
subsystem: auth
tags: [supabase, auth-wiring, server-actions, header, next.js]

# Dependency graph
requires:
  - phase: 08-02
    provides: createSupabaseServerClient helper in src/lib/supabase/server.ts
provides:
  - signOutAction Server Action wired to Supabase signOut + redirect
  - Header component reads authenticated user from Supabase getUser() + user_metadata
  - requireAuthorizedParent() helper uses Supabase getUser() in all schedule Server Actions
affects: [08-06, 08-07, 08-08, phase-09-rls]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "createSupabaseServerClient() + supabase.auth.getUser() as the canonical auth check in Server Components and Server Actions"
    - "user.user_metadata?.full_name and user.user_metadata?.avatar_url for Google identity fields"
    - "redirect('/') after supabase.auth.signOut() in Server Actions — not try/catch wrapping"

key-files:
  created: []
  modified:
    - src/actions/auth.ts
    - src/components/layout/header.tsx
    - src/actions/schedule.ts

key-decisions:
  - "signOutAction function name preserved unchanged — header form action depends on exact name"
  - "redirect('/') placed after signOut() sequentially, never in try/catch — Next.js NEXT_REDIRECT error must propagate"
  - "requireAuthorizedParent() return type renamed from { session, email } to { user, email } — internal only, no callers destructure it"
  - "Fallback chain for header display name: full_name -> email -> 'Käyttäjä' — never renders undefined"

patterns-established:
  - "Pattern: getUser() not getSession() for auth checks — prevents spoofable cookie trust"
  - "Pattern: cast user_metadata fields as string | undefined — metadata is Record<string, any>"

requirements-completed: [SAUTH-02, SAUTH-03]

# Metrics
duration: 12min
completed: 2026-05-10
---

# Phase 8 Plan 05: Auth Wiring (Header + Sign-out + Server Actions) Summary

**Supabase auth wired into header (user_metadata avatar/name), signOutAction (signOut + redirect), and requireAuthorizedParent() helper — all three Auth.js consumers in the running app replaced**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-10T00:00:00Z
- **Completed:** 2026-05-10T00:12:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- `src/actions/auth.ts`: replaced Auth.js `signOut()` with Supabase `supabase.auth.signOut()` + `redirect('/')`, same function name preserved
- `src/components/layout/header.tsx`: replaced `auth()` with `createSupabaseServerClient()` + `getUser()`, reads `user_metadata.full_name` and `user_metadata.avatar_url` from Google OAuth, all visual classes and Finnish copy preserved
- `src/actions/schedule.ts`: replaced `auth()` in `requireAuthorizedParent()` with Supabase `getUser()`, same throw messages and `config.parents` allowlist check preserved, all 7 other Server Actions untouched

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace signOutAction with Supabase signOut + redirect** - `fc302c5` (feat)
2. **Task 2: Replace header auth check with Supabase getUser + user_metadata** - `b55e7df` (feat)
3. **Task 3: Refactor requireAuthorizedParent() to Supabase getUser()** - `432bc64` (feat)

## Files Created/Modified
- `src/actions/auth.ts` - signOutAction now calls supabase.auth.signOut() + redirect('/')
- `src/components/layout/header.tsx` - reads user from Supabase getUser(), renders user_metadata fields
- `src/actions/schedule.ts` - requireAuthorizedParent() uses Supabase getUser() instead of Auth.js auth()

## Decisions Made
- Kept `signOutAction` function name unchanged — the header form `<form action={signOutAction}>` would silently break if renamed
- Placed `redirect('/')` after `await supabase.auth.signOut()` sequentially without try/catch — Next.js NEXT_REDIRECT exception must not be caught
- Renamed return value from `{ session, email }` to `{ user, email }` in the helper — internal only, no callers destructure it
- Added fallback chain `full_name ?? email ?? 'Käyttäjä'` in header — defensive, never renders "undefined"

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors in `src/actions/schedule.ts` (lines 7-8 `@/config/app` module not found, and implicit `any` parameters) were confirmed to exist before this plan's changes via git stash verification. These errors are out of scope for this plan — they affect the `@/config/app` module resolution and are addressed by another plan in Phase 8 (Plan 06). This plan's own code changes introduced zero new TypeScript errors.

## User Setup Required

None - no external service configuration required.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. All changes are replacements of existing auth consumers with equivalent Supabase calls. The threat model in the plan (T-08-05-01 through T-08-05-06) was satisfied:
- Header uses `getUser()` (JWT-verified, not spoofable cookie)
- requireAuthorizedParent() throws "Forbidden" for non-parent emails
- user_metadata fields are rendered inside JSX (React escaping prevents XSS)

## Next Phase Readiness

- All Auth.js consumers in production code paths replaced with Supabase equivalents
- Auth.js still exists in `package.json` and `/api/auth/[...nextauth]/route.ts` but is dormant
- Plans 04 and 06 (running in parallel) cover remaining files (middleware, callback, config)
- After Phase 8 completes: sign-in end-to-end test gate before Phase 9 (RLS enablement)

---
*Phase: 08-supabase-auth-stack*
*Completed: 2026-05-10*
