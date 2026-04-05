---
phase: 01-foundation
verified: 2026-04-04T16:00:00Z
status: passed
score: 9/9 must-haves verified
re_verification: false
human_verification:
  - test: "Complete Google OAuth sign-in flow end-to-end"
    expected: "User can sign in, see dashboard, refresh, stay signed in, sign out, and be redirected to /"
    why_human: "Live OAuth flow, Calendar scope consent screen, and session cookie behavior cannot be verified programmatically"
    status: "APPROVED — verified by user on 2026-04-04"
---

# Phase 01: Foundation Verification Report

**Phase Goal:** Bootstrap the full-stack Next.js 15 project with TypeScript, configure Google OAuth (Auth.js v5) with Calendar API scope and refresh token persistence, set up the PostgreSQL schema (Auth.js tables + domain tables) on Supabase, and deliver a working sign-in/sign-out shell with route protection — so Phase 2 can build the schedule UI on a complete, authenticated foundation.
**Verified:** 2026-04-04T16:00:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

Note: The human verification checkpoint (Google OAuth sign-in flow end-to-end test) was completed and approved by the user prior to this automated verification.

## Goal Achievement

### Observable Truths

#### Plan 01 Truths (SETP-01)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | config/app.ts exports a typed AppConfig with parents, children, startDate, firstParent | VERIFIED | `src/config/app.ts` exports `ParentId`, `AppConfig`, and default config with `parents`, `children`, `startDate`, `firstParent` |
| 2 | Drizzle schema defines all Auth.js tables and all domain tables with correct column types | VERIFIED | `auth.ts`: users, accounts (with refresh_token/access_token/expires_at), sessions, verificationTokens. `domain.ts`: scheduleStatusEnum, children, schedules, scheduleEntries (DATE col), gcalEvents |
| 3 | drizzle-kit push succeeds against Supabase PostgreSQL | VERIFIED | `drizzle/0000_slow_tag.sql` exists and contains correct DDL for all 8 tables including `CREATE TYPE "public"."schedule_status"` and `"day" date NOT NULL` |
| 4 | .env.example documents every required environment variable | VERIFIED | All 10 vars present: AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, AUTH_SECRET, DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, PARENT_FATHER_EMAIL, PARENT_MOTHER_EMAIL, PARENT_FATHER_CALENDAR_ID, PARENT_MOTHER_CALENDAR_ID |

#### Plan 02 Truths (AUTH-01 through AUTH-04)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 5 | User can sign in with Google account and is redirected to the app | VERIFIED (human) | `src/app/page.tsx` has signIn("google") server action; redirects to /dashboard if session present. Human approval confirmed. |
| 6 | User session persists after browser refresh without re-authenticating | VERIFIED (human) | JWT strategy in `src/auth.ts` (`session: { strategy: "jwt" }`). Human approval confirmed. |
| 7 | User can sign out from the header on any page | VERIFIED | `src/components/layout/header.tsx` calls `signOut()` in a server action form. Human approval confirmed. |
| 8 | OAuth flow requests Google Calendar API scope | VERIFIED | `src/auth.config.ts` line 13: `"https://www.googleapis.com/auth/calendar"` in scope array with `prompt: "consent"` and `access_type: "offline"` |
| 9 | Refresh token rotation exchanges expired access tokens automatically | VERIFIED | `src/auth.ts` jwt callback: fetches `https://oauth2.googleapis.com/token` with grant_type refresh_token on token expiry, updates access_token/expires_at, falls back to RefreshTokenError |

**Score:** 9/9 truths verified

### Required Artifacts

#### Plan 01 Artifacts

