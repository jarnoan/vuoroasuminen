---
phase: 10-auth-js-removal
reviewed: 2026-05-15T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - .env.example
  - package.json
  - src/actions/schedule.test.ts
  - src/db/index.ts
  - src/env.ts
  - src/lib/gcal/client.ts
  - src/middleware.ts
  - vitest.config.ts
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-05-15T00:00:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Phase 10 removes Auth.js and replaces session management entirely with Supabase Auth. The middleware, server actions, and GCal token flow have been updated accordingly. The changes are clean and well-structured. One critical issue exists: `src/db/index.ts` creates the database pool unconditionally at module load time without a `DATABASE_URL` guard, which causes a silent bad pool on import (e.g., during tests or cold CI runs before env is wired). Three warnings address: non-null assertion operator overuse in `src/lib/gcal/client.ts` where `env.ts` already validates the values, missing `PARENT_FATHER_EMAIL` / `PARENT_MOTHER_EMAIL` from the `REQUIRED_ENV_VARS` list in `src/env.ts`, and a test-reliability gap in `schedule.test.ts` where `capturedEntryValues` can be `null` when assertions are reached in some failure paths. Two info items note a stale `date-fns` version constraint in `package.json` and a missing `@vitejs/plugin-react` usage in `vitest.config.ts`.

---

## Critical Issues

### CR-01: Database pool created at module load before `DATABASE_URL` is validated

**File:** `src/db/index.ts:6-16`
**Issue:** `createDb()` is called at the top level (line 16: `export const db = createDb()`). Inside, `new Pool({ connectionString: process.env.DATABASE_URL })` executes immediately on import. If `DATABASE_URL` is undefined (e.g., imported in a test file before `src/env.ts` is loaded, or during a cold CI build step that runs `tsc` without env), the pool is constructed with `connectionString: undefined`. This does not throw at pool creation time — `pg` defers the error until the first query, giving no signal at startup that the configuration is broken. The current test suite works because `vitest.config.ts` injects other env vars but NOT `DATABASE_URL`, so any test that exercises a real query path (bypassing the vi.mock) would silently use a misconfigured pool.

**Fix:** Guard pool creation and fail fast:
```typescript
function createDb() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Cannot initialise database connection."
    )
  }
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  })
  return drizzle(pool, {
    schema: { ...domainSchema, ...tokensSchema },
  })
}
```

---

## Warnings

### WR-01: Parent emails absent from `REQUIRED_ENV_VARS` in `src/env.ts`

**File:** `src/env.ts:5-11`
**Issue:** `PARENT_FATHER_EMAIL` and `PARENT_MOTHER_EMAIL` are runtime-required for the authorization check inside `src/actions/schedule.ts` (they are the values compared against the authenticated user's email to decide whether to throw `Forbidden`). They are not in the `REQUIRED_ENV_VARS` list, so a misconfigured deployment silently falls through with empty strings — every caller gets a `Forbidden` error rather than a clear startup failure.
**Fix:** Add the two parent email vars to the validation list:
```typescript
const REQUIRED_ENV_VARS = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "PARENT_FATHER_EMAIL",
  "PARENT_MOTHER_EMAIL",
] as const
```

### WR-02: Non-null assertions on env vars already validated by `env.ts`

**File:** `src/lib/gcal/client.ts:50-51, 73-74`
**Issue:** `process.env.GOOGLE_CLIENT_ID!` and `process.env.GOOGLE_CLIENT_SECRET!` appear four times with the non-null assertion operator. While `src/env.ts` validates these at startup, the `!` operator silently suppresses TypeScript's undefined warning and masks the risk that `client.ts` could be called in a context where `env.ts` was not imported first (e.g., a future unit test or a standalone script). The values should be read once at the top of the function with an explicit guard, or `src/env.ts` should export typed constants instead of relying on side-effect validation.

**Fix:** Read and validate at call site:
```typescript
const clientId = process.env.GOOGLE_CLIENT_ID
const clientSecret = process.env.GOOGLE_CLIENT_SECRET
if (!clientId || !clientSecret) {
  throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set")
}
// then use clientId / clientSecret (never !) throughout the rest of the function
```

### WR-03: `capturedEntryValues` may be `null` when assertions run in Test 2 and Test 8

**File:** `src/actions/schedule.test.ts:167, 277`
**Issue:** In Test 2 (line 167) and Test 8 (line 277), the code accesses `capturedEntryValues!` after checking `capturedEntryValues` is not null only implicitly (no `expect(capturedEntryValues).not.toBeNull()` before the assertion). In Test 2 specifically, there is no null guard at all before `capturedEntryValues!.map(...)` (line 167). If `extendSchedule` returns early before reaching the entries insert (e.g., due to a future code change in the schedule action), the test would throw a runtime error rather than a meaningful assertion failure, making debugging harder.

**Fix:** Add the same null guard used in Test 1:
```typescript
// Test 2 — after the result assertion:
expect(capturedEntryValues).not.toBeNull()
const days = [...new Set(capturedEntryValues!.map(r => r.day))].sort()

// Test 8 — similarly guard before accessing capturedEntryValues:
expect(capturedEntryValues).not.toBeNull()
```

---

## Info

### IN-01: `date-fns` version in `package.json` is `^4.1.0`, not `^3.x` as documented

**File:** `package.json:28`
**Issue:** `CLAUDE.md` (stack table) documents `date-fns` at `3.x`. The installed version constraint is `^4.1.0`. This is not a bug — date-fns v4 is a valid upgrade — but the stack documentation is now stale. This is a minor documentation drift, not a runtime issue.
**Fix:** Update the stack table in `CLAUDE.md` to reflect `date-fns 4.x`, or pin to `^3.x` if v4 compatibility has not been tested.

### IN-02: `@vitejs/plugin-react` listed in `devDependencies` but not used in `vitest.config.ts`

**File:** `package.json:43` / `vitest.config.ts`
**Issue:** `@vitejs/plugin-react` is installed as a dev dependency but `vitest.config.ts` does not include a `plugins: [react()]` call. In a Node-environment test suite with no JSX transformation needed (current test files are plain TypeScript), this is harmless. However, if a future test imports a React component, the transform will silently fail without the plugin being registered.
**Fix:** Either add the plugin to `vitest.config.ts` now (`plugins: [react()]` from `@vitejs/plugin-react`), or remove the dev dependency to keep the lockfile lean.

---

_Reviewed: 2026-05-15T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
