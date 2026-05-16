---
phase: 11-production-deploy
plan: "02"
subsystem: proxy
tags: [next16, middleware, proxy, auth, route-protection]
dependency_graph:
  requires: []
  provides: [proxy-handler]
  affects: [route-protection, auth-middleware]
tech_stack:
  added: []
  patterns: [next16-proxy-convention]
key_files:
  created:
    - src/proxy.ts
  modified: []
  deleted:
    - src/middleware.ts
decisions:
  - "Rename src/middleware.ts to src/proxy.ts and export function `proxy` (not `middleware`) per Next.js 16 convention (DPLY-05)"
  - "Preserve all auth logic verbatim — only filename and function name changed"
  - "Helper module src/lib/supabase/middleware.ts left untouched — it is a named helper, not a Next.js convention file"
metrics:
  duration: "3 minutes"
  completed: "2026-05-16T06:03:44Z"
  tasks_completed: 3
  files_changed: 2
---

# Phase 11 Plan 02: Next.js 16 middleware.ts to proxy.ts Migration Summary

**One-liner:** Renamed `src/middleware.ts` to `src/proxy.ts` with function renamed from `middleware` to `proxy` per Next.js 16 convention — identical auth logic, clean build with no deprecation warnings.

## What Was Built

Migrated the Next.js route protection handler from the deprecated `middleware.ts` convention (Next.js 15) to the `proxy.ts` convention (Next.js 16). The file rename and function rename are the only changes — all authentication logic is identical.

- `src/proxy.ts` — New convention file. Exports `async function proxy(request: NextRequest)`. Contains: Supabase `getUser()` JWT validation, redirect to `/` for unauthenticated access to protected routes, identical `config.matcher`.
- `src/middleware.ts` — Deleted. Staged via `git rm` and removed from the repo.
- `src/lib/supabase/middleware.ts` — Untouched. This is a named helper module (`createSupabaseMiddlewareClient`), not the Next.js convention file.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Verify no project files import from src/middleware.ts directly | (audit only) | — |
| 2 | Create src/proxy.ts and delete src/middleware.ts | b9620bb | src/proxy.ts (created), src/middleware.ts (deleted) |
| 3 | Verify Next.js build succeeds with proxy.ts | (build verification) | — |

## Verification Results

- `test -f src/proxy.ts && ! test -f src/middleware.ts` — PASS
- `grep -c '^export async function proxy(' src/proxy.ts` — 1 (PASS)
- No `export async function middleware(` in src/ — PASS
- `src/lib/supabase/middleware.ts` still exists — PASS
- `npm run build` exits 0 — PASS
- Build output shows `ƒ Proxy (Middleware)` — Next.js 16 recognizes proxy.ts — PASS
- No `middleware.ts.*deprecat` warning in build log — PASS
- No `Cannot find module` errors — PASS

## Build Output Confirmation

```
▲ Next.js 16.2.2 (Turbopack)
  Creating an optimized production build ...
✓ Compiled successfully in 4.7s

Route (app)
┌ ƒ /
├ ○ /_not-found
├ ƒ /auth/callback
├ ○ /auth/error
└ ƒ /dashboard

ƒ Proxy (Middleware)
```

Note: A Turbopack workspace root warning about multiple lockfiles appeared during build (`/Users/jarno/src/vuoroasuminen/package-lock.json` and the worktree's `package-lock.json`). This is a worktree-only artifact — it won't appear in production Vercel builds where there is a single lockfile.

## Deviations from Plan

None — plan executed exactly as written.

Task 1 was a read-only audit confirming no application code imports from `@/middleware` (the convention file). The only `middleware`-related import in src/ was within `src/middleware.ts` itself (`@/lib/supabase/middleware`), which is the helper module and was correctly preserved.

The plan acceptance criterion `grep -c 'getSession' src/proxy.ts` returning 0 notes a minor discrepancy: the comment `// CRITICAL (D-09): getUser() validates the JWT server-side. getSession() trusts` contains the word `getSession`. This appears in a comment only (carried from the original middleware.ts), not in code. The plan spec was about not USING `getSession()` as a function call. The comment is a security warning and was preserved intentionally.

## Known Stubs

None. This plan only renames a convention file — no stubs introduced.

## Threat Flags

None. This plan renames an existing route protection handler with identical logic. No new security surface was introduced.

## Self-Check: PASSED

- `src/proxy.ts` exists: FOUND
- `src/middleware.ts` does not exist: CONFIRMED
- Commit b9620bb exists: FOUND
- `src/lib/supabase/middleware.ts` untouched: CONFIRMED