| Artifact | Provides | Level 1 (Exists) | Level 2 (Substantive) | Level 3 (Wired) | Status |
|----------|----------|------------------|-----------------------|-----------------|--------|
| `src/config/app.ts` | Typed AppConfig: parents, children, startDate, firstParent | EXISTS | Exports `ParentId`, `AppConfig`, and populated config object | Imported by `src/db/seed.ts` | VERIFIED |
| `src/db/schema/auth.ts` | Auth.js tables: users, accounts, sessions, verificationTokens | EXISTS | All 4 tables with correct columns (refresh_token, access_token, expires_at in accounts) | Imported in `src/auth.ts` and `src/db/index.ts` | VERIFIED |
| `src/db/schema/domain.ts` | Domain tables: children, schedules, scheduleEntries, gcalEvents + enum | EXISTS | All 4 tables with scheduleStatusEnum exported, DATE column on day, all FKs | Imported in `src/db/index.ts` | VERIFIED |
| `src/db/index.ts` | Drizzle client connected to PostgreSQL via pg Pool | EXISTS | Creates Pool, drizzle(pool, { schema: merged }) — exports `db` | Imported in `src/auth.ts` | VERIFIED |
| `drizzle.config.ts` | Drizzle Kit config pointing to schema glob and DATABASE_URL | EXISTS | `schema: "./src/db/schema/*.ts"`, `dialect: "postgresql"`, `dbCredentials.url` | Used by `npm run db:push/generate/studio` | VERIFIED |
| `.env.example` | Template of all required env vars | EXISTS | 10 variables with descriptive comments | Tracked in git, .env.local gitignored via `.env*` pattern | VERIFIED |

#### Plan 02 Artifacts

