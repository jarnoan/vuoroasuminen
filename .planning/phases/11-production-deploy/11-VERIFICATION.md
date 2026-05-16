---
phase: 11-production-deploy
verified: 2026-05-16T10:45:00Z
status: human_needed
score: 4/5 must-haves verified
overrides_applied: 0
re_verification: false
human_verification:
  - test: "Confirm both parents (father and mother accounts) can sign in with Google on https://vuoroasuminen.vercel.app, reach the schedule view, and that no redirect_uri_mismatch or Supabase redirect-allowlist errors occur"
    expected: "Both parents land on the schedule view after Google OAuth without any OAuth or Supabase redirect errors"
    why_human: "End-to-end OAuth flow requires a real browser, real Google accounts, and live Supabase/Google Cloud Console state — cannot be verified programmatically"
---

# Phase 11: Production Deploy Verification Report

**Phase Goal:** Deploy the app to Vercel production so both parents can sign in with Google on a public URL, with all OAuth and Supabase Auth configuration correct.
**Verified:** 2026-05-16T10:45:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Visiting the production URL loads the app (Vercel auto-deploys from main branch) | VERIFIED | `curl -sI https://vuoroasuminen.vercel.app` returns HTTP 200. `.vercel/project.json` confirms projectId `prj_g67bSccUpUtIKGZNjnYDPVQUh0X6` linked to `vuoroasuminen`. 11-03-SUMMARY.md documents successful deploy. |
| 2 | Both parents can sign in with Google on the production domain without OAuth errors | NEEDS HUMAN | 11-03-SUMMARY.md states "Both parents (father + mother) completed end-to-end Google sign-in on production URL" — SUMMARY cannot be trusted without independent verification. External service state (Google Cloud Console redirect URIs, Supabase Auth allowlist) is not programmatically checkable. |
| 3 | Supabase Auth accepts the production callback URL and issues a valid session | NEEDS HUMAN | Depends on Supabase Dashboard URL Configuration (Site URL + Redirect URLs). No programmatic read API available to verify these settings. 11-03-SUMMARY.md claims they are configured. Human confirmation required. |
| 4 | Running the build with a missing required env var exits with a non-zero status and a clear error message | VERIFIED | `generate-app-config.js` contains `process.exit(1)` with `FATAL: missing required env vars` message. No `process.exit(0)` exists. Behavioral spot-check (simulated from /tmp with no .env.local) confirmed exit code 1 and FATAL message output. |
| 5 | Next.js build completes without middleware-related errors (middleware.ts renamed to proxy.ts per Next.js 16 requirement) | VERIFIED | `src/proxy.ts` exists with `export async function proxy(request: NextRequest)`. `src/middleware.ts` is absent. 11-02-SUMMARY.md documents build output: `ƒ Proxy (Middleware)` — Next.js 16 recognized the convention file. No deprecation warnings in build log. |

**Score:** 3/5 truths fully verified (2 require human confirmation — truths 2 and 3)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/generate-app-config.js` | Build-time config generator that fails fast on missing env vars and loads .env.local for local builds | VERIFIED | Contains `require("dotenv").config({ path: path.join(__dirname, "../.env.local") })` at line 16. Contains `process.exit(1)` at line 34 with FATAL message. No `process.exit(0)` present. All required vars in `required[]` array including APP_CHILDREN. |
| `.env.example` | Reference documentation for every env var that production deploy requires | VERIFIED | Documents all 13 vars required by generate-app-config.js (`PARENT_FATHER_EMAIL`, `PARENT_FATHER_CALENDAR_ID`, `PARENT_MOTHER_EMAIL`, `PARENT_MOTHER_CALENDAR_ID`, `APP_CHILDREN`, `APP_START_DATE`, `APP_FIRST_PARENT`, `APP_CALENDAR_OWNER_EMAIL`) plus `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `PARENT_FATHER_NAME`, `PARENT_MOTHER_NAME`. |
| `package.json` | Direct devDependency on dotenv | VERIFIED | `devDependencies` contains `"dotenv": "^17.4.2"`. |
| `src/proxy.ts` | Next.js 16 proxy handler — replaces deprecated middleware.ts convention | VERIFIED | `export async function proxy(request: NextRequest)` at line 5. Imports `createSupabaseMiddlewareClient` (line 3, used at line 9). Uses `supabase.auth.getUser()` (line 15). No `getSession()` calls. Redirect logic and `config.matcher` preserved. |
| `src/middleware.ts` | MUST NOT EXIST — file renamed away | VERIFIED | File is absent. Confirmed by `test -f src/middleware.ts` → false. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `scripts/generate-app-config.js` | `.env.local` | `require("dotenv").config({ path: path.join(__dirname, "../.env.local") })` | WIRED | Pattern present at line 16. |
| `package.json build script` | `scripts/generate-app-config.js` | `node scripts/generate-app-config.js && next build` | WIRED | Build script confirmed in package.json. |
| `src/proxy.ts` | `src/lib/supabase/middleware.ts` | `import { createSupabaseMiddlewareClient } from "@/lib/supabase/middleware"` | WIRED | Import at line 3, usage at line 9. Helper module confirmed present at `src/lib/supabase/middleware.ts`. |
| Google Cloud Console OAuth client | Supabase auth server callback | Authorized redirect URIs entry | NEEDS HUMAN | No programmatic read API. 11-03-SUMMARY.md states it was configured. |
| Supabase Auth Site URL setting | https://vuoroasuminen.vercel.app | Supabase Dashboard URL Configuration | NEEDS HUMAN | No programmatic read API. 11-03-SUMMARY.md states it was configured. |
| Vercel production env vars | Build-time generate-app-config.js + runtime Supabase/Drizzle | `vercel env add ... production` | PARTIAL — cannot verify live values | 11-03-SUMMARY.md states 15 vars were set. `curl -sI https://vuoroasuminen.vercel.app` returning HTTP 200 is indirect evidence the build succeeded with env vars present. |

