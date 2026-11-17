-- supabase/policies.sql
-- Database security setup that Drizzle cannot manage.
--
-- WHERE THE RULES LIVE
--   - RLS, policies and CHECK constraints are declared in the Drizzle schema
--     (src/db/schema/*.ts, see the RLS note in domain.ts), so `npm run db:push` keeps them.
--     Before they were declared there, every push silently disabled RLS and dropped them.
--   - This file holds the rest: the is_family_member() helper the policies call, the table
--     grants for Supabase's anon / authenticated roles, and the Realtime publication.
--
-- WHEN TO RUN
--   - Fresh database: run it BEFORE the first `npm run db:push` (the policies push creates
--     call is_family_member()), and again AFTER that push (grants and publication need the
--     tables).
--   - After a push that adds a table: run it again so anon loses access to the new table.
--   It is idempotent and runs in one transaction: Supabase Dashboard → SQL editor, or psql
--   with DATABASE_URL.
--
-- VERIFY
--   Dashboard → Advisors → Security should report no rls_disabled_in_public issues.
--
-- WHO BYPASSES RLS
--   Server-side code (Server Actions, GCal sync, proxy) uses the Drizzle connection from
--   DATABASE_URL, which runs as `postgres` and bypasses RLS. RLS and these grants protect the
--   PostgREST / Realtime API, which anyone holding the public anon key can call. Nothing in
--   the app uses the API as anon.

BEGIN;

-- =====================================================================
-- is_family_member(): is the caller one of the two parents in family_config?
-- SECURITY DEFINER so it can read family_config regardless of that table's RLS.
-- Body checking is off so this can run before family_config exists (fresh database).
-- =====================================================================

SET LOCAL check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.is_family_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_config
    WHERE id = 1
      AND lower(auth.jwt() ->> 'email') IN (lower(parent1_email), lower(parent2_email))
  );
$$;

REVOKE ALL ON FUNCTION public.is_family_member() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_family_member() TO authenticated;

-- =====================================================================
-- Grants. Supabase grants anon and authenticated full privileges on every new public
-- table by default; RLS limits rows, but anon should not reach the tables at all, and
-- RLS does not cover TRUNCATE.
-- =====================================================================

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM authenticated;

-- Tables that `db:push` creates later (as postgres) start without anon access.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM authenticated;

-- =====================================================================
-- Supabase Realtime publication: Postgres Changes for the browser client.
-- Skips tables that do not exist yet (fresh database, before the first push).
-- =====================================================================

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['schedule_entries', 'day_notes']
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

COMMIT;
