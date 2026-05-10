---
phase: 08-supabase-auth-stack
verified: 2026-05-10T09:34:58Z
status: passed
score: 9/9 must-haves verified
overrides_applied: 0
---

# Phase 8: Supabase Auth Stack — Verification Report

**Phase Goal:** Users can sign in via Supabase Google OAuth and GCal sync works end-to-end against the new token store
**Verified:** 2026-05-10T09:34:58Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can sign in with Google via the new Supabase OAuth flow (PKCE) and is redirected to the dashboard | VERIFIED | `sign-in-button.tsx` calls `signInWithOAuth` with PKCE; callback route does `exchangeCodeForSession`; redirects to `/dashboard`. Gate TEST 1: PASS. |
| 2 | User session survives a full browser refresh (cookie-based Supabase session persists) | VERIFIED | Middleware refreshes session cookies on every request by returning the supabase-augmented `response` object; `createSupabaseMiddlewareClient` wires `getAll`/`setAll` to `response.cookies`. Gate TEST 2: PASS. |
| 3 | A row exists in `user_google_tokens` after sign-in; the row contains a non-null `refresh_token` | VERIFIED | Callback route upserts `userGoogleTokens` via `onConflictDoUpdate` keyed on email when `provider_refresh_token` is present; DB-insert error is caught and redirects to `/auth/error`. Gate TEST 3: PASS. |
| 4 | Publishing the schedule triggers GCal sync using the `ownerEmail` token — calendar events are created correctly regardless of which parent pressed publish | VERIFIED | `sync.ts` passes `parent.ownerEmail` to `buildGCalClient`; `buildGCalClient` does a single SELECT against `user_google_tokens.email`; no Auth.js join. Gate TEST 4: PASS. |
| 5 | Dashboard shows a dismissible warning banner when the calendar owner's token row is absent | VERIFIED | `dashboard/page.tsx` queries `user_google_tokens` in parallel with schedule; passes `showOwnerWarning = !tokenRow` to `DashboardShell`; `OwnerWarningBanner` renders Finnish copy with dismiss via `useState`. Gate TEST 5: PASS. |

**Score:** 5/5 roadmap success criteria verified

### Phase-level Must-Haves (derived from plan frontmatter, merged with roadmap)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A Drizzle schema definition exists for `user_google_tokens` | VERIFIED | `src/db/schema/tokens.ts` exports `userGoogleTokens` with email PK, refreshToken NOT NULL, updatedAt defaultNow |
| 2 | The Drizzle db client knows about `userGoogleTokens` at runtime | VERIFIED | `src/db/index.ts` imports `* as tokensSchema` and spreads it alongside authSchema and domainSchema |
| 3 | Server Components and Route Handlers can obtain a cookie-wired Supabase client | VERIFIED | `src/lib/supabase/server.ts` exports `createSupabaseServerClient()` using `await cookies()` with `getAll`/`setAll` |
| 4 | Middleware can obtain a per-request Supabase client | VERIFIED | `src/lib/supabase/middleware.ts` exports `createSupabaseMiddlewareClient(request, response)`, sync, no `next/headers`, D-10 documented |
| 5 | `user_google_tokens` physically exists in Supabase Postgres | VERIFIED | Plan 03 SUMMARY confirms push succeeded; all 3 columns present, all NOT NULL; Gate TEST 3 row-write confirms table is live |
| 6 | Middleware uses `getUser()` (not `getSession()`) and is per-request | VERIFIED | `src/middleware.ts` calls `supabase.auth.getUser()`; `getSession` appears only in a comment; `createSupabaseMiddlewareClient` called inside handler body |
| 7 | OAuth callback captures `provider_refresh_token` and upserts `user_google_tokens`; redirects to `/auth/error` when token is null | VERIFIED | Three distinct `/auth/error` redirect paths; upsert via `onConflictDoUpdate`; response built before supabase client (Pitfall 3 fix) |
| 8 | `AppConfig.parents[].ownerEmail` exists; `buildGCalClient` reads `user_google_tokens` by ownerEmail | VERIFIED | `src/config/app.ts` has `ownerEmail: string` in interface and both entries; `client.ts` does `eq(userGoogleTokens.email, ownerEmail)` with no Auth.js join |
| 9 | Dashboard banner renders Finnish warning and is dismissible; disappears when owner token exists | VERIFIED | `owner-warning-banner.tsx`: verbatim Finnish copy, `useState(false)` dismiss, no localStorage, shadcn Alert default variant |

