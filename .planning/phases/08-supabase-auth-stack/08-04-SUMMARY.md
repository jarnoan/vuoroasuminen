---
phase: 08-supabase-auth-stack
plan: 04
subsystem: auth
tags: [supabase, oauth, pkce, google, middleware, callback, nextjs, typescript]

requires:
  - phase: 08-supabase-auth-stack/08-01
    provides: user_google_tokens schema (PgTable with email PK, refreshToken, updatedAt)
  - phase: 08-supabase-auth-stack/08-02
    provides: createSupabaseServerClient, createSupabaseMiddlewareClient helpers
  - phase: 08-supabase-auth-stack/08-03
    provides: user_google_tokens table created in Supabase DB

provides:
  - Supabase PKCE Google OAuth sign-in flow (button -> Supabase Auth -> Google -> /auth/callback)
  - /auth/callback route that exchanges PKCE code, captures provider_refresh_token, upserts user_google_tokens
  - /auth/error page (Finnish) with re-auth CTA using same OAuth params
  - Middleware using supabase.auth.getUser() for route protection (no getSession)
  - Home page redirecting authenticated Supabase users to /dashboard

affects:
  - 08-05 (auth wiring: requireAuthorizedParent reads Supabase session)
  - 08-06 (gcal sync: reads user_google_tokens written by callback)
  - 10 (Auth.js removal: middleware and sign-in button already on Supabase path)

tech-stack:
  added: []
  patterns:
    - "PKCE OAuth callback: build NextResponse.redirect BEFORE createServerClient so setAll writes to the same response object"
    - "Middleware: createSupabaseMiddlewareClient called INSIDE handler (never module scope) to prevent session leakage on Vercel warm instances"
    - "Route protection: supabase.auth.getUser() (JWT server-validated) not getSession() (spoofable cookie)"
    - "signInWithOAuth: scopes as space-joined string in options.scopes, access_type+prompt in options.queryParams"

key-files:
  created:
    - src/app/auth/callback/route.ts
    - src/app/auth/error/page.tsx
  modified:
    - src/middleware.ts
    - src/app/page.tsx
    - src/components/sign-in-button.tsx

key-decisions:
  - "Callback route uses inline createServerClient (not Plan 02 server helper) — route handler must wire cookies to request/response pair for Pitfall 3 fix"
  - "provider_refresh_token captured EXACTLY ONCE in exchangeCodeForSession — null token redirects to /auth/error (SAUTH-06)"
  - "Middleware matcher excludes api/auth (not all api/*) to preserve Auth.js [...nextauth] route during Phase 8 coexistence"
  - "getSession comment in middleware.ts documents why it is forbidden (D-09) — only appears in comment, not actual code"

patterns-established:
  - "PKCE response-before-client: const response = NextResponse.redirect(...) then const supabase = createServerClient(...) — order is non-negotiable"
  - "Per-request supabase client in middleware: createSupabaseMiddlewareClient(request, response) inside function body only"
  - "OAuth params invariant: openid + userinfo.email + userinfo.profile + calendar scopes, access_type:offline, prompt:consent — identical in sign-in button and error page CTA"

requirements-completed: [SAUTH-01, SAUTH-02, SAUTH-04, SAUTH-05, SAUTH-06]

duration: 3min
completed: 2026-05-10
---

# Phase 08 Plan 04: Supabase OAuth Flow Summary

**Supabase PKCE Google OAuth flow wired end-to-end: sign-in button → /auth/callback token capture → user_google_tokens upsert → /dashboard, with Supabase getUser() middleware guard and Finnish /auth/error re-auth page**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-10T05:46:39Z
- **Completed:** 2026-05-10T05:49:58Z
- **Tasks:** 5
- **Files modified:** 5

## Accomplishments

- Replaced Auth.js middleware with Supabase `getUser()` per-request route guard — session cookies refresh on every request, spoofed cookies rejected via JWT server validation
- Created `/auth/callback` PKCE route that captures `provider_refresh_token` (available only once during `exchangeCodeForSession`) and upserts `user_google_tokens` keyed on email; three distinct error redirects cover all failure modes (SAUTH-06)
- Replaced Auth.js `signIn()` and home page `auth()` calls with Supabase equivalents; OAuth params (Calendar scope + offline + consent) match the v1.0 Auth.js config verbatim (SAUTH-05)

## Task Commits

1. **Task 1: Replace middleware with Supabase getUser() guard** - `eb21252` (feat)
2. **Task 2: Create OAuth callback route with token capture** - `6e7b871` (feat)
3. **Task 3: Create Finnish error page with re-auth CTA** - `01f3792` (feat)
4. **Task 4: Replace home page auth check with Supabase getUser()** - `8951443` (feat)
5. **Task 5: Replace SignInButton with Supabase signInWithOAuth** - `3099743` (feat)

## Files Created/Modified

- `src/middleware.ts` - Supabase getUser() route guard; allows /, /auth/*, /api/auth/*; per-request client; returns supabase-augmented response
- `src/app/auth/callback/route.ts` - PKCE exchangeCodeForSession; three /auth/error redirects; user_google_tokens upsert via Drizzle onConflictDoUpdate
- `src/app/auth/error/page.tsx` - Finnish error page (client component); createBrowserClient from @supabase/ssr; identical OAuth params to sign-in button
- `src/app/page.tsx` - Replaced auth() with createSupabaseServerClient() + getUser(); redirects authenticated users to /dashboard; JSX unchanged
- `src/components/sign-in-button.tsx` - Replaced next-auth/react signIn with signInWithOAuth; createBrowserClient per click; Calendar scope + offline + consent

## Decisions Made

- Callback route uses inline `createServerClient` (not the Plan 02 `createSupabaseServerClient` server helper) because route handlers need request/response cookie wiring for Pitfall 3 — the server helper uses `next/headers cookies()` which writes to a different cookie store
- `getSession` appears only in a comment in middleware.ts documenting the D-09 security constraint; no actual `getSession()` call exists
- Auth.js stays installed and its `/api/auth/*` route remains accessible via the matcher exclusion until Phase 10 removes it

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- TypeScript check (`npx tsc --noEmit`) showed 31 pre-existing errors in unrelated files (missing `@/config/app` module, implicit any types in schedule actions). None in plan files. These are out-of-scope deferred items.
- `grep -q 'getSession' src/middleware.ts` technically matches a comment line. Verified that `getSession` appears only in a comment explaining why it is forbidden — no actual function call exists.

## Next Phase Readiness

- Plan 05 (auth wiring: `requireAuthorizedParent`) can proceed — Supabase session established via `/auth/callback`
- Plan 06 (GCal sync) can proceed — `user_google_tokens` written by callback route
- End-to-end smoke test deferred to Plan 08 GATE (manual: click sign-in → Google consent → /auth/callback → user_google_tokens row → /dashboard)

---
*Phase: 08-supabase-auth-stack*
*Completed: 2026-05-10*
