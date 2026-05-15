---
phase: 10-auth-js-removal
plan: "01"
subsystem: database
tags: [postgres, migration, auth-removal, drizzle, supabase]

requires:
  - phase: 09-row-level-security
    provides: RLS enabled on domain tables; user_google_tokens populated with active parent tokens

provides:
  - "10-01-DROP.sql committed as auditable record of Auth.js table removal"
  - "Auth.js tables (verificationTokens, sessions, accounts, users) dropped from Supabase Postgres in FK-reverse order"
  - "No orphaned FK constraints in database"
  - "user_google_tokens unchanged (2 rows, one per parent)"

affects:
  - 10-02-schema-deletion
  - 10-03-code-removal
  - 10-04-supabase-auth

tech-stack:
  added: []
  patterns:
    - "Auth.js table drop order: verificationTokens → sessions → accounts → users (FK-reverse)"
    - "Migration SQL wrapped in BEGIN/COMMIT for atomic rollback on partial failure"
    - "IF EXISTS on DROP TABLE for idempotent re-runs"
    - "pg Node.js driver used as psql substitute when psql not installed"

key-files:
  created:
    - ".planning/phases/10-auth-js-removal/10-01-DROP.sql"
  modified: []

key-decisions:
  - "Used Node.js pg driver instead of psql (not installed) — equivalent semantics, same connection string"
  - "Confirmed 2 rows in user_google_tokens before dropping accounts table — pre-flight gate satisfied"
  - "IF EXISTS on all DROP statements makes migration safe to re-run if applied partially"

patterns-established:
  - "Pre-flight check: verify replacement table has data BEFORE dropping old auth tables"

requirements-completed:
  - CLEAN-02

duration: 3min
completed: "2026-05-15"
---

# Phase 10 Plan 01: Drop Auth.js Tables Summary

**Auth.js DB tables (verificationTokens, sessions, accounts, users) surgically dropped from Supabase Postgres via FK-reverse-order SQL migration inside a BEGIN/COMMIT transaction**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-15T02:41:44Z
- **Completed:** 2026-05-15T02:44:56Z
- **Tasks:** 2
- **Files modified:** 1 (10-01-DROP.sql created)

## Accomplishments

- Authored `10-01-DROP.sql` with exactly 4 DROP TABLE IF EXISTS statements in FK-reverse order, with correct quoting for camelCase Drizzle table names (`"verificationTokens"`, `"sessions"`) and unquoted lowercase names (`accounts`, `users`)
- Executed migration against Supabase Postgres — all 4 tables dropped cleanly; psql exit code 0 (via Node.js pg)
- Pre-flight confirmed: `user_google_tokens` had 2 rows before drop (one per parent) — GCal sync data intact
- Post-drop verification: zero Auth.js tables remain in `pg_tables`; zero orphaned FK constraints in `pg_constraint`

## Task Commits

1. **Task 1: Author DROP TABLE migration SQL file** - `f2eabf9` (chore)
2. **Task 2: Execute DROP migration against Supabase** - no file changes (database-only execution; documented in SUMMARY)

**Plan metadata:** (committed with this SUMMARY)

## Migration Execution Log

**Pre-flight (user_google_tokens row count):**
```
user_google_tokens row count: 2
```
Pre-flight PASSED — safe to proceed.

**Pre-drop row counts:**
```
users: 1
accounts: 1
sessions: 0
verificationTokens: 0
```

**Migration output (BEGIN/DROP x4/COMMIT):**
```
Command: BEGIN
Command: DROP
Command: DROP
Command: DROP
Command: DROP
Command: COMMIT
Migration complete
```

**Post-drop verification:**
```
Tables still present: 0
VERIFIED: All 4 Auth.js tables are dropped

Orphaned FK constraints: 0
VERIFIED: No orphaned FK constraints

user_google_tokens row count after migration: 2
```

## Files Created/Modified

- `.planning/phases/10-auth-js-removal/10-01-DROP.sql` - Auditable DROP TABLE migration in FK-reverse order, wrapped in BEGIN/COMMIT

## Decisions Made

- **psql not installed**: Used Node.js `pg` driver instead — semantically equivalent, same DATABASE_URL connection string, same SSL settings. No behavior difference for DDL execution.
- **Pre-flight gate satisfied**: 2 rows in `user_google_tokens` confirmed. If this had been 0, migration would have been halted per the plan's threat model (T-10-03).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used Node.js pg driver as psql substitute**
- **Found during:** Task 2 (Execute DROP migration)
- **Issue:** `psql` binary is not installed on this developer machine; `which psql` returned nothing
- **Fix:** Executed the SQL file via a Node.js script using the `pg` package (already a project dependency), which is installed and available. Same DATABASE_URL, same SSL configuration, same transaction semantics.
- **Files modified:** None (runtime fix, no file changes needed)
- **Verification:** Migration executed successfully; all verification queries returned expected results
- **Committed in:** N/A (no file changes; documented here)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Fix required because psql was unavailable. Node.js pg is a first-class Postgres client with identical transaction semantics. No functional difference.

## Issues Encountered

None beyond the psql-not-installed deviation documented above.

## Next Phase Readiness

- Auth.js tables are gone from the database — Plan 02 (schema file deletion) is unblocked
- `src/db/schema/auth.ts` still exists in source — Plan 02 will delete it
- No orphaned FK constraints; domain tables (children, schedules, schedule_entries, gcal_events, user_google_tokens) are unaffected
- Both parents' Google tokens are safe in `user_google_tokens` (2 rows)

---
*Phase: 10-auth-js-removal*
*Completed: 2026-05-15*
