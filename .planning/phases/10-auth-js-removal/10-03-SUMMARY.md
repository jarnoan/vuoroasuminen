---
phase: 10-auth-js-removal
plan: "03"
subsystem: packages, env-vars
tags: [cleanup, auth-removal, env-vars, packages, google-oauth]

requires:
  - phase: 10-auth-js-removal
    plan: "01"
    provides: Auth.js tables dropped from DB

provides:
  - "next-auth and @auth/drizzle-adapter uninstalled from package.json and node_modules"
  - "AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET / AUTH_SECRET / AUTH_URL removed from src/env.ts and .env.example"
  - "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET added to src/env.ts (runtime validation) and .env.example (operator template)"
  - "src/lib/gcal/client.ts reads GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (4 call sites updated)"
  - "db:clear-tokens orphaned script removed from package.json"

affects:
  - 10-04-supabase-auth

tech-stack:
  added: []
  patterns:
    - "Google OAuth client credentials renamed from AUTH_GOOGLE_* to GOOGLE_CLIENT_* to reflect direct GCal use (not Auth.js)"
    - "npm uninstall + npm pkg delete for atomic package and script removal"

key-files:
  created: []
  modified:
    - src/env.ts
    - src/lib/gcal/client.ts
    - .env.example
    - package.json
    - package-lock.json

key-decisions:
  - "Renamed AUTH_GOOGLE_ID/SECRET to GOOGLE_CLIENT_ID/SECRET — these are Google Cloud Console OAuth client credentials used directly by the GCal token exchange; naming them AUTH_GOOGLE_* was Auth.js convention, not their actual identity"
  - "src/auth.ts AUTH_GOOGLE_* references left for Plan 02 — that file is deleted in full by Plan 02 (wave 2 parallel agent); it is outside Plan 03 scope"

requirements-completed:
  - CLEAN-01
  - CLEAN-03

duration: 3min
completed: "2026-05-15"
---

# Phase 10 Plan 03: Package Uninstall and Env Var Rename Summary

**next-auth and @auth/drizzle-adapter uninstalled; AUTH_GOOGLE_* renamed to GOOGLE_CLIENT_* in env validation and GCal client; AUTH_SECRET/AUTH_URL removed from .env.example**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-15T02:47:34Z
- **Completed:** 2026-05-15T02:50:10Z
- **Tasks:** 3
- **Files modified:** 5 (src/env.ts, src/lib/gcal/client.ts, .env.example, package.json, package-lock.json)

## Accomplishments

- Replaced `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_SECRET` in `REQUIRED_ENV_VARS` with `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (array reduced from 6 to 5 entries)
- Updated all 4 call sites in `src/lib/gcal/client.ts` (`process.env.AUTH_GOOGLE_ID` → `process.env.GOOGLE_CLIENT_ID`, `process.env.AUTH_GOOGLE_SECRET` → `process.env.GOOGLE_CLIENT_SECRET`)
- Rewrote `.env.example`: removed `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_SECRET`, `AUTH_URL`; added `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` with clarifying comment distinguishing them from Supabase Dashboard's own copy
- Uninstalled `next-auth@^5.0.0-beta.30` and `@auth/drizzle-adapter@^1.11.1` via `npm uninstall`; both absent from `package.json` and `node_modules`
- Removed orphaned `db:clear-tokens` script from `package.json` via `npm pkg delete`

## Task Commits

1. **Task 1: Rename AUTH_GOOGLE_* to GOOGLE_CLIENT_* in env.ts and gcal/client.ts** — `5ac5cab`
2. **Task 2: Update .env.example — remove Auth.js vars, add GOOGLE_CLIENT_*** — `d8d849c`
3. **Task 3: Uninstall next-auth and @auth/drizzle-adapter, remove db:clear-tokens** — `5157084`

## Before / After Diffs

### src/env.ts REQUIRED_ENV_VARS

Before:
```ts
const REQUIRED_ENV_VARS = [
  "AUTH_GOOGLE_ID",
  "AUTH_GOOGLE_SECRET",
  "AUTH_SECRET",
  "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const
```

After:
```ts
const REQUIRED_ENV_VARS = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const
```

### src/lib/gcal/client.ts env var lines (before → after)

```diff
-      client_id: process.env.AUTH_GOOGLE_ID!,
-      client_secret: process.env.AUTH_GOOGLE_SECRET!,
+      client_id: process.env.GOOGLE_CLIENT_ID!,
+      client_secret: process.env.GOOGLE_CLIENT_SECRET!,

-  const oauth2Client = new google.auth.OAuth2(
-    process.env.AUTH_GOOGLE_ID,
-    process.env.AUTH_GOOGLE_SECRET,
-  )
+  const oauth2Client = new google.auth.OAuth2(
+    process.env.GOOGLE_CLIENT_ID,
+    process.env.GOOGLE_CLIENT_SECRET,
+  )
```

### .env.example (full new content)

```
# Google OAuth client (Google Cloud Console -> APIs & Services -> Credentials)
# Used by src/lib/gcal/client.ts for the GCal refresh-token exchange.
# Supabase Dashboard holds its own copy of these for the sign-in flow.
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Supabase (Supabase Dashboard -> Settings -> Database -> Connection string -> URI)
# Use the direct connection (port 5432) for local dev — NOT the pooler (port 6543)
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres

# Supabase client (Supabase Dashboard -> Settings -> API)
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Parent emails (for identifying which parent is signed in)
PARENT_FATHER_EMAIL=
PARENT_MOTHER_EMAIL=

# Google Calendar IDs (Google Calendar -> Settings -> calendar ID)
PARENT_FATHER_CALENDAR_ID=
PARENT_MOTHER_CALENDAR_ID=
```

## npm uninstall Output

```
npm uninstall next-auth @auth/drizzle-adapter
added 717 packages, audited 718 packages in 9s
(npm output includes deprecation warnings for transitive deps; both target packages removed)
```

## package.json Verification

```
next-auth in deps: false
@auth/drizzle-adapter in deps: false
db:clear-tokens in scripts: false
```

All three print `false` — PASS.

## Operator Reminder

**IMPORTANT — Vercel deployment:** When deploying after Phase 10, rename the environment variables on Vercel:

- Rename `AUTH_GOOGLE_ID` → `GOOGLE_CLIENT_ID` (same value; do NOT regenerate)
- Rename `AUTH_GOOGLE_SECRET` → `GOOGLE_CLIENT_SECRET` (same value; do NOT regenerate)
- Remove `AUTH_SECRET` and `AUTH_URL` (no longer used)

The GCal sync will fail with a token exchange error until these are renamed on the Vercel dashboard.

## Deviations from Plan

### Scope Boundary Note (not a deviation)

The overall `<verification>` check (`grep -rnE "AUTH_GOOGLE_ID|..." src/`) finds remaining references in `src/auth.ts`. This is expected: `src/auth.ts` is the Auth.js entry-point file that Plan 02 deletes in full (wave 2, parallel execution). Plan 03's `<files_modified>` list explicitly excludes `src/auth.ts`. The references in that file are Plan 02's responsibility.

**Total deviations:** None — plan executed exactly as written within scope.

## Self-Check

### Created files exist
- `/Users/jarno/src/vuoroasuminen/.claude/worktrees/agent-a305383a46dd620c6/.planning/phases/10-auth-js-removal/10-03-SUMMARY.md` — this file

### Commits exist
- `5ac5cab` — Task 1
- `d8d849c` — Task 2
- `5157084` — Task 3

## Self-Check: PASSED

---
*Phase: 10-auth-js-removal*
*Completed: 2026-05-15*
