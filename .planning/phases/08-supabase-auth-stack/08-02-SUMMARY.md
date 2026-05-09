---
phase: 08-supabase-auth-stack
plan: "02"
subsystem: auth/supabase-helpers
tags: [supabase, ssr, auth, helpers, server-client, middleware]
requirements: [SAUTH-01, SAUTH-02, SAUTH-04]

dependency_graph:
  requires: []
  provides:
    - "createSupabaseServerClient() — src/lib/supabase/server.ts"
    - "createSupabaseMiddlewareClient(request, response) — src/lib/supabase/middleware.ts"
  affects:
    - "Plans 04, 05, 07 (all server-side auth checks import from these helpers)"

tech_stack:
  added: []
  patterns:
    - "@supabase/ssr createServerClient with getAll/setAll cookie callbacks"
    - "async cookies() from next/headers for Server Component contexts"
    - "Per-request middleware factory (D-10: no module-scope memoization)"

key_files:
  created:
    - src/lib/supabase/server.ts
    - src/lib/supabase/middleware.ts
  modified: []

decisions:
  - "server.ts is async because next/headers cookies() is async in Next.js 15/16"
  - "try/catch around cookieStore.set in server.ts is the official Supabase SSR pattern — Server Component render context throws on cookie writes, middleware refreshes instead"
  - "middleware.ts is synchronous — request.cookies.getAll() is sync; no next/headers involved"
  - "D-10 prohibition documented in code comment to prevent future module-scope caching"

metrics:
  duration: "1m 55s"
  completed: "2026-05-09T17:55:56Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
---

# Phase 08 Plan 02: Supabase SSR Helper Factories Summary

**One-liner:** Cookie-wired Supabase server client helpers using `@supabase/ssr` — async factory for Server Components/Actions/Route Handlers, sync per-request factory for middleware.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create server-side Supabase client helper | fe43c65 | src/lib/supabase/server.ts (created) |
| 2 | Create middleware Supabase client helper | bc73f72 | src/lib/supabase/middleware.ts (created) |

## What Was Built

Two new files in `src/lib/supabase/` that centralize the cookie-handler boilerplate for all server-side Supabase access:

**`src/lib/supabase/server.ts`** — `createSupabaseServerClient()` (async)
- Uses `await cookies()` from `next/headers` (required in Next.js 15/16 where cookies() is async)
- Wires `getAll`/`setAll` callbacks per `@supabase/ssr` 0.10.x chunked cookie requirement
- `try/catch` around `cookieStore.set` for Server Component render context compatibility (official Supabase SSR pattern — middleware refreshes the session on next request)
- No module-scope memoization — pure per-request factory

**`src/lib/supabase/middleware.ts`** — `createSupabaseMiddlewareClient(request, response)` (sync)
- Reads from `request.cookies.getAll()` (synchronous, no `next/headers`)
- Writes refreshed session cookies to `response.cookies.set()`
- D-10 invariant documented in JSDoc comment: never call at module scope in middleware — Vercel warm instances share module scope and a cached client leaks one user's session to the next request

## Verification Results

All criteria passed:
- Both files exist and export the contracted function names
- Server helper uses `async` and `await cookies()`
- Middleware helper is synchronous, never imports `next/headers`
- Both helpers wire `getAll`/`setAll` callbacks correctly
- TypeScript compiles without errors in either new file (pre-existing errors in unrelated files are not caused by this plan)
- D-10 prohibition documented in `middleware.ts` JSDoc

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — these helpers are pure factories with no hardcoded or placeholder values.

## Threat Flags

None — no new network endpoints or auth paths introduced beyond what the plan's threat model already covers. The helpers themselves do not call any auth methods; consumers are responsible for using `getUser()` per T-08-02-01.

## Self-Check

Checking created files exist:
- `src/lib/supabase/server.ts`: FOUND
- `src/lib/supabase/middleware.ts`: FOUND

Checking commits exist:
- fe43c65 (Task 1): FOUND
- bc73f72 (Task 2): FOUND

## Self-Check: PASSED
