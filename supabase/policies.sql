-- supabase/policies.sql
-- Row Level Security policies for vuoroasuminen (v1.2 milestone, Phase 9)
--
-- HOW TO RUN
--   1. Open Supabase Dashboard → SQL editor (or use psql with the project connection string).
--   2. Paste the contents of this file and run the whole script in a single transaction.
--   3. Verify in Dashboard → Table editor that the green "RLS enabled" badge appears on each
--      of: children, schedules, schedule_entries, gcal_events, user_google_tokens.
--
-- CONVENTIONS
--   - This project does NOT use the Supabase CLI migration system (D-01).
--     This file is the canonical, git-tracked record of all RLS DDL.
--   - This project uses `npm run db:push` for Drizzle schema changes (D-02);
--     RLS policies live here, alongside the Drizzle schema files.
--
-- SERVICE ROLE
--   - The application uses an admin Drizzle connection (SUPABASE_SERVICE_ROLE_KEY)
--     for all server-side reads and writes (Server Actions, GCal sync).
--   - The service_role role bypasses ALL of the policies below — this is intentional
--     (Phase 8 D-11, Phase 9 D-07, D-10). RLS protects:
--       (a) the anon role (unauthenticated PostgREST / Realtime clients), and
--       (b) the authenticated role (browser sessions; user_google_tokens per-user).
--
-- IDEMPOTENCY
--   - `CREATE POLICY` errors if the policy name already exists. To re-run cleanly,
--     either drop existing policies first or use the Supabase Dashboard's editor
--     which lets you delete and recreate. The `ALTER TABLE ... ENABLE ROW LEVEL
--     SECURITY` and `ALTER PUBLICATION ... ADD TABLE` statements ARE idempotent in
--     PostgreSQL when re-run on already-enabled tables (no-op).

-- =====================================================================
-- Domain tables: any authenticated user can read/write all rows.
-- Per-household isolation is explicitly deferred (REQUIREMENTS.md Out of Scope).
-- =====================================================================

-- ---------- children ----------
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can select children"
  ON public.children FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated can insert children"
  ON public.children FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated can update children"
  ON public.children FOR UPDATE TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated can delete children"
  ON public.children FOR DELETE TO authenticated
  USING (auth.role() = 'authenticated');

-- ---------- schedules ----------
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can select schedules"
  ON public.schedules FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated can insert schedules"
  ON public.schedules FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated can update schedules"
  ON public.schedules FOR UPDATE TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated can delete schedules"
  ON public.schedules FOR DELETE TO authenticated
  USING (auth.role() = 'authenticated');

-- ---------- schedule_entries ----------
ALTER TABLE public.schedule_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can select schedule_entries"
  ON public.schedule_entries FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated can insert schedule_entries"
  ON public.schedule_entries FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated can update schedule_entries"
  ON public.schedule_entries FOR UPDATE TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated can delete schedule_entries"
  ON public.schedule_entries FOR DELETE TO authenticated
  USING (auth.role() = 'authenticated');

-- ---------- gcal_events ----------
ALTER TABLE public.gcal_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can select gcal_events"
  ON public.gcal_events FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated can insert gcal_events"
  ON public.gcal_events FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated can update gcal_events"
  ON public.gcal_events FOR UPDATE TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated can delete gcal_events"
  ON public.gcal_events FOR DELETE TO authenticated
  USING (auth.role() = 'authenticated');

-- =====================================================================
-- user_google_tokens: per-user isolation by JWT email claim (D-08).
--
-- Note: D-08 mentions `auth.email()`. That helper is NOT documented in the
-- official Supabase RLS reference. The form `(auth.jwt() ->> 'email')` is
-- documented and guaranteed correct (Supabase JWT always includes the
-- `email` claim for users signed in via Google OAuth).
--
-- No DELETE policy: token rows are never deleted by the application.
-- GCal sync reads these rows via admin Drizzle (service_role) — bypasses
-- RLS by design (D-07).
-- =====================================================================

ALTER TABLE public.user_google_tokens ENABLE ROW LEVEL SECURITY;

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
-- Supabase Realtime publication — schedule_entries must be included so
-- Postgres Changes emits CDC events to the browser client.
--
-- ALTER PUBLICATION ... ADD TABLE is idempotent in PostgreSQL: running
-- it on a table that is already a member emits a NOTICE but does not
-- error. Safe to re-run.
-- =====================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.schedule_entries;

-- =====================================================================
-- Phase 12 additions: family_config + invite_tokens
-- =====================================================================
-- family_config is a single-row table. The CHECK (id = 1) constraint
-- enforces single-row at the DB level (drizzle-kit does not generate
-- CHECK constraints from schema — must be added manually after push).
-- =====================================================================

ALTER TABLE public.family_config
  ADD CONSTRAINT family_config_single_row CHECK (id = 1);

-- ---------- family_config RLS ----------
-- Authenticated users can read; only service role writes (D-14, ONBOARDING-STACK.md §RLS).
-- The onboarding wizard's saveWizardConfig Server Action uses the admin Drizzle
-- connection which runs as service_role and bypasses RLS.

ALTER TABLE public.family_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can select family_config"
  ON public.family_config FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

-- No INSERT/UPDATE/DELETE policy for authenticated role on family_config.
-- Writes happen only via service_role from saveWizardConfig (D-14).

-- ---------- invite_tokens RLS ----------
-- Users can read only invite tokens they themselves created. All writes happen
-- via service_role (Phase 13 will add the invite generation/acceptance logic).

ALTER TABLE public.invite_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user can select own invite tokens"
  ON public.invite_tokens FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'email') = created_by);
