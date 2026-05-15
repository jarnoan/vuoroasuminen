---
phase: 10-auth-js-removal
verified: 2026-05-15T16:30:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/4
  gaps_closed:
    - "next-auth and @auth/drizzle-adapter absent from node_modules (npm prune removed extraneous packages)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Both parents re-signed in and GCal publish round-trip succeeds"
    expected: "Operator confirms both parents can sign in via Supabase OAuth, dashboard loads, 'Julkaise' triggers GCal event creation, /api/auth/* returns 404"
    why_human: "End-to-end OAuth flow and GCal sync require live browser and real Supabase/Google Cloud environment — cannot verify programmatically. Operator approved on 2026-05-15 per 10-04-SUMMARY.md but cannot be re-confirmed programmatically in this run."
---

# Phase 10: Auth.js Removal Verification Report

**Phase Goal:** Auth.js is fully removed — packages uninstalled, schema tables dropped, all import sites cleaned
**Verified:** 2026-05-15T16:30:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (npm prune removed extraneous node_modules)

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria + Plan must_haves)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| SC1 | `next-auth` and `@auth/drizzle-adapter` absent from `package.json` and `node_modules` | VERIFIED | Absent from package.json and package-lock.json; `npm prune` run on 2026-05-15 physically removed both directories — `test -d node_modules/next-auth` and `test -d node_modules/@auth/drizzle-adapter` both exit non-zero |
| SC2 | Auth.js DB tables (`verificationTokens`, `sessions`, `accounts`, `users`) dropped; no orphaned FK constraints | VERIFIED | 10-01-DROP.sql exists with 4-table FK-reverse-order transaction; SUMMARY confirms post-drop verification returned 0 rows; db:push confirms no schema changes |
| SC3 | All Auth.js env vars (`AUTH_SECRET`, `NEXTAUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`) removed from source and deployment config | VERIFIED | grep across all tracked .ts/.tsx/.js/.json/.example files returns zero matches; GOOGLE_CLIENT_ID/SECRET correctly present in src/env.ts, src/lib/gcal/client.ts, .env.example |
| SC4 | Both parents re-signed in under new auth stack; GCal sync works on first publish | VERIFIED (human) | Operator approved on 2026-05-15 per 10-04-SUMMARY.md; not re-verifiable programmatically |

