---
phase: 08-supabase-auth-stack
plan: 08
type: execute
wave: 5
depends_on: [04, 05, 06, 07]
files_modified: []
autonomous: false
requirements: [SAUTH-01, SAUTH-02, SAUTH-03, SAUTH-04, SAUTH-05, SAUTH-06, SAUTH-07, GCAL-01, GCAL-02]
tags: [gate, checkpoint, human-verify, end-to-end]

must_haves:
  truths:
    - "All 5 GATE criteria from ROADMAP.md Phase 8 success criteria are confirmed working by the human"
    - "Phase 9 (RLS) is unblocked only after this gate passes"
    - "STATE.md records the GATE pass and unblocks Phase 9"
  artifacts:
    - path: ".planning/phases/08-supabase-auth-stack/08-08-SUMMARY.md"
      provides: "Recorded result (PASS/FAIL) for each of the 5 GATE tests"
      contains: "PASS"
  key_links:
    - from: ".planning/phases/08-supabase-auth-stack/08-08-SUMMARY.md"
      to: ".planning/STATE.md"
      via: "human-recorded GATE pass annotation in STATE.md"
      pattern: "Phase 8.*GATE"
---

<objective>
**[BLOCKING — HUMAN GATE]** This plan is the formal Phase 8 → Phase 9 gate from ROADMAP.md. It runs no code itself; instead, it pauses the workflow and presents a checklist of 5 end-to-end behaviors that the human must verify in a real browser against the running app. Phase 9 (Row Level Security) MUST NOT begin until every box is checked.

The 5 criteria, copied verbatim from ROADMAP.md §Phase 8 Success Criteria, also satisfy every requirement ID for this phase: SAUTH-01..07, GCAL-01, GCAL-02.

Why a human gate (not automation): SAUTH-01 (Google consent screen), SAUTH-04 (browser redirect behavior), SAUTH-07 (visual banner state), and GCAL-01 (calendar event appearance in Google Calendar) involve external systems (Google OAuth, Google Calendar UI) that cannot be reliably scripted in a Vitest/Playwright run inside this project's current setup. Phase 9 RLS is a one-way door — once domain-table policies are turned on, debugging an undiscovered Phase 8 regression becomes harder. The gate protects against that.

Output: Confirmation that all 5 criteria pass, or a list of failures that block Phase 9. Failures route to gap closure (`/gsd-plan-phase --gaps`).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/08-supabase-auth-stack/08-CONTEXT.md
@.planning/phases/08-supabase-auth-stack/08-RESEARCH.md

<interfaces>
<!-- Operational pre-requisites the human must complete BEFORE running these tests
     (these are tracked in STATE.md "Pending Todos (Operational — pre-deploy)"; do
     them in the Supabase / Google Cloud dashboards): -->

1. Supabase Dashboard → Authentication → Providers → Google: enable, paste
   client_id and client_secret from Google Cloud Console.

2. Supabase Dashboard → Authentication → URL Configuration → Redirect URLs:
   add the local dev origin (e.g. http://localhost:3000/auth/callback) and any
   preview/prod origins (e.g. https://*.vercel.app/auth/callback).

3. Google Cloud Console → APIs & Services → Credentials → OAuth client →
   Authorized redirect URIs: ensure the Supabase callback URL is listed —
   `https://<your-project-ref>.supabase.co/auth/v1/callback`. This is Supabase's
   own callback, NOT the Next.js /auth/callback.

4. Local .env.local (or deployment env) has:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - DATABASE_URL (existing)
   - AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET (existing — used by GCal token exchange)
   - PARENT_FATHER_EMAIL, PARENT_MOTHER_EMAIL, PARENT_FATHER_CALENDAR_ID,
     PARENT_MOTHER_CALENDAR_ID (existing)
   - APP_CALENDAR_OWNER_EMAIL (NEW in Phase 8 — set to the owner's email per D-01;
     omit to fall back to per-parent-owns-own-calendar mode)

5. The calendar owner's Google account must have write access to BOTH calendars
   referenced by PARENT_FATHER_CALENDAR_ID and PARENT_MOTHER_CALENDAR_ID, OR each
   parent owns their own calendar and APP_CALENDAR_OWNER_EMAIL is unset (legacy mode).
</interfaces>
</context>

<tasks>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 1: [GATE] Phase 8 → Phase 9 — verify all 5 success criteria</name>
  <what-built>
    - Plan 01: user_google_tokens Drizzle schema + db registration.
    - Plan 02: Supabase server + middleware client helpers.
    - Plan 03: user_google_tokens table pushed to live database.
    - Plan 04: Middleware swap, /auth/callback route, /auth/error page, sign-in button, home page redirect.
    - Plan 05: Header, signOutAction, requireAuthorizedParent — all on Supabase getUser().
    - Plan 06: AppConfig.ownerEmail field, generate-app-config.js update, buildGCalClient(ownerEmail) reads user_google_tokens, sync.ts passes ownerEmail.
    - Plan 07: Dashboard owner-token warning banner with sign-in CTA.

    Net result: Auth.js is no longer in any active code path for authentication. Supabase
    OAuth handles sign-in; Supabase cookies persist sessions; user_google_tokens is the
    new home for Google refresh tokens; GCal sync uses the configured owner's token.
    Auth.js packages remain installed (Phase 10 removes them).
  </what-built>
  <how-to-verify>
**PRE-FLIGHT (do these before running the 5 tests):**

a. Confirm operational setup is complete (see `<interfaces>` block above — Supabase Dashboard, Google Cloud Console, .env.local).

b. Drop any existing `user_google_tokens` rows so you start from a clean slate (this lets you observe the row appearing on first sign-in):
   ```bash
   node -e "const {Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});p.query('DELETE FROM user_google_tokens').then(r=>{console.log('Deleted',r.rowCount,'token rows');return p.end();}).catch(e=>{console.error(e.message);process.exit(1);});"
   ```

c. Clear Auth.js cookies in your browser so they don't interfere (DevTools → Application → Cookies → delete any cookie starting with `next-auth.`).

d. Start the dev server:
   ```bash
   npm run dev
   ```

---

body