**Score:** 9/9 must-haves verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/schema/tokens.ts` | userGoogleTokens table definition | VERIFIED | email PK, refreshToken NOT NULL, updatedAt defaultNow — exact match |
| `src/db/index.ts` | tokensSchema registered in Drizzle client | VERIFIED | `import * as tokensSchema` + spread in schema object |
| `src/lib/supabase/server.ts` | `createSupabaseServerClient()` async factory | VERIFIED | Awaits `cookies()`, `getAll`/`setAll` callbacks, try/catch on Server Component writes |
| `src/lib/supabase/middleware.ts` | `createSupabaseMiddlewareClient(request, response)` sync factory | VERIFIED | Sync, reads `request.cookies`, writes `response.cookies`, D-10 documented |
| `src/middleware.ts` | Supabase `getUser()` route guard | VERIFIED | `getUser()` used, no `getSession`, per-request client, `/auth/*` allowed, `api/auth` excluded from matcher |
| `src/app/auth/callback/route.ts` | PKCE exchange + token upsert + error redirect | VERIFIED | Response built before client (Pitfall 3); 3 error redirects; upsert with `onConflictDoUpdate`; DB-error caught |
| `src/app/auth/error/page.tsx` | Finnish error page with re-auth CTA | VERIFIED | `"use client"`, verbatim Finnish copy, Calendar scope + offline + consent, `createBrowserClient` from `@supabase/ssr` |
| `src/app/page.tsx` | Home page with Supabase `getUser()` redirect | VERIFIED | `createSupabaseServerClient()` + `getUser()`; `if (user) redirect("/dashboard")`; no `@/auth` import |
| `src/components/sign-in-button.tsx` | Supabase `signInWithOAuth` with Calendar scope | VERIFIED | `signInWithOAuth`, Calendar scope, `access_type: "offline"`, `prompt: "consent"`, singleton client from `@/lib/supabase/client` |
| `src/actions/auth.ts` | `signOutAction` — Supabase `signOut` + redirect | VERIFIED | `supabase.auth.signOut()` then `redirect("/")`, same function name, no `@/auth` import |
| `src/components/layout/header.tsx` | Header reads `user_metadata` from Supabase | VERIFIED | `createSupabaseServerClient()` + `getUser()`, reads `avatar_url` and `full_name` from `user_metadata`, sign-out form preserved |
| `src/actions/schedule.ts` | `requireAuthorizedParent()` uses Supabase `getUser()` | VERIFIED | `createSupabaseServerClient()` + `getUser()`; same throw messages; same `config.parents.some` check; all 7 Server Actions intact |
| `src/config/app.ts` | `ownerEmail: string` per parent entry | VERIFIED | Required field in interface; populated from `APP_CALENDAR_OWNER_EMAIL` with per-parent fallback |
| `scripts/generate-app-config.js` | Build-time generator emits `ownerEmail` | VERIFIED | `APP_CALENDAR_OWNER_EMAIL` in `required` array; `ownerEmail` in emitted interface and both parent entries (2 occurrences) |
| `src/lib/gcal/client.ts` | `buildGCalClient(ownerEmail)` reads `user_google_tokens` | VERIFIED | Single SELECT by `eq(userGoogleTokens.email, ownerEmail)`; no Auth.js import; `row.refreshToken`; token exchange preserved |
| `src/lib/gcal/sync.ts` | Passes `parent.ownerEmail` to `buildGCalClient` | VERIFIED | `buildGCalClient(parent.ownerEmail)` on line 160; `buildGCalClient(parent.email)` absent |
| `src/components/ui/alert.tsx` | shadcn Alert primitive | VERIFIED | Exports `Alert`, `AlertTitle`, `AlertDescription`, `AlertAction` |
| `src/components/owner-warning-banner.tsx` | Dismissible Finnish warning banner | VERIFIED | `useState(false)` dismiss; Finnish copy verbatim; no localStorage; default Alert variant; Calendar scope OAuth CTA |
| `src/components/schedule/dashboard-shell.tsx` | `showOwnerWarning?: boolean` prop | VERIFIED | Optional prop with `= false` default; `{showOwnerWarning && <OwnerWarningBanner />}` between header and ViewToolbar |
| `src/app/dashboard/page.tsx` | Queries `user_google_tokens`, passes `showOwnerWarning` | VERIFIED | `db.select(...).from(userGoogleTokens).where(eq(..., ownerEmail)).limit(1)` inside `Promise.all`; `showOwnerWarning = !tokenRow` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/db/index.ts` | `src/db/schema/tokens.ts` | `import * as tokensSchema` | WIRED | Line 5: `import * as tokensSchema from "./schema/tokens"` + spread on line 13 |
| `src/lib/supabase/server.ts` | `@supabase/ssr` | `createServerClient` import | WIRED | Line 1: `import { createServerClient } from "@supabase/ssr"` |
| `src/lib/supabase/middleware.ts` | `@supabase/ssr` | `createServerClient` import | WIRED | Line 1: `import { createServerClient } from "@supabase/ssr"` |
| `src/middleware.ts` | `createSupabaseMiddlewareClient` | import + per-request invocation | WIRED | Line 3 import; line 9 `createSupabaseMiddlewareClient(request, response)` inside handler |
| `src/components/sign-in-button.tsx` | `/auth/callback` via OAuth | `signInWithOAuth` redirectTo | WIRED | `redirectTo: \`${window.location.origin}/auth/callback\`` |
| `src/app/auth/callback/route.ts` | `user_google_tokens` table | `db.insert(userGoogleTokens).onConflictDoUpdate` | WIRED | Lines 59-72; `target: userGoogleTokens.email` |
| `src/lib/gcal/sync.ts` | `src/lib/gcal/client.ts` | `buildGCalClient(parent.ownerEmail)` | WIRED | Line 160: exact match |
| `src/lib/gcal/client.ts` | `user_google_tokens` table | `eq(userGoogleTokens.email, ownerEmail)` | WIRED | Lines 28-31; single SELECT, no JOIN |
| `src/app/dashboard/page.tsx` | `user_google_tokens` (admin Drizzle) | `db.select(...).where(eq(userGoogleTokens.email, ownerEmail))` | WIRED | Lines 36-42 |
| `src/app/dashboard/page.tsx` | `DashboardShell.showOwnerWarning` | `showOwnerWarning={showOwnerWarning}` | WIRED | Line 52 |
| `src/components/schedule/dashboard-shell.tsx` | `OwnerWarningBanner` | `{showOwnerWarning && <OwnerWarningBanner />}` | WIRED | Line 45 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `src/app/dashboard/page.tsx` | `showOwnerWarning` | `db.select().from(userGoogleTokens).where(eq(..., ownerEmail)).limit(1)` inside `Promise.all` | Yes — admin Drizzle query against live Supabase table | FLOWING |
| `src/components/owner-warning-banner.tsx` | `dismissed` (useState) | Server prop `showOwnerWarning` controls render; `useState(false)` is in-memory dismiss | Yes — server renders based on real DB state | FLOWING |
| `src/components/layout/header.tsx` | `user`, `avatarUrl`, `fullName` | `createSupabaseServerClient()` + `supabase.auth.getUser()` | Yes — server-validated JWT from Supabase Auth | FLOWING |
| `src/lib/gcal/client.ts` | `row.refreshToken` | `db.select({ refreshToken: userGoogleTokens.refreshToken }).from(userGoogleTokens).where(...)` | Yes — real DB row written by callback | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles with no errors | `npx tsc --noEmit` | Exit 0, no output | PASS |
| Sign-in button imports from singleton client | `grep createBrowserClient src/components/sign-in-button.tsx` | `from "@/lib/supabase/client"` (singleton, gate bug fixed) | PASS |
| Dashboard → DashboardShell data flow wired | `grep showOwnerWarning src/app/dashboard/page.tsx` | `showOwnerWarning={showOwnerWarning}` on line 52 | PASS |
| callback route response before client | Line ordering in `src/app/auth/callback/route.ts` | `response` on line 19, `supabase` on line 21 — correct order | PASS |
| Gate human verification | 08-08-SUMMARY.md | All 5 tests PASS (2026-05-10) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SAUTH-01 | 08-04 | User can sign in with Google via Supabase OAuth (PKCE) | SATISFIED | `sign-in-button.tsx` → Supabase OAuth → `/auth/callback` → `/dashboard`; Gate TEST 1 PASS |
| SAUTH-02 | 08-04, 08-05 | Session persists across page refreshes | SATISFIED | Middleware returns supabase-augmented response; cookies refreshed on every request; Gate TEST 2 PASS |
| SAUTH-03 | 08-05 | User can sign out | SATISFIED | `signOutAction` calls `supabase.auth.signOut()` + `redirect("/")`; header form wired |
| SAUTH-04 | 08-04 | Unauthenticated users redirected to sign-in on protected routes | SATISFIED | Middleware redirects non-auth, non-`/`, non-`/auth/*` requests to `/` |
| SAUTH-05 | 08-04 | Sign-in forces `access_type:offline` + `prompt:consent` | SATISFIED | Both `sign-in-button.tsx` and `auth/error/page.tsx` contain `access_type: "offline"` and `prompt: "consent"` |
| SAUTH-06 | 08-04 | `provider_refresh_token` captured; null token redirects to error page | SATISFIED | Three distinct `/auth/error` redirects in callback; upsert on presence of token; Gate TEST 3 PASS |
| SAUTH-07 | 08-07 | Dashboard shows dismissible warning when owner token absent | SATISFIED | `dashboard/page.tsx` queries token row; banner renders Finnish copy via `OwnerWarningBanner`; Gate TEST 5 PASS |
| GCAL-01 | 08-06 | GCal sync uses `ownerEmail` token regardless of which parent publishes | SATISFIED | `sync.ts` passes `parent.ownerEmail` to `buildGCalClient`; Gate TEST 4 PASS |
| GCAL-02 | 08-06 | `app.ts` config includes `ownerEmail` per calendar entry | SATISFIED | `src/config/app.ts` has `ownerEmail: string` (required) in interface and both parent entries |

**All 9 requirements SATISFIED.**

No orphaned requirements: RLS-01..04 are mapped to Phase 9; CLEAN-01..03 are mapped to Phase 10. No REQUIREMENTS.md entries for Phase 8 are unclaimed.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/layout/header.tsx` | 12 | `if (!user) return null` | Info | Correct conditional guard — header does not render on unauthenticated pages. Not a stub. |
| `src/components/owner-warning-banner.tsx` | 12 | `if (dismissed) return null` | Info | Correct dismiss behavior — D-07 per-session dismiss. Not a stub. |
| `src/app/auth/callback/route.ts` | 51, 54 | `console.log(...)` debug lines | Info | Added during gate bug fix for observability; not blocking. Can be removed in production cleanup (Phase 10). |

No blockers or warnings found.

### Human Verification Required

None. The human gate (Plan 08-08) was formally executed and PASSED on 2026-05-10. All 5 browser tests passed:

1. **TEST 1 — SAUTH-01:** PKCE Google sign-in lands on `/dashboard` — PASS
2. **TEST 2 — SAUTH-02:** Session persists across page refresh — PASS
3. **TEST 3 — SAUTH-06:** `user_google_tokens` row written with non-null `refresh_token` — PASS
4. **TEST 4 — GCAL-01/GCAL-02:** Publish triggers GCal sync via `ownerEmail` token; events appear on both calendars — PASS
5. **TEST 5 — SAUTH-07:** Dashboard banner appears when owner token absent; dismisses; reappears on refresh; clears after owner sign-in — PASS

Three bugs were found and fixed during the gate: silent callback error (try/catch added), `ScheduleTable` infinite re-render (ref pattern fix), and `SignInButton` creating a new client per click (switched to singleton from `@/lib/supabase/client`).

### Gaps Summary

No gaps. All 9 requirements are satisfied, all 20 key artifacts exist and are substantive, all 11 key links are wired, data flows from the database to the UI are confirmed. The human gate passed with all 5 tests.

---

_Verified: 2026-05-10T09:34:58Z_
_Verifier: Claude (gsd-verifier)_