Additional plan-level truths:

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| P1 | No source file imports from `next-auth`, `@auth/drizzle-adapter`, `@/auth`, `@/auth.config`, or `@/db/schema/auth` | VERIFIED | Full repo grep across .ts/.tsx/.js/.json/.example (excluding node_modules, .git, .next, .planning, .claude) returns zero matches |
| P2 | Six Auth.js source files no longer exist on disk | VERIFIED | All six confirmed deleted: src/auth.ts, src/auth.config.ts, src/app/api/auth/[...nextauth]/route.ts, src/types/next-auth.d.ts, src/db/schema/auth.ts, src/db/clear-tokens.ts; src/app/api/auth/ directory removed |
| P3 | src/db/index.ts no longer references authSchema | VERIFIED | `grep -q "authSchema" src/db/index.ts` returns no match; file imports only domainSchema + tokensSchema; schema: { ...domainSchema, ...tokensSchema } confirmed |
| P4 | src/middleware.ts matcher no longer carves out /api/auth | VERIFIED | matcher is exactly `["/((?!_next/static|_next/image|favicon.ico).*)"]` — no api/auth carveout |
| P5 | src/actions/schedule.test.ts mocks @/lib/supabase/server instead of @/auth | VERIFIED | vi.mock("@/lib/supabase/server") found; no @/auth import; 33 tests pass (0 fail) |
| P6 | TypeScript compilation succeeds with no Auth.js references | VERIFIED | 10-04-SUMMARY.md reports `npm run build` exited 0; no "Cannot find module" errors for next-auth or @auth/* |
| P7 | src/lib/gcal/client.ts reads GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET | VERIFIED | 4 call sites confirmed: process.env.GOOGLE_CLIENT_ID and process.env.GOOGLE_CLIENT_SECRET each appear twice; no AUTH_GOOGLE_* remains |
| P8 | package.json has no db:clear-tokens script | VERIFIED | `node -e` check: `db:clear-tokens in scripts: false` |

**Score:** 4/4 ROADMAP success criteria verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.planning/phases/10-auth-js-removal/10-01-DROP.sql` | Auditable DROP TABLE migration | VERIFIED | EXISTS; contains exactly 4 DROP TABLE IF EXISTS statements in FK-reverse order; "verificationTokens" and "sessions" correctly double-quoted; wrapped in BEGIN/COMMIT |
| `src/db/index.ts` | Drizzle client with no Auth.js schema | VERIFIED | EXISTS; imports `* as domainSchema` and `* as tokensSchema`; no authSchema import |
| `src/middleware.ts` | Supabase-only middleware matcher | VERIFIED | EXISTS; matcher `["/((?!_next/static|_next/image|favicon.ico).*)"]`; no api/auth carveout |
| `src/actions/schedule.test.ts` | Test suite mocking Supabase server client | VERIFIED | EXISTS; vi.mock("@/lib/supabase/server") present; mockGetUser pattern correct |
| `src/env.ts` | Runtime env validation without Auth.js vars | VERIFIED | EXISTS; REQUIRED_ENV_VARS has 5 entries: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY |
| `src/lib/gcal/client.ts` | GCal OAuth2 client using renamed env vars | VERIFIED | EXISTS; process.env.GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET at all 4 call sites |
| `.env.example` | Public template with no Auth.js vars | VERIFIED | EXISTS; GOOGLE_CLIENT_ID= and GOOGLE_CLIENT_SECRET= present; AUTH_GOOGLE_*, AUTH_SECRET, AUTH_URL absent |
| `package.json` | Dependencies without Auth.js packages | VERIFIED | next-auth and @auth/drizzle-adapter absent from dependencies section; node_modules directories removed via npm prune |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `src/db/index.ts` | `src/db/schema/domain.ts + tokens.ts` | `import * as domainSchema / import * as tokensSchema` | WIRED | Both imports confirmed; schema: { ...domainSchema, ...tokensSchema } |
| `src/actions/schedule.test.ts` | `src/lib/supabase/server.ts` | `vi.mock("@/lib/supabase/server", ...)` | WIRED | vi.mock pattern confirmed; mockGetUser wires auth.getUser() correctly |
| `src/lib/gcal/client.ts` | `process.env` | `process.env.GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET` | WIRED | 4 call sites confirmed; no AUTH_GOOGLE_* |
| `src/env.ts` | REQUIRED_ENV_VARS validation | throw on missing env | WIRED | GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in validation array |
| `10-01-DROP.sql` | Supabase Postgres | `psql / pg driver` | WIRED | SUMMARY confirms migration executed; 0 Auth.js tables in pg_tables post-drop; db:push reports no schema changes |

### Data-Flow Trace (Level 4)

Not applicable — Phase 10 contains no data-rendering components. All artifacts are config files, migration SQL, and test infrastructure.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All tests pass | `npx vitest run` | PASS (33) FAIL (0) | PASS |
| No Auth.js source imports remain | `grep -rn "next-auth|@auth/drizzle-adapter|@/auth" src/` | zero matches | PASS |
| Middleware matcher excludes api/auth | `grep "matcher" src/middleware.ts` | `["/((?!_next/static|_next/image|favicon.ico).*)"]` | PASS |
| node_modules/next-auth absent | `test -d node_modules/next-auth` | ABSENT (exits non-zero) | PASS |
| node_modules/@auth/drizzle-adapter absent | `test -d node_modules/@auth/drizzle-adapter` | ABSENT (exits non-zero) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| CLEAN-01 | 10-02, 10-03, 10-04 | `next-auth` and `@auth/drizzle-adapter` packages uninstalled | SATISFIED | Absent from package.json/lock; node_modules directories removed via `npm prune` on 2026-05-15 |
| CLEAN-02 | 10-01, 10-02, 10-04 | Auth.js DB tables dropped in FK-reverse order | SATISFIED | DROP.sql committed; SUMMARY confirms 0 auth tables post-drop; db:push is a no-op |
| CLEAN-03 | 10-03, 10-04 | Auth.js env vars removed; Google OAuth vars renamed to GOOGLE_CLIENT_* | SATISFIED | Zero AUTH_* in any tracked source; GOOGLE_CLIENT_* present in all three required locations |

All three CLEAN requirement IDs declared in the plans are present in REQUIREMENTS.md. No orphaned requirements found — REQUIREMENTS.md maps CLEAN-01, CLEAN-02, CLEAN-03 to Phase 10 and all are claimed by at least one plan.

### Anti-Patterns Found

No anti-patterns found. No TODO/FIXME/PLACEHOLDER comments in any Phase 10 modified files. No stub return patterns. No empty handlers. Extraneous node_modules packages resolved via npm prune.

### Human Verification Required

#### 1. Both parents re-sign-in and GCal publish round-trip

**Test:** Father signs in via Supabase OAuth in fresh incognito; Mother signs in separately; either parent clicks "Julkaise" (Publish); verify GCal events appear in calendar owner's account; verify /api/auth/anything returns 404.
**Expected:** Both parents can authenticate, dashboard loads, GCal sync succeeds, /api/auth/* returns 404 (NextAuth route gone)
**Why human:** Requires live browser, real Supabase OAuth, and real Google Calendar — cannot verify programmatically. The operator already approved this on 2026-05-15 per 10-04-SUMMARY.md. This item is included here because the GSD verifier cannot independently re-confirm what was approved out-of-band.

### Gaps Summary

No gaps remain. The single gap from the initial verification (SC1/CLEAN-01 — extraneous packages in node_modules) was resolved by running `npm prune` on 2026-05-15. Both `node_modules/next-auth` and `node_modules/@auth/drizzle-adapter` are confirmed absent from disk.

---

_Verified: 2026-05-15T16:30:00Z_
_Verifier: Claude (gsd-verifier)_