### Data-Flow Trace (Level 4)

Not applicable for this phase. Plans 01 and 02 modified build infrastructure (scripts, convention file renaming) — no components that render dynamic data were added or changed.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Build exits 1 with FATAL message when env vars missing | `node generate-app-config.js` from dir with no `.env.local` | Exit code 1, printed `generate-app-config: FATAL: missing required env vars: PARENT_FATHER_EMAIL, ...` | PASS |
| Production URL returns HTTP 200 | `curl -sI https://vuoroasuminen.vercel.app` | HTTP/2 200 | PASS |
| proxy.ts exports `proxy` function (not `middleware`) | `grep '^export async function proxy' src/proxy.ts` | 1 match | PASS |
| middleware.ts is absent | `test -f src/middleware.ts` | false (absent) | PASS |
| dotenv in devDependencies | `package.json devDependencies.dotenv` | `^17.4.2` | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DPLY-01 | 11-03-PLAN.md | User can access the app at a stable production URL | VERIFIED | `curl -sI https://vuoroasuminen.vercel.app` returns HTTP 200; `.vercel/project.json` confirms project link |
| DPLY-02 | 11-03-PLAN.md | Google OAuth sign-in works on the production domain | NEEDS HUMAN | 11-03-SUMMARY.md claims success; external service state (Google Cloud Console) not programmatically checkable |
| DPLY-03 | 11-03-PLAN.md | Supabase Auth accepts sign-ins from the production domain | NEEDS HUMAN | 11-03-SUMMARY.md claims success; external service state (Supabase Auth URL config) not programmatically checkable |
| DPLY-04 | 11-01-PLAN.md | Build fails loudly when required env vars are missing | VERIFIED | `generate-app-config.js` exits 1 with FATAL message; confirmed by behavioral spot-check |
| DPLY-05 | 11-02-PLAN.md | Next.js 16 middleware compliance (middleware.ts renamed to proxy.ts) | VERIFIED | `src/proxy.ts` exists with `export async function proxy`; `src/middleware.ts` absent; build output showed `ƒ Proxy (Middleware)` |

All 5 phase requirement IDs (DPLY-01 through DPLY-05) are accounted for. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `scripts/generate-app-config.js` | 73 | `APP_FIRST_PARENT` validated for presence only, not for valid values ("father"/"mother") — injected with `as ParentId` type assertion | Info | Runtime failure if typo in env var value; not a build-time abort. Flagged as IN-02 in code review report. No fix applied (info-level). |

No blocking anti-patterns found. No TODO/FIXME/placeholder patterns in any modified file. No `return null` stubs. No empty handlers.

**Code review findings status:**
- WR-01 (APP_CHILDREN missing from required array): False positive — APP_CHILDREN was already present. Confirmed by reading current file.
- WR-02 (misleading DATABASE_URL comment): Fixed in commit `6042e96` — comment now correctly describes pooler URL.
- IN-01 (stale APP_ prefix in header comment): Fixed in commit `6042e96` — header now uses PARENT_ prefix.
- IN-02 (no APP_FIRST_PARENT value validation): Not fixed (info-level, not blocking).

### Notable Deviation: Plan 01 vs Final State

Plan 01 specified adding `APP_FATHER_*`, `APP_MOTHER_*`, and `SUPABASE_SERVICE_ROLE_KEY` to `.env.example`. Plan 03 discovered during execution that these vars were actually unused in the codebase (the codebase uses `PARENT_FATHER_*`/`PARENT_MOTHER_*` naming, and `SUPABASE_SERVICE_ROLE_KEY` has no code references). Plan 03 corrected `generate-app-config.js` to use the actual naming and removed the unused vars from `.env.example`. The current state is internally consistent: `.env.example` documents exactly the vars that `generate-app-config.js` requires.

### Human Verification Required

#### 1. End-to-End Google OAuth Sign-In on Production

**Test:** In a fresh private/incognito browser window, open https://vuoroasuminen.vercel.app. Click "Sign in with Google". Authenticate as the father account. Confirm redirect back to the app signed in, reaching the schedule view. Repeat in a second private window with the mother account.

**Expected:** Both parents land on the schedule view after Google OAuth. No `Error 400: redirect_uri_mismatch` from Google. No Supabase "Invalid redirect URL" error. No redirect loops.

**Why human:** End-to-end OAuth requires a real browser, real Google accounts, and live external service state (Google Cloud Console authorized redirect URIs, Supabase Auth URL Configuration). These cannot be read programmatically without platform admin API access.

**If sign-in fails:**
- `Error 400: redirect_uri_mismatch` (Google) → `https://wsdrguowmcjyfrsjsywn.supabase.co/auth/v1/callback` not registered in Google Cloud Console OAuth client's Authorized redirect URIs
- "Invalid redirect URL" (Supabase) → `https://vuoroasuminen.vercel.app/**` not in Supabase Dashboard > Authentication > URL Configuration > Redirect URLs
- Loops back to sign-in page → check `src/proxy.ts` redirect logic or Vercel function logs

### Gaps Summary

No code gaps found. All automatable success criteria are verified in the codebase. The remaining unverified truths (DPLY-02 and DPLY-03) are external service configuration that can only be confirmed through live browser testing. The production URL is responding (HTTP 200), which is strong indirect evidence that the Vercel deploy succeeded with correct env vars.

---

_Verified: 2026-05-16T10:45:00Z_
_Verifier: Claude (gsd-verifier)_
