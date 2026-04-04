---
phase: 01-foundation
plan: 01
subsystem: database
tags: [next.js, typescript, drizzle, postgresql, supabase, auth.js, tailwind, shadcn]

# Dependency graph
requires: []
provides:
  - Next.js 16.x project with TypeScript, Tailwind v4, App Router
  - All Phase 1 dependencies installed (next-auth@beta, drizzle-orm, pg, supabase-js, zod, date-fns)
  - shadcn/ui initialized with Button component
  - Typed AppConfig (ParentId, parents, children, startDate, firstParent)
  - Drizzle schema: 4 Auth.js tables + 4 domain tables (children, schedules, scheduleEntries, gcalEvents)
  - Auth.js accounts table with refresh_token/access_token for GCal OAuth
  - Generated migration SQL (drizzle/0000_slow_tag.sql) ready to push to Supabase
  - .env.example documenting all 10+ required environment variables
affects: [01-02, auth, schedule-grid, gcal-sync]

# Tech tracking
tech-stack:
  added:
    - next@16.2.2
    - next-auth@beta (5.0.0-beta.30)
    - "@auth/drizzle-adapter@1.11.1"
    - drizzle-orm@0.45.2
    - drizzle-kit@0.31.10
    - pg@8.20.0
    - "@supabase/supabase-js@2.101.1"
    - "@supabase/ssr@0.10.0"
    - zod@4.3.6
    - date-fns@4.1.0
    - tailwindcss@4.x
    - shadcn/ui (New York style)
  patterns:
    - "Drizzle schema split: auth.ts (Auth.js tables) + domain.ts (app tables) imported via glob"
    - "pgEnum must be exported to avoid silent drizzle-kit omission"
    - "DATE columns (not TIMESTAMP) for custody day — timezone-safe"
    - "parentId stored as 'father'|'mother' string, not FK to users"

key-files:
  created:
    - src/config/app.ts
    - src/db/schema/auth.ts
    - src/db/schema/domain.ts
    - src/db/index.ts
    - src/db/seed.ts
    - drizzle.config.ts
    - drizzle/0000_slow_tag.sql
    - .env.example
    - src/components/ui/button.tsx
    - src/lib/utils.ts
  modified:
    - package.json
    - .gitignore
    - src/app/globals.css

key-decisions:
  - "AppConfig: parents array [{id, name}], children string[], startDate ISO string, firstParent ParentId"
  - "status enum (draft/published) not boolean flag on schedule_entries — extensible for future states"
  - "gcal_events mirror table created in Phase 1 for clean idempotency surface in Phase 4"
  - "drizzle-kit push deferred — user must fill DATABASE_URL in .env.local first"
  - ".env* gitignored but .env.example whitelisted via !.env.example in .gitignore"

patterns-established:
  - "Pattern: src/db/schema/*.ts glob for Drizzle schema — add domain files here"
  - "Pattern: export all pgEnums from schema files — drizzle-kit silent omission bug"
  - "Pattern: AppConfig default export from src/config/app.ts for non-secret structured config"

requirements-completed: [SETP-01]

# Metrics
duration: 7min
completed: 2026-04-04
---

# Phase 01 Plan 01: Foundation Bootstrap Summary

**Next.js 16 + Drizzle schema bootstrapped — 8-table PostgreSQL schema (Auth.js + domain) with Tailwind v4, shadcn/ui, and all Phase 1 dependencies**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-04T15:32:57Z
- **Completed:** 2026-04-04T15:40:17Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments

- Next.js 16.x project bootstrapped with TypeScript, Tailwind v4, App Router, shadcn/ui (Button component)
- All Phase 1 dependencies installed: next-auth@beta, @auth/drizzle-adapter, drizzle-orm, pg, @supabase/supabase-js, @supabase/ssr, zod, date-fns, drizzle-kit
- Complete Drizzle schema: 4 Auth.js tables (users, accounts, sessions, verificationTokens) + 4 domain tables (children, schedules, scheduleEntries, gcalEvents)
- Migration SQL generated — `CREATE TYPE schedule_status`, `day date NOT NULL`, all FK constraints correct
- Typed `AppConfig` with `ParentId` union type in `src/config/app.ts`
- `.env.example` documents all 10 required environment variables