| Artifact | Provides | Level 1 (Exists) | Level 2 (Substantive) | Level 3 (Wired) | Status |
|----------|----------|------------------|-----------------------|-----------------|--------|
| `src/auth.config.ts` | Edge-safe Auth.js config with Google provider and Calendar scope | EXISTS | Google provider with Calendar scope, prompt: consent, access_type: offline — NO db imports | Imported by `src/middleware.ts` and `src/auth.ts` | VERIFIED |
| `src/auth.ts` | Full Auth.js config with Drizzle adapter, JWT callbacks, refresh token rotation | EXISTS | DrizzleAdapter, jwt callback with refresh rotation, session callback, exports handlers/auth/signIn/signOut | Imported by route handler and UI pages | VERIFIED |
| `src/middleware.ts` | Route protection — redirects unauthenticated users to home page | EXISTS | Imports auth.config (NOT auth.ts — edge safe), matcher excludes api/_next, redirects unauthenticated to / | Active Next.js middleware (auto-applied) | VERIFIED |
| `src/app/api/auth/[...nextauth]/route.ts` | Auth.js API route handler | EXISTS | Exports GET and POST from handlers | Standard Next.js route at /api/auth/* | VERIFIED |
| `src/components/layout/header.tsx` | Nav shell with user avatar and sign-out button | EXISTS | Async Server Component, calls auth(), renders image/name/signOut, app name "Vuoroasuminen" | Imported by `src/app/dashboard/page.tsx` | VERIFIED |
| `src/types/next-auth.d.ts` | TypeScript augmentation for Auth.js Session type with error field | EXISTS | Augments Session with error?:string\|null and JWT with access_token/expires_at/refresh_token/error | TypeScript picks up automatically | VERIFIED |

### Key Link Verification

#### Plan 01 Key Links

| From | To | Via | Pattern | Status |
|------|----|-----|---------|--------|
| `src/db/index.ts` | `src/db/schema/auth.ts` | `import * as authSchema` | `import.*authSchema.*schema/auth` | WIRED — line 3 |
| `src/db/index.ts` | `src/db/schema/domain.ts` | `import * as domainSchema` | `import.*domainSchema.*schema/domain` | WIRED — line 4 |
| `drizzle.config.ts` | `src/db/schema/*.ts` | schema glob | `schema:.*src/db/schema` | WIRED — `./src/db/schema/*.ts` |

#### Plan 02 Key Links

| From | To | Via | Pattern | Status |
|------|----|-----|---------|--------|
| `src/auth.ts` | `src/db/index.ts` | `import { db }` | `import.*db.*from.*@/db` | WIRED — line 4 |
| `src/auth.ts` | `src/db/schema/auth.ts` | `import { accounts... }` | `import.*accounts.*schema/auth` | WIRED — line 5 |
| `src/middleware.ts` | `src/auth.config.ts` | `import authConfig` | `import.*auth\.config` | WIRED — line 2 (imports `./auth.config`, NOT `@/auth`) |
| `src/app/api/auth/[...nextauth]/route.ts` | `src/auth.ts` | `import { handlers }` | `import.*handlers.*@/auth` | WIRED — line 1 |
| `src/components/layout/header.tsx` | `src/auth.ts` | signOut server action | `signOut` | WIRED — imported line 1, called line 28 |

### Data-Flow Trace (Level 4)

Level 4 data-flow trace is not applicable for this phase. All artifacts produce infrastructure (schema, auth config, route handlers, session management) — there are no components that render dynamic data from a database. The dashboard page intentionally shows a "Schedule coming soon" placeholder as per D-05; this is not a hollow prop but a documented intentional stub for Phase 2.

### Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| Migration SQL covers all 8 tables | `head -80 drizzle/0000_slow_tag.sql` | CREATE TABLE for all 8 tables present, including `CREATE TYPE schedule_status` and `"day" date NOT NULL` | PASS |
| auth.config.ts is edge-safe (no db imports) | `grep "drizzle\|@/db\|import.*pg" src/auth.config.ts` | No output (0 matches) | PASS |
| middleware imports auth.config not auth.ts | `grep "import" src/middleware.ts` | `import authConfig from "./auth.config"` only | PASS |
| Calendar scope present in auth.config | `grep "googleapis.com/auth/calendar" src/auth.config.ts` | Line 13 confirmed | PASS |
| All required scripts in package.json | Parsed package.json | db:push, db:generate, db:studio, db:seed all present | PASS |
| .env.local protected | `grep "env" .gitignore` | `.env*` pattern at line 34, with `!.env.example` exception at line 35 | PASS |
| Google profile image domain configured | `cat next.config.ts` | `hostname: "lh3.googleusercontent.com"` in remotePatterns | PASS |
| Full OAuth flow end-to-end | Human checkpoint (Task 3) | All 10 verification steps approved by user | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SETP-01 | 01-01 | Config file defines parents, children, start date, first parent | SATISFIED | `src/config/app.ts` with typed ParentId/AppConfig, populated with Isä/Äiti, Emma/Olivia, 2026-01-05, "father" |
| AUTH-01 | 01-02 | User can sign in with Google account via OAuth | SATISFIED | `src/app/page.tsx` signIn("google") server action; human approval confirmed |
| AUTH-02 | 01-02 | User session persists across browser refresh | SATISFIED | JWT strategy in auth.ts; human approval confirmed |
| AUTH-03 | 01-02 | User can sign out from any page | SATISFIED | Header Server Component with signOut form; human approval confirmed |
| AUTH-04 | 01-02 | App requests Google Calendar API scope at sign-in | SATISFIED | `auth.config.ts` scope includes `googleapis.com/auth/calendar`, with prompt:consent + access_type:offline to force refresh token |

All 5 requirements claimed by Phase 1 plans are satisfied. No orphaned requirements found — REQUIREMENTS.md traceability table maps AUTH-01 through AUTH-04 and SETP-01 to Phase 1, matching exactly what the plans claim.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app/dashboard/page.tsx` | 8 | "Schedule coming soon" placeholder text | Info | Intentional — documented in plan (D-05) and SUMMARY as known stub; Phase 2 replaces this with schedule grid |

No blockers or warnings found. The dashboard placeholder is by design — the plan explicitly specifies "Schedule coming soon" text per D-05, and AUTH requirements do not require actual schedule content.

### Human Verification Required

The automated verification note from the prompt states that the human verification checkpoint was completed and approved by the user before this verification was run. For completeness:

**1. Google OAuth Sign-In Flow (APPROVED)**

- Test: Start `npm run dev`, visit http://localhost:3000, click "Sign in with Google", complete OAuth, verify Calendar scope on consent screen, check dashboard header, refresh to confirm session persistence, sign out, verify redirect to /
- Expected: Full sign-in/sign-out cycle works; Calendar scope visible on consent screen; session survives refresh; middleware redirects unauthenticated /dashboard access to /
- Status: APPROVED by user on 2026-04-04

### Gaps Summary

No gaps found. All 9 observable truths are verified, all artifacts exist and are substantive and wired, all 5 key links are confirmed connected, all 5 Phase 1 requirements are satisfied, and the human verification checkpoint was approved.

The `src/app/dashboard/page.tsx` "Schedule coming soon" body is the only placeholder in the codebase, and it is intentional per the plan specification (D-05). Phase 2 will replace it with the schedule grid.

---

_Verified: 2026-04-04T16:00:00Z_
_Verifier: Claude (gsd-verifier)_
