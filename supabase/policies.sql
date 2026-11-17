-- supabase/policies.sql
-- Row Level Security policies for vuoroasuminen.
--
-- HOW TO RUN
--   Open Supabase Dashboard → SQL editor (or psql with DATABASE_URL), paste this whole
--   file and run it. It runs in one transaction and is idempotent: re-running it drops
--   and recreates every policy, so it is safe to run again after any schema change.
--   Re-run it after `npm run db:push` creates a new table, and add the table here first.
--
-- VERIFY
--   Dashboard → Advisors → Security should report no rls_disabled_in_public issues.
--
-- CONVENTIONS
--   - This project does NOT use the Supabase CLI migration system (D-01).
--     This file is the canonical, git-tracked record of all RLS DDL.
--   - Drizzle schema changes use `npm run db:push` (D-02).
--
-- WHO BYPASSES RLS
--   - Server-side code (Server Actions, GCal sync, proxy) uses the Drizzle connection
--     from DATABASE_URL, which runs as `postgres` and bypasses RLS. That is intentional.
--   - RLS protects the PostgREST / Realtime API, which anyone holding the public anon
--     key can call:
--       (a) anon:          no access to anything.
--       (b) authenticated: any Google account can sign in through Supabase Auth, so
--                          the shared tables are limited to the two parents listed in
--                          family_config (public.is_family_member()).
--
-- WHAT THE BROWSER/API ACTUALLY NEEDS
--   - Realtime postgres_changes on schedule_entries and day_notes (SELECT, family only).
--   - /auth/callback upserts the caller's own row in user_google_tokens
--     (INSERT + UPDATE + SELECT on their own email). This happens before invite
--     redemption, so it must not depend on family_config.

BEGIN;

-- =====================================================================
-- Helper: is the caller one of the two parents in family_config?
-- SECURITY DEFINER so it can read family_config regardless of that table's RLS.
-- =====================================================================

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
-- Enable RLS on every public table, and take away anon's table privileges.
-- RLS does not cover TRUNCATE, so revoke it explicitly.
-- =====================================================================

ALTER TABLE public.children           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_entries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.day_notes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gcal_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_config      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_tokens      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_google_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON
  public.children, public.schedules, public.schedule_entries, public.day_notes,
  public.gcal_events, public.family_config, public.invite_tokens, public.user_google_tokens
  FROM anon;

REVOKE TRUNCATE, TRIGGER, REFERENCES ON
  public.children, public.schedules, public.schedule_entries, public.day_notes,
  public.gcal_events, public.family_config, public.invite_tokens, public.user_google_tokens
  FROM authenticated;

-- =====================================================================
-- Shared domain tables: the two parents can read and write all rows.
-- =====================================================================

DO $$
DECLARE
  t text;
  p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['children', 'schedules', 'schedule_entries', 'day_notes', 'gcal_events']
  LOOP
    -- Drop every existing policy on the table (including older "authenticated can ..." ones)
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
         USING (public.is_family_member()) WITH CHECK (public.is_family_member())',
      'family members can access ' || t, t);
  END LOOP;
END $$;

-- =====================================================================
-- family_config: the parents can read it; writes only via the server (postgres).
-- =====================================================================

DROP POLICY IF EXISTS "authenticated can select family_config" ON public.family_config;
DROP POLICY IF EXISTS "family members can read family_config" ON public.family_config;
CREATE POLICY "family members can read family_config"
  ON public.family_config FOR SELECT TO authenticated
  USING (public.is_family_member());

-- =====================================================================
-- invite_tokens: users can read only tokens they created; writes via the server.
-- =====================================================================

DROP POLICY IF EXISTS "user can select own invite tokens" ON public.invite_tokens;
CREATE POLICY "user can select own invite tokens"
  ON public.invite_tokens FOR SELECT TO authenticated
  USING (lower(auth.jwt() ->> 'email') = lower(created_by));

-- =====================================================================
-- user_google_tokens: per-user isolation by JWT email claim (D-08).
-- No DELETE policy: token rows are never deleted through the API.
-- =====================================================================

DROP POLICY IF EXISTS "user can select own token" ON public.user_google_tokens;
DROP POLICY IF EXISTS "user can insert own token" ON public.user_google_tokens;
DROP POLICY IF EXISTS "user can update own token" ON public.user_google_tokens;

CREATE POLICY "user can select own token"
  ON public.user_google_tokens FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'email') = email);

CREATE POLICY "user can insert own token"
  ON public.user_google_tokens FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') = email);

CREATE POLICY "user can update own token"
  ON public.user_google_tokens FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'email') = email)
  WITH CHECK ((auth.jwt() ->> 'email') = email);

-- =====================================================================
-- Constraints Drizzle Kit does not generate from the schema.
-- =====================================================================

ALTER TABLE public.family_config DROP CONSTRAINT IF EXISTS family_config_single_row;
ALTER TABLE public.family_config ADD CONSTRAINT family_config_single_row CHECK (id = 1);

ALTER TABLE public.day_notes DROP CONSTRAINT IF EXISTS day_notes_valid_range;
ALTER TABLE public.day_notes ADD CONSTRAINT day_notes_valid_range CHECK (end_day >= start_day);

-- =====================================================================
-- Supabase Realtime publication: Postgres Changes for the browser client.
-- =====================================================================

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['schedule_entries', 'day_notes']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

COMMIT;