## Task Commits

Each task was committed atomically:

1. **Task 1: Bootstrap Next.js project and install all dependencies** - `c4edb08` (feat)
2. **Task 2: Create app config, Drizzle schema, DB client, and push to Supabase** - `68586b6` (feat)

Note: `feat: initial commit` at `f4f2555` was auto-committed by git hooks during npm setup, containing all bootstrap files (package.json, tsconfig, src/app/*, components.json, etc.)

## Files Created/Modified

- `src/config/app.ts` — TypeScript AppConfig with ParentId type; parents (Isä/Äiti), children (Emma/Olivia), startDate, firstParent
- `src/db/schema/auth.ts` — Auth.js tables: users, accounts (with refresh_token/access_token), sessions, verificationTokens
- `src/db/schema/domain.ts` — scheduleStatusEnum (exported!), children, schedules, scheduleEntries (DATE col), gcalEvents
- `src/db/index.ts` — Drizzle pg Pool client with merged auth + domain schema
- `src/db/seed.ts` — Seeds children table from config (run once after push)
- `drizzle.config.ts` — schema glob `./src/db/schema/*.ts`, dialect postgresql
- `drizzle/0000_slow_tag.sql` — Generated migration with CREATE TYPE + 8 tables
- `.env.example` — Template for all 10 required env vars with comments
- `.gitignore` — Updated to whitelist `.env.example` (was blocked by `.env*` pattern)
- `package.json` — Added db:push, db:generate, db:studio, db:seed scripts

## Decisions Made

- Used `export const scheduleStatusEnum` to avoid drizzle-kit silent omission of pgEnum (documented pitfall from RESEARCH.md)
- `parentId` stored as `'father' | 'mother'` string (from config), not FK to users table — parents identified by config role
- `day` column uses `date("day", { mode: "string" })` not timestamp — timezone-safe for custody dates
- `gcal_events` mirror table included from day one — provides clean idempotency surface for Phase 4 GCal sync
- `.env.example` whitelisted in `.gitignore` via `!.env.example` negation — setup template should be tracked

## Deviations from Plan

None - plan executed exactly as written.

The `drizzle-kit push` step failed as expected (DATABASE_URL not configured). This is documented behavior per the plan: "If DATABASE_URL is not set in .env.local yet, the push will fail. That is expected."

## Issues Encountered

**`create-next-app` could not run in worktree directory** — the existing `.planning/` and `CLAUDE.md` files prevented `create-next-app . --yes` from running (conflict detection). Resolution: bootstrapped in `/tmp/vuoroasuminen-bootstrap` and rsync'd files to the worktree, excluding `.git`, `node_modules`, and existing files. This is standard for git worktrees with pre-existing files.

## User Setup Required

Before using the database or auth features, the developer must:

1. **Create a Supabase project** at [supabase.com](https://supabase.com) (free tier)
2. **Copy connection string** (Settings → Database → Direct connection, port 5432) into `.env.local`:
   ```
   DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
   ```
3. **Push schema to Supabase:**
   ```bash
   npm run db:push
   ```
4. **Seed children data:**
   ```bash
   npm run db:seed
   ```
5. **Create Google OAuth app** at [console.cloud.google.com](https://console.cloud.google.com), enable Calendar API, and add credentials to `.env.local`

See `.env.example` for all required variables.

## Known Stubs

None — this plan creates infrastructure only; no UI data flow to wire.

## Next Phase Readiness

- Foundation complete: all dependencies installed, schema ready, config typed
- Plan 02 (Auth.js Google OAuth) can proceed immediately
- DATABASE_URL and Google OAuth credentials are the only blockers for running auth
- Migration is pre-generated in `drizzle/0000_slow_tag.sql` — user runs `npm run db:push` once

---
*Phase: 01-foundation*
*Completed: 2026-04-04*
