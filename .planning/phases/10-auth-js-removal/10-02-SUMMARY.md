---
phase: 10-auth-js-removal
plan: "02"
subsystem: auth-removal
tags: [auth-removal, cleanup, typescript, vitest]

requires:
  - phase: 10-auth-js-removal
    plan: "01"
    provides: Auth.js DB tables dropped (users, accounts, sessions, verificationTokens)

provides:
  - "Six Auth.js source files deleted from the working tree"
  - "src/db/index.ts: authSchema import removed; only domainSchema + tokensSchema remain"
  - "src/middleware.ts: api/auth matcher carveout removed; stale Pitfall 4 comment deleted"
  - "src/actions/schedule.test.ts: mocks @/lib/supabase/server instead of @/auth; all 11 tests pass"
  - "Zero grep hits for next-auth|@auth/drizzle-adapter|@/auth|schema/auth in src/"

affects:
  - 10-03-package-uninstall
  - 10-04-supabase-auth

tech-stack:
  added: []
  patterns:
    - "Test session helpers return Supabase auth.getUser() shape: { data: { user: { email } | null }, error: null }"
    - "mockGetUser = vi.fn() used as the Supabase auth.getUser mock in schedule.test.ts"

key-files:
  created: []
  deleted:
    - "src/auth.ts"
    - "src/auth.config.ts"
    - "src/app/api/auth/[...nextauth]/route.ts"
    - "src/types/next-auth.d.ts"
    - "src/db/schema/auth.ts"
    - "src/db/clear-tokens.ts"
  modified:
    - path: "src/db/index.ts"
      diff: "Removed `import * as authSchema from './schema/auth'` and `...authSchema` from schema spread"
    - path: "src/middleware.ts"
      diff: "Removed `api/auth|` from matcher regex; deleted Pitfall 4 comment"
    - path: "src/actions/schedule.test.ts"
      diff: "Replaced vi.mock('@/auth') + mockAuth helpers with vi.mock('@/lib/supabase/server') + mockGetUser returning Supabase auth.getUser() shape"

key-decisions:
  - "Pre-existing TypeScript errors (@/config/app not found, implicit any) are out-of-scope — they precede this plan and are not introduced by Auth.js removal"
  - "Comment in schedule.test.ts header updated to avoid false-positive in grep '@/auth' acceptance check"

requirements-completed:
  - CLEAN-01
  - CLEAN-02

duration: 3min
completed: "2026-05-15"
---

# Phase 10 Plan 02: Auth.js Source File Deletion Summary

