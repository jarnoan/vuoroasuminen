---
phase: 10-auth-js-removal
fixed_at: 2026-05-15T00:00:00Z
fix_scope: critical_warning
findings_in_scope: 4
fixed: 3
skipped: 1
iteration: 1
status: partial
---

# Phase 10: Code Review Fix Report

**Fixed at:** 2026-05-15T00:00:00Z
**Source review:** .planning/phases/10-auth-js-removal/10-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4
- Fixed: 3
- Skipped: 1

## Fixed Issues

### CR-01: Database pool created at module load before DATABASE_URL is validated

**Files modified:** `src/db/index.ts`
**Commit:** c27da32
**Applied fix:** Added explicit `connectionString` variable and early-throw guard inside `createDb()` before constructing the `Pool`; pool now fails fast on startup if `DATABASE_URL` is absent rather than deferring the error to the first query.

### WR-01: Parent emails absent from REQUIRED_ENV_VARS in src/env.ts

**Files modified:** `src/env.ts`
**Commit:** 456725f
**Applied fix:** Added `"PARENT_FATHER_EMAIL"` and `"PARENT_MOTHER_EMAIL"` to the `REQUIRED_ENV_VARS` array so misconfigured deployments throw a clear startup error instead of silently serving `Forbidden` to all callers.

### WR-02: Non-null assertions on env vars already validated by env.ts

**Files modified:** `src/lib/gcal/client.ts`
**Commit:** 760498c
**Applied fix:** Extracted `clientId` and `clientSecret` locals at the top of `buildGCalClient()` with an explicit `if (!clientId || !clientSecret)` throw guard; replaced all four `process.env.GOOGLE_CLIENT_ID!` / `process.env.GOOGLE_CLIENT_SECRET!` usages with the typed locals (no `!` operator anywhere in the function).

## Skipped Issues

### WR-03: capturedEntryValues null guard missing in Test 2 and Test 8

**File:** `src/actions/schedule.test.ts:167, 277`
**Reason:** Code context differs from review — the recommended fix is already present in the current file. Test 2 (line 165) already has `expect(capturedEntryValues).not.toBeNull()` immediately before the `.map()` access on line 167. Test 8 does not access `capturedEntryValues` at all in its current form; the reviewer's cited line 277 is `expect(r1.success).toBe(true)` with no reference to `capturedEntryValues`. No change needed; tests pass as-is (33/33 green).

---

_Fixed: 2026-05-15T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
