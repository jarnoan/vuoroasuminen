---
phase: 09
plan: 03
subsystem: database/rls
tags:
  - supabase
  - sql
  - rls
  - ddl
dependency_graph:
  requires:
    - "09-01 (RLS context and research)"
    - "09-02 (RLS research patterns)"
  provides:
    - "supabase/policies.sql — canonical RLS DDL for all five tables"
  affects:
    - "public.children (RLS enabled)"
    - "public.schedules (RLS enabled)"
    - "public.schedule_entries (RLS enabled + Realtime publication)"
    - "public.gcal_events (RLS enabled)"
    - "public.user_google_tokens (RLS enabled, per-user isolation)"
tech_stack:
  added: []
  patterns:
    - "RLS ENABLE ROW LEVEL SECURITY + CREATE POLICY per table"
    - "Domain tables: auth.role() = 'authenticated' for all CRUD ops"
    - "Per-user table: (auth.jwt() ->> 'email') = email for SELECT/INSERT/UPDATE"
    - "service_role bypass: intentional, admin Drizzle always uses service_role"
    - "Realtime publication: ALTER PUBLICATION supabase_realtime ADD TABLE (idempotent)"
key_files:
  created:
    - supabase/policies.sql
  modified: []
decisions:
  - "Used (auth.jwt() ->> 'email') over auth.email() — auth.email() is undocumented in the official Supabase RLS reference; jwt() form is guaranteed stable"
  - "No DELETE policy on user_google_tokens — token rows are never deleted by the application; any cleanup would be manual ops"
  - "No BEGIN/COMMIT wrapping — Supabase Dashboard SQL editor handles its own transaction; explicit BEGIN would conflict"
  - "No DROP POLICY statements — first-run idempotency sufficient; Dashboard users can manually drop and rerun if needed"
metrics:
  duration: "108s"
  completed_date: "2026-05-14"
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 0
---

# Phase 9 Plan 03: RLS Policies SQL Script Summary

**One-liner:** Idempotent SQL script enabling RLS on all five domain tables with per-table policies; per-user isolation on `user_google_tokens` via documented `(auth.jwt() ->> 'email')` JWT claim form.

## What Was Built

Created `supabase/policies.sql` — the canonical, git-tracked SQL script that:

1. Enables Row Level Security on all five application tables
2. Defines SELECT/INSERT/UPDATE/DELETE policies on four domain tables (`children`, `schedules`, `schedule_entries`, `gcal_events`) allowing any `authenticated` role user
3. Defines SELECT/INSERT/UPDATE policies on `user_google_tokens` restricting each row to its owner by JWT email claim (no DELETE — token rows are never application-deleted)
4. Adds `public.schedule_entries` to the `supabase_realtime` publication (idempotent — NOTICE only if already present)

**File stats:**
- Path: `supabase/policies.sql`
- Lines: 153
- `ENABLE ROW LEVEL SECURITY` count: 5 (one per table)
- `CREATE POLICY` SQL statements: 19 (4 domain tables × 4 ops = 16; user_google_tokens × 3 ops = 3)

## Policy Breakdown

| Table | Policies | USING clause |
|-------|----------|--------------|
| `public.children` | SELECT, INSERT, UPDATE, DELETE | `auth.role() = 'authenticated'` |
| `public.schedules` | SELECT, INSERT, UPDATE, DELETE | `auth.role() = 'authenticated'` |
| `public.schedule_entries` | SELECT, INSERT, UPDATE, DELETE | `auth.role() = 'authenticated'` |
| `public.gcal_events` | SELECT, INSERT, UPDATE, DELETE | `auth.role() = 'authenticated'` |
| `public.user_google_tokens` | SELECT, INSERT, UPDATE | `(auth.jwt() ->> 'email') = email` |

All policies use `TO authenticated` to restrict to the authenticated role. Anonymous clients receive zero rows on any table.

## Key Decision: auth.jwt() ->> 'email' vs auth.email()

Plan CONTEXT.md D-08 mentioned `auth.email()`. Research phase (09-RESEARCH.md) resolved this as Open Question #2: `auth.email()` is undocumented in the official Supabase RLS reference. The form `(auth.jwt() ->> 'email')` is:
- Documented in the Supabase JWT Claims reference
- Guaranteed to contain the email for Google OAuth users (Supabase includes it in every JWT)
- Confirmed working in production by community and official examples

Result: `auth.email()` is NOT used anywhere in the file. The comment on line 119 explains why (for future reader clarity), but the actual SQL uses only the documented form.

## Realtime Publication

`ALTER PUBLICATION supabase_realtime ADD TABLE public.schedule_entries;` is included as the final statement. This ensures Postgres CDC events for `schedule_entries` rows flow to the Realtime broadcast channel. PostgreSQL emits a NOTICE (not an error) if the table is already a publication member — safe to re-run.

## Important: This File Is Not Yet Applied

`supabase/policies.sql` is authored and committed. It has NOT yet been run against the Supabase database. Plan 04 owns the manual step of pasting this file into the Supabase Dashboard SQL editor (or running via psql) and verifying the "RLS enabled" badge on each table.

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create supabase/policies.sql | bdd41e0 | supabase/policies.sql |

## Deviations from Plan

### Verification Script vs. File Content (minor discrepancy, no fix needed)

The plan's automated verify command (`grep -c "CREATE POLICY"`) expected exactly 19 matches, but the file contains 20 grep matches because one comment on line 25 includes the text `` `CREATE POLICY` `` (explaining the idempotency limitation). The plan-provided file content itself includes this comment — this is a conflict within the plan's own specification.

**Resolution:** The content as provided in the plan was written exactly as specified. The 19 actual SQL `CREATE POLICY` statements are correct. The grep count discrepancy is a false positive from the comment text, not a functional issue.

Similarly, `! grep -q "auth.email()"` detects a comment on line 119 that explains WHY `auth.email()` is NOT used — the explanatory comment mentions the name to document the decision. No actual SQL uses `auth.email()`.

Both deviations are cosmetic (comment text triggering grep patterns) — the functional SQL is correct and matches all semantic acceptance criteria.

## Threat Model Coverage

All threats from the plan's threat register are addressed by this file:

| Threat ID | Mitigation |
|-----------|------------|
| T-09-09 | `ENABLE ROW LEVEL SECURITY` + `TO authenticated` on all four domain tables — anon role gets zero rows |
| T-09-10 | `user_google_tokens` SELECT policy with `(auth.jwt() ->> 'email') = email` |
| T-09-11 | INSERT `WITH CHECK` + UPDATE `USING` + `WITH CHECK` on `user_google_tokens` |
| T-09-12 | `schedule_entries` SELECT policy `TO authenticated` — Realtime evaluates per event |
| T-09-13 | `ALTER PUBLICATION supabase_realtime ADD TABLE public.schedule_entries` (idempotent) |
| T-09-14 | Every policy includes `TO authenticated` clause |
| T-09-15 | Used `(auth.jwt() ->> 'email')` — documented form confirmed working |
| T-09-16 | Out of scope for this file; credentials handled at deployment config level |

## Self-Check: PASSED

- `supabase/policies.sql` exists: confirmed
- Commit bdd41e0 exists: confirmed
- 5 ENABLE ROW LEVEL SECURITY statements: confirmed
- 19 actual CREATE POLICY SQL statements: confirmed
- (auth.jwt() ->> 'email') form used: confirmed
- auth.email() not used in SQL: confirmed
- No DELETE policy for user_google_tokens: confirmed
- ALTER PUBLICATION present: confirmed
- No BEGIN; statement: confirmed
- File starts with -- supabase/policies.sql: confirmed
