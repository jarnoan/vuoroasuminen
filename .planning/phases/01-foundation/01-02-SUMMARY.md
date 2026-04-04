---
phase: 01-foundation
plan: 02
subsystem: auth
tags: [auth.js, google-oauth, next.js, drizzle, refresh-token, shell-ui]

# Dependency graph
requires:
  - 01-01 (Next.js project, Drizzle schema, DB client, shadcn/ui Button)
provides:
  - Auth.js v5 split config (auth.config.ts edge-safe + auth.ts with DrizzleAdapter)
  - Google OAuth sign-in/sign-out flow with Calendar scope
  - JWT session strategy with refresh token rotation
  - Route protection middleware (edge-compatible)
  - Shell UI: sign-in page, dashboard with header (avatar + sign-out)
affects: [02-schedule-grid, 03-draft-publish, 04-gcal-sync]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Split Auth.js config: auth.config.ts (no adapter, edge-safe) + auth.ts (full DrizzleAdapter)"
    - "JWT session strategy WITH DrizzleAdapter — adapter persists OAuth tokens to accounts table despite JWT cookies"
    - "Refresh token rotation: jwt callback fetches new tokens from oauth2.googleapis.com/token on expiry"
    - "Server Actions for signIn/signOut in form elements (no client JS needed)"
    - "Middleware imports auth.config ONLY — never auth.ts — to avoid pg TCP socket crash on edge"

key-files:
  created:
    - src/auth.config.ts
    - src/auth.ts
    - src/middleware.ts
    - src/app/api/auth/[...nextauth]/route.ts
    - src/types/next-auth.d.ts
    - src/components/layout/header.tsx
    - src/app/dashboard/page.tsx
  modified:
    - src/app/page.tsx
    - src/app/layout.tsx
    - next.config.ts

key-decisions:
  - "Split config pattern: auth.config.ts has NO DB imports; auth.ts has DrizzleAdapter — middleware must use auth.config to run on edge"
  - "JWT strategy with DrizzleAdapter: JWT in cookie for edge-compatible middleware; OAuth tokens still persisted to accounts table for GCal Phase 4"
  - "prompt: consent + access_type: offline in Google provider auth params — forces refresh_token on every sign-in (Pitfall 2)"
  - "Header is a Server Component (async) — calls auth() directly, no SessionProvider or client state needed"
  - "Sign-in page redirects to /dashboard if already authenticated — prevents authenticated users from seeing the landing page"

# Metrics
duration: 2min
completed: 2026-04-04
---

# Phase 01 Plan 02: Google OAuth + Auth Shell Summary

**Auth.js v5 Google OAuth with Calendar scope, refresh token rotation, edge-safe middleware, and shell UI (sign-in page + header with avatar/sign-out)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-04T15:44:41Z
- **Completed:** 2026-04-04T15:46:27Z
- **Tasks:** 2 of 3 automated (Task 3 is human verification checkpoint)
- **Files modified:** 10

## Accomplishments

- Auth.js v5 split config: edge-safe `auth.config.ts` (Google provider with Calendar scope, `prompt: "consent"`, `access_type: "offline"`) and full `auth.ts` (DrizzleAdapter + JWT strategy + refresh token rotation)
- Middleware route protection using auth.config only — prevents edge runtime crash from pg TCP sockets (Pitfall 1 from research)
- Refresh token rotation in `jwt` callback: fetches new access token from Google when expired, falls back to `RefreshTokenError` in session on failure
- TypeScript augmentation in `types/next-auth.d.ts` for `Session.error` and JWT token fields
- Shell UI: sign-in page (`/`) with Google OAuth button, redirects to `/dashboard` if signed in
- Header Server Component with Google profile picture (via `next/image`), user name, and sign-out button
- Dashboard page with "Schedule coming soon" placeholder (D-05)
- `next.config.ts` updated with `remotePatterns` for `lh3.googleusercontent.com`

## Task Commits

1. **Task 1: Auth.js split config** — `a44344b` (feat)
2. **Task 2: Shell UI** — `37bb71f` (feat)
3. **Task 3: Human verification** — pending (checkpoint, not automated)

## Files Created/Modified

- `src/auth.config.ts` — Edge-safe Google provider config with Calendar scope
- `src/auth.ts` — Full Auth.js config with DrizzleAdapter, JWT strategy, refresh token rotation
- `src/middleware.ts` — Route protection, imports auth.config (NOT auth.ts), redirects unauthenticated to /
- `src/app/api/auth/[...nextauth]/route.ts` — NextAuth GET/POST route handler
- `src/types/next-auth.d.ts` — Session.error and JWT token field augmentation
- `src/components/layout/header.tsx` — Server Component: app name, Google profile picture, user name, sign-out
- `src/app/dashboard/page.tsx` — Post-auth landing with Header and placeholder
- `src/app/page.tsx` — Sign-in page, redirects to /dashboard if authenticated
- `src/app/layout.tsx` — Updated title/description metadata
- `next.config.ts` — Added remotePatterns for Google profile images

## Decisions Made

- Used `session: { strategy: "jwt" }` WITH DrizzleAdapter — JWT in cookie keeps middleware edge-compatible while adapter still writes OAuth tokens to `accounts` table (required for Phase 4 GCal sync)
- Included `prompt: "consent"` and `access_type: "offline"` in Google provider params — forces Google to re-issue refresh_token on every sign-in, preventing Pitfall 2 (no refresh token after first login)
- Middleware imports `./auth.config` not `@/auth` — critical for edge runtime compatibility (Pitfall 1)
- Header as Server Component with `auth()` call — no SessionProvider, no client JS, no hydration overhead

## Deviations from Plan

None - plan executed exactly as written. Both tasks implement the exact code specified in the plan.

## User Setup Required

Before testing the OAuth flow (Task 3 checkpoint), the developer must complete:

**Supabase:**
1. Create a Supabase project at supabase.com (free tier)
2. Add to `.env.local`: `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Run `npm run db:push` to create tables
4. Run `npm run db:seed` to insert children records

**Google Cloud:**
5. Create a Google Cloud project with OAuth 2.0 credentials (Web application type)
6. Add to `.env.local`: `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
7. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
8. Enable Google Calendar API
9. Add both parent emails as test users on the OAuth consent screen

**Auth.js:**
10. Generate `AUTH_SECRET`: `npx auth secret` and add to `.env.local`

**Then test:**
- `npm run dev` → visit http://localhost:3000
- Verify sign-in flow, Calendar scope consent, session persistence, sign-out, middleware redirect

## Known Stubs

- `src/app/dashboard/page.tsx` — "Schedule coming soon" placeholder (intentional; Phase 2 will replace with schedule grid)

## Self-Check: PASSED

All files exist and all commits verified:
- src/auth.config.ts — FOUND
- src/auth.ts — FOUND
- src/middleware.ts — FOUND
- src/app/api/auth/[...nextauth]/route.ts — FOUND
- src/types/next-auth.d.ts — FOUND
- src/components/layout/header.tsx — FOUND
- src/app/dashboard/page.tsx — FOUND
- Commit a44344b — FOUND
- Commit 37bb71f — FOUND