**Six Auth.js source files deleted, three consumers updated (db/index.ts, middleware.ts, schedule.test.ts), and all 11 vitest tests pass with zero Auth.js references remaining in src/**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-15T02:47:48Z
- **Completed:** 2026-05-15T02:51:35Z
- **Tasks:** 3
- **Files modified:** 3 (+ 6 deleted)

## Accomplishments

### Task 1: Delete six Auth.js source files
Deleted all six Auth.js files and the `src/app/api/auth/` directory tree:
- `src/auth.ts` — NextAuth config + DrizzleAdapter + token refresh callbacks
- `src/auth.config.ts` — NextAuthConfig with Google provider
- `src/app/api/auth/[...nextauth]/route.ts` — NextAuth route handler
- `src/types/next-auth.d.ts` — module augmentations for next-auth JWT/Session
- `src/db/schema/auth.ts` — Drizzle schema for users/accounts/sessions/verificationTokens
- `src/db/clear-tokens.ts` — orphaned script that deleted from accounts/sessions
- Directories `src/app/api/auth/[...nextauth]/` and `src/app/api/auth/` removed via `rmdir`

### Task 2: Clean consumers (db/index.ts, middleware.ts)
- `src/db/index.ts`: removed `import * as authSchema from "./schema/auth"` and `...authSchema` from the `schema:` spread — only `domainSchema` and `tokensSchema` remain
- `src/middleware.ts`: removed `api/auth|` from the matcher regex and deleted the stale "Pitfall 4" comment that referenced Phase 8 Auth.js coexistence

### Task 3: Migrate schedule.test.ts to Supabase mock
- Replaced `vi.mock("@/auth", ...)` with `vi.mock("@/lib/supabase/server", ...)`
- Replaced `mockAuth` + Auth.js session shape with `mockGetUser` + Supabase `auth.getUser()` shape `{ data: { user: { email } | null }, error: null }`
- All three session helpers (`setAuthorizedSession`, `setNoSession`, `setUnauthorizedSession`) updated
- 11 tests pass (plan anticipated 10; actual count is 11)

## Task Commits

1. **Task 1: Delete six Auth.js source files** - `70fe113`
2. **Task 2: Remove Auth.js references from db/index.ts and middleware.ts** - `09ecfec`
3. **Task 3: Migrate schedule.test.ts mock to Supabase** - `e5eed67`

## Verification Results

```
grep -rn "next-auth|@auth/drizzle-adapter|@/auth|schema/auth" src/
(no output — CLEAN)

npx vitest run
Test Files  4 passed (4)
Tests  33 passed (33)

middleware matcher:
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
```

## Files Deleted

- `src/auth.ts`
- `src/auth.config.ts`
- `src/app/api/auth/[...nextauth]/route.ts`
- `src/types/next-auth.d.ts`
- `src/db/schema/auth.ts`
- `src/db/clear-tokens.ts`

## Files Modified

- `src/db/index.ts` — removed authSchema import + schema spread entry
- `src/middleware.ts` — removed api/auth carveout from matcher regex + stale comment
- `src/actions/schedule.test.ts` — switched mock from @/auth to @/lib/supabase/server

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Comment in schedule.test.ts header triggered false-positive grep check**
- **Found during:** Task 3 verification
- **Issue:** The plan's specified header comment text included the literal string `@/auth in Phase 10` (as documentation). This caused `grep -q '@/auth'` to return non-zero, failing the acceptance check.
- **Fix:** Changed the comment from "replaces @/auth in Phase 10" to "Auth.js mock removed in Phase 10" — functionally identical meaning, no false positive.
- **Files modified:** `src/actions/schedule.test.ts`
- **Commit:** `e5eed67` (included in Task 3 commit)

### Pre-existing Issues (Out of Scope)

TypeScript compilation (`npx tsc --noEmit`) exits with errors in unrelated files:
- `@/config/app` module not found (multiple files) — pre-existing, not caused by this plan
- Implicit `any` type errors in schedule.ts, queries.ts, gcal/sync.ts — pre-existing

None of these errors are Auth.js related. Zero tsc errors mention next-auth, @auth/drizzle-adapter, @/auth, or schema/auth. These pre-existing issues are logged here for awareness; Plan 04's build task will determine if they block the full build.

## Known Stubs

None. All three modified files are fully wired with real implementations.

## Threat Flags

No new network endpoints, auth paths, or schema changes introduced by this plan's changes. Threat model items T-10-08 (middleware matcher misconfiguration) and T-10-09 (empty api/auth directory left behind) are both fully mitigated:
- Matcher is exactly `["/((?!_next/static|_next/image|favicon.ico).*)"]` (verified by grep)
- `src/app/api/auth/` directory confirmed non-existent (verified by `test -d`)

## Self-Check

```
src/auth.ts: MISSING (deleted — correct)
src/auth.config.ts: MISSING (deleted — correct)
src/db/schema/auth.ts: MISSING (deleted — correct)
src/db/clear-tokens.ts: MISSING (deleted — correct)
src/app/api/auth/ directory: MISSING (removed — correct)
src/db/index.ts: EXISTS (modified — correct)
src/middleware.ts: EXISTS (modified — correct)
src/actions/schedule.test.ts: EXISTS (modified — correct)

Commits:
70fe113 — FOUND
09ecfec — FOUND
e5eed67 — FOUND
```

## Self-Check: PASSED

---
*Phase: 10-auth-js-removal*
*Completed: 2026-05-15*
