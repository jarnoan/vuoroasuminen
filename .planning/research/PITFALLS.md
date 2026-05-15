# Pitfalls Research

**Domain:** Co-parenting custody scheduling web app with Google Calendar integration and real-time collaboration
**Researched:** 2026-04-04 (original); 2026-05-09 (v1.2 migration supplement); 2026-05-15 (v1.3 Vercel deployment)
**Confidence:** HIGH (OAuth/Calendar API behavior verified against official Google docs; real-time patterns from multiple corroborating sources; migration pitfalls verified against Supabase official docs and open GitHub issues; v1.3 pitfalls verified against Next.js 16 upgrade guide, Supabase production docs, and codebase inspection)

---

## v1.3 Vercel Deployment Pitfalls

**Stack:** Next.js 16, Supabase Auth (Google OAuth PKCE), Drizzle ORM, Supabase Realtime + RLS, googleapis GCal sync
**Environments:** staging Supabase project (Vercel preview) + production Supabase project (Vercel production)
**First Vercel deploy — no previous cloud environment exists**

---

### V-1: Google OAuth redirect URIs not updated for production domain (CRITICAL)

**What goes wrong:**
`redirect_uri_mismatch` error immediately after clicking "Sign in with Google" on the production URL. Auth works on localhost but fails on Vercel.

**Why it happens:**
Google Cloud Console "Authorized redirect URIs" still lists only `http://localhost:3000/auth/callback`. Google does not support wildcards in redirect URIs — every origin must be listed explicitly. Supabase handles the PKCE handoff, but Google's redirect check is independent and happens first.

**Prevention:**
- In Google Cloud Console → Credentials → your OAuth 2.0 Client ID, add all three:
  - `http://localhost:3000/auth/callback` (keep existing)
  - `https://<production-domain>.vercel.app/auth/callback`
  - `https://<your-custom-domain>/auth/callback` (if using a custom domain)
- In "Authorized JavaScript origins", add the base URLs (no path, no wildcard) for the same origins.
- Repeat for a staging OAuth client if you create a separate one (recommended for isolation — see V-3).
- Do this before first deploy attempt. Google propagation takes up to a few minutes.

**Phase:** v1.3 Phase 1 (environment setup), before any deploy smoke test.

---

### V-2: Supabase Auth "Redirect URLs" allowlist missing production and preview patterns (CRITICAL)

**What goes wrong:**
After Google OAuth consent, Supabase redirects back to `/auth/callback` with a valid `code`, but then errors or silently drops the session. Seen even when Google's side is correctly configured. The two allowlists (Google and Supabase) are independent — passing Google's check does not guarantee Supabase's.

**Why it happens:**
Supabase has its own allowlist under Authentication → URL Configuration → "Redirect URLs". The staging and production Supabase projects each have independent allowlists that start empty (or only containing the project default).

**Prevention — production Supabase project:**
- Set "Site URL" to `https://<production-domain>`
- Add to Redirect URLs:
  - `https://<production-domain>/auth/callback`
  - `http://localhost:3000/auth/callback`

**Prevention — staging Supabase project:**
- Add to Redirect URLs:
  - `https://<vercel-project>-*.vercel.app/auth/callback` — the `*` glob matches the hash portion of preview URLs (e.g., `vuoroasuminen-abc123-yourteam.vercel.app`)
  - For deeper path matching use `**` (globstar matches across path separators)
  - `http://localhost:3000/auth/callback`

**Phase:** v1.3 Phase 1. Verify in Phase 2 smoke test by completing a full OAuth flow on a preview deployment.

---

### V-3: Both environments share one Google OAuth client — staging tokens can interfere with production (CRITICAL)

**What goes wrong:**
If `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are identical across environments but Supabase projects are separate, a sign-in on a preview deployment may attempt to write a `user_google_tokens` row to the wrong DB — or a revoked staging token could invalidate production GCal sync if a shared calendar owner email is involved.

**Why it happens:**
Vercel env vars default to "all environments" scope. If not explicitly scoped, all deployments (including previews) receive the same credentials and may hit the production Supabase project.

**Prevention:**
- The planned architecture (separate Supabase staging and production projects with per-environment Vercel env vars) handles DB isolation correctly. Confirm by verifying the Vercel env var scopes explicitly:
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DATABASE_URL` → set for "Production" scope pointing to production Supabase
  - Corresponding staging variants → set for "Preview" scope pointing to staging Supabase
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` can be the same across environments (same Google Cloud project), but their authorized redirect URIs in Google Cloud Console must cover both the production and preview URL patterns.
- If you want full audit trail isolation, create two separate Google OAuth credentials — one per environment.

**Phase:** v1.3 Phase 1. Confirm Vercel env var scoping in Phase 2 before any data is written.

---

### V-4: `DATABASE_URL` uses Supabase direct connection (port 5432) on Vercel serverless — pool exhaustion (CRITICAL)

**What goes wrong:**
App works fine on first requests after deploy, then starts throwing `too many clients` or connection timeout errors under any real load. Drizzle mutations that worked in dev silently time out.

**Why it happens:**
Vercel serverless functions do not maintain persistent DB connections. Every function invocation creates a new `pg.Pool`. The direct Postgres URL (port 5432) has a hard connection limit — typically 15–25 on Supabase free tier, 60 on Pro. With warm Vercel instances each holding a pool open, the limit exhausts quickly even for a two-parent app on heavy publish days.

**Prevention:**
- Use the **Supavisor pooler URL** (port 6543, transaction mode) for `DATABASE_URL` in Vercel env vars — this is the connection string intended for serverless.
- Keep the direct URL (port 5432) only for `drizzle-kit push`/`migrate` — Drizzle Kit needs a direct DDL-capable connection; do not use it for runtime queries.
- Supavisor transaction mode does not support named prepared statements. Drizzle uses parameterized queries, not named prepared statements, so this is compatible. No special flag needed (unlike Prisma which requires `?pgbouncer=true`).
- The current `ssl: { rejectUnauthorized: false }` in `src/db/index.ts` works with Supavisor.
- **Exception:** The Drizzle admin client used by GCal sync (`buildGCalClient` reads `user_google_tokens`) needs to bypass RLS. Use the direct connection URL (port 5432) for `DATABASE_URL` when running admin operations, OR ensure the Supavisor connection authenticates as a role with `BYPASSRLS`. The simplest v1.3 approach: use the direct URL for `DATABASE_URL` on Vercel (accepting the pool limit) given there are only two users, and revisit if connection errors appear.

**Phase:** v1.3 Phase 1. Critical to configure correctly before production traffic.

---

### V-5: Next.js 16 renames `middleware.ts` → `proxy.ts` (CRITICAL for route protection)

**What goes wrong:**
`src/middleware.ts` uses the deprecated filename in Next.js 16. The file still runs but generates deprecation warnings and will stop being recognized in a future minor release. If it silently stops running, unauthenticated users bypass route protection and reach the dashboard.

**Why it happens:**
Next.js 16 renamed the middleware convention to `proxy` to clarify its role as a network boundary proxy, and moved it to Node.js runtime (Edge Runtime is no longer supported for proxy). The old `middleware.ts` name is deprecated but not yet hard-removed.

**Prevention:**
- Rename `src/middleware.ts` → `src/proxy.ts`
- Rename the exported function from `middleware` to `proxy`
- The `config.matcher` export keeps the same structure
- Config flag renames: `skipMiddlewareUrlNormalize` → `skipProxyUrlNormalize`
- The current code already runs implicitly on Node.js (no `export const runtime = "edge"`), so no runtime change needed
- Run the codemod to handle this automatically: `npx @next/codemod@canary upgrade latest`

**Phase:** v1.3 Phase 1 (pre-deploy preparation). Do this before the first Vercel build.

---

### V-6: `supabase_realtime` publication not enabled for `schedule_entries` on new Supabase projects (CRITICAL for Realtime)

**What goes wrong:**
`RealtimeProvider` subscribes successfully (channel status = `SUBSCRIBED`, no errors) but no `postgres_changes` events fire when a parent edits a cell. The other parent's browser never updates.

**Why it happens:**
Supabase Realtime requires tables to be explicitly added to the `supabase_realtime` logical replication publication. New Supabase projects start with no tables in the publication. This is a database-level configuration, not a Drizzle migration, so `drizzle-kit migrate` does not apply it.

**Prevention:**
After running Drizzle migrations on each new project, execute:
```sql
alter publication supabase_realtime add table schedule_entries;
```
Verify: Supabase Dashboard → Database → Replication → supabase_realtime → confirm `schedule_entries` is listed.

Add this to the deployment runbook as a manual post-migration step, once per Supabase project.

**Phase:** v1.3 Phase 2 (DB setup). Verify in Phase 3 realtime smoke test: open two browser windows, edit a cell, confirm the other window updates within 1 second.

---

### V-7: `SUPABASE_SERVICE_ROLE_KEY` accidentally exposed via `NEXT_PUBLIC_` prefix (CRITICAL security)

**What goes wrong:**
No build error. The service role key appears in the browser JavaScript bundle, bypassing all RLS policies. Any user with DevTools can read or delete all rows in every table.

**Why it happens:**
`NEXT_PUBLIC_*` env vars are inlined into the client bundle at build time. This was confirmed as root cause of CVE-2025-48757 (Lovable AI platform incident: 170 apps, 13K users exposed) where AI-generated code suggested the wrong prefix.

**Prevention:**
- `SUPABASE_SERVICE_ROLE_KEY` must never carry the `NEXT_PUBLIC_` prefix
- The current codebase correctly does not expose this key (it is used only by Drizzle migration scripts, not by the application itself)
- When setting Vercel env vars, assign `SUPABASE_SERVICE_ROLE_KEY` as a "Server" env var only
- Audit every env var before adding to Vercel: anything touching the DB directly (`DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_CLIENT_SECRET`) must not be `NEXT_PUBLIC_`

**Phase:** v1.3 Phase 1 env var setup. Treat as a pre-deploy checklist item.

---

### V-8: Supabase free tier pauses after 7 days of inactivity — production app goes offline

**What goes wrong:**
App returns blank screen after a week of low usage. Both parents see errors. Reactivation requires a Supabase dashboard visit and a 30+ second cold start.

**Prevention:**
- Upgrade the **production** Supabase project to Pro ($25/mo) before handing the app to real users. Pro removes the inactivity pause.
- The **staging** project can stay on Free as long as it is actively used during preview testing.
- PROJECT.md already flags this — it must be actioned, not deferred.

**Phase:** v1.3 Phase 1 (platform setup). Non-negotiable before user handoff.

---

### V-9: RLS policies and GRANT statements missing on new Supabase projects

**What goes wrong:**
After running Drizzle migrations on the new staging/production project, all PostgREST queries return empty arrays or 403 errors. RLS is enabled but the `authenticated` role has no permission to read the tables.

**Why it happens:**
Since a May 2024 Supabase breaking change, new projects no longer auto-grant `SELECT/INSERT/UPDATE/DELETE` on new tables to the `anon` and `authenticated` roles. Your existing dev project predates this change or was manually fixed; new projects start with no grants. Postgres rejects the query before RLS even runs when grants are absent.

**Prevention:**
After running Drizzle migrations on each new project, verify grants and add them if missing:
```sql
-- Verify
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public';

-- Fix if missing
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.children, public.schedules, public.schedule_entries,
     public.gcal_events, public.user_google_tokens
  TO authenticated;
```

Consider adding these GRANTs as a dedicated Drizzle migration so they travel with the schema automatically.

**Phase:** v1.3 Phase 2 (DB setup). Test immediately after migration: sign in as a parent and verify the schedule table loads data.

---

### V-10: Realtime JWT expires — second parent's browser silently stops receiving updates

**What goes wrong:**
One parent makes edits; the other parent's browser stops updating silently after ~1 hour (default Supabase JWT expiry). No error shown. Requires a page refresh to reconnect.

**Why it happens:**
Supabase Realtime disconnects a client when the JWT used to establish the WebSocket expires. The current `RealtimeProvider` calls `supabase.realtime.setAuth(session.access_token)` exactly once at component mount and never refreshes it. Middleware refreshes the session cookie for Server Components, but the browser's Realtime WebSocket connection is separate.

**Current code path:**
`realtime-provider.tsx` → `supabase.auth.getSession()` (one-time, in `useEffect`) → `supabase.realtime.setAuth(token)` (set once). No listener for session refresh events.

**Prevention:**
Add an `onAuthStateChange` listener in `RealtimeProvider` that calls `supabase.realtime.setAuth(newToken)` whenever the session renews:
```typescript
const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
  if (session?.access_token) {
    supabase.realtime.setAuth(session.access_token)
  }
})
// Clean up in the useEffect return:
return () => { subscription.unsubscribe(); /* ... channel cleanup */ }
```

**Phase:** v1.3 Phase 3 (realtime verification). Test by leaving the app open for 90 minutes and confirming changes still propagate from one browser to the other.

---

### V-11: `config/app.ts` calendar IDs not validated at startup — GCal sync targets wrong or missing calendar

**What goes wrong:**
GCal sync runs without error but events appear in the wrong calendar or the googleapis call silently fails. `PARENT_FATHER_CALENDAR_ID` or `PARENT_MOTHER_CALENDAR_ID` env vars not set in Vercel, so `calendarId` is `undefined` at runtime, and the TypeScript `!` assertion does not throw — it passes `undefined` to the GCal API.

**Why it happens:**
`src/env.ts` validates `PARENT_FATHER_EMAIL`, `PARENT_MOTHER_EMAIL`, `APP_CHILDREN`, and `APP_START_DATE` at startup, but `PARENT_FATHER_CALENDAR_ID`, `PARENT_MOTHER_CALENDAR_ID`, `PARENT_FATHER_NAME`, and `PARENT_MOTHER_NAME` are not in the required list. They are accessed with `!` assertions in `config/app.ts` which silently allow `undefined`.

**Prevention:**
- Add `PARENT_FATHER_CALENDAR_ID` and `PARENT_MOTHER_CALENDAR_ID` to the required env var list in `src/env.ts`
- Set all `PARENT_*` and `APP_*` env vars in Vercel before deploying
- Include a "first publish smoke test" step in the deployment runbook to confirm GCal events appear in the correct calendars after publish

**Phase:** v1.3 Phase 1 env var setup. Validate at Phase 3 smoke test.

---

### V-12: Google OAuth app in "Testing" mode — second parent blocked (COMMON, time-sensitive)

**What goes wrong:**
Developer (parent 1) can sign in. Parent 2 sees "Google hasn't verified this app" warning. If the app is still in Testing mode with an explicit test user list, parent 2 may be completely blocked unless added to the list.

**Why it happens:**
New Google Cloud projects start in OAuth consent screen "Testing" mode. Non-developer users see the unverified warning; if the test user list is used, unlisted users are blocked.

**Prevention:**
- Publish the app (move from Testing to Production on the OAuth consent screen) before sharing with parent 2. Publishing without verification shows the "unverified" warning but allows any Google user to sign in.
- Begin Google OAuth verification as early as possible — `calendar.events` is a sensitive scope requiring justification and a demo video. Timeline: 3–5 business days minimum.
- As an interim measure, add parent 2's Google email to the test user list so they can sign in while verification is pending.
- Start the verification submission in parallel with deployment work in Phase 1 — not after the deploy is done.

**Phase:** v1.3 Phase 1 (start verification) through handoff. Do not wait until Phase 3 to start this.

---

### V-13: Vercel preview deployments env vars scoped incorrectly — previews hit production DB

**What goes wrong:**
Preview deployments write data into the production Supabase project, or fail to authenticate because they receive production Supabase credentials while production Google OAuth redirect URIs don't cover the preview URL.

**Why it happens:**
Vercel env vars default to "all environments" scope. Setting `NEXT_PUBLIC_SUPABASE_URL` once causes all deployments (production and preview) to use the same Supabase project.

**Prevention:**
In Vercel project settings → Environment Variables, explicitly set the scope for each Supabase var:
- Production Supabase vars → "Production" scope only
- Staging Supabase vars → "Preview" scope only
- Shared vars (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `PARENT_*`, `APP_*`) → "All environments" is acceptable if the same values apply

After configuring, trigger a preview deployment and inspect the network tab to confirm it hits the staging Supabase URL (not production).

**Phase:** v1.3 Phase 1. Verify in Phase 2 before any data is written.

---

### V-14: New projects have divergent schemas — Drizzle migrations not applied (COMMON, blocks everything)

**What goes wrong:**
App deploys, parents sign in, but the schedule table is empty or queries throw "column does not exist" errors. The production DB was freshly created and migrations were never run against it.

**Why it happens:**
New Supabase projects start with empty public schemas. `drizzle-kit push` (used in local dev) applies schema directly from TypeScript definitions; it does not create or apply migration files. For new environments, `drizzle-kit migrate` must be run explicitly.

**Prevention:**
Run `drizzle-kit migrate` against each new Supabase project before first deploy:
```bash
DATABASE_URL=<new-project-direct-url> npx drizzle-kit migrate
```
Then apply post-migration SQL (can be collected in `scripts/setup-project.sql`):
1. Enable RLS on all tables
2. Apply RLS policies
3. Add GRANT statements (see V-9)
4. Add `schedule_entries` to `supabase_realtime` publication (see V-6)

**Phase:** v1.3 Phase 2. Foundational — everything else depends on this being correct.

---

### V-15: GCal sync fails silently until both parents have signed in on the new environment

**What goes wrong:**
Publish works (draft entries flip to published), but the toast shows "Calendar sync failed". `buildGCalClient` throws "No refresh token found for [email]".

**Why it happens:**
`user_google_tokens` is populated only when a user completes the OAuth callback flow. The new production DB starts empty. Until both parents have signed in at least once, their `refresh_token` rows do not exist.

**Prevention:**
In the deployment runbook, make "both parents sign in" the explicit first step before any publish smoke test. Verify by checking `user_google_tokens` in the Supabase Dashboard after sign-in — there should be one row per parent email with a non-null `refresh_token`.

**Phase:** v1.3 Phase 3 (smoke test sequence). Make this step 1 of the test plan.

---

### V-16: RLS on `user_google_tokens` silently returns empty for GCal sync if wrong DB connection used

**What goes wrong:**
GCal sync fails with "No refresh token found" even though rows exist in `user_google_tokens` and both parents have signed in.

**Why it happens:**
v1.2 enabled RLS on all tables including `user_google_tokens`. The RLS policy restricts reads to the row owner (`auth.uid()` matches). The GCal sync server action uses Drizzle's admin `db` client, which should bypass RLS by authenticating as the `postgres` superuser (direct connection, port 5432). If `DATABASE_URL` in Vercel accidentally points to the Supavisor pooler URL authenticated as `anon`, RLS applies and the select returns nothing.

**Prevention:**
- Verify `DATABASE_URL` in Vercel uses the direct connection string (port 5432 with DB password), not the Supavisor pooler URL
- The direct connection authenticates as the `postgres` role which has `BYPASSRLS = TRUE`
- Cross-check: after deploy, trigger a publish and watch server logs for `[GCal] No refresh token found` — if this appears despite rows existing, the connection role is wrong

**Phase:** v1.3 Phase 1 env var setup. Verify in Phase 3 GCal sync smoke test.

---

### V-17: `src/config/app.ts` git history contains real parent emails or calendar IDs (PRIVACY)

**What goes wrong:**
Not a deploy blocker, but: `git log -p src/config/app.ts` reveals real email addresses or calendar IDs committed before env var migration.

**Why it happens:**
PROJECT.md notes "Git history scrub still pending for `src/config/app.ts` (CR-01)". The file previously had hardcoded values before the env var migration in v1.2.

**Prevention:**
Complete the git history scrub (BFG Repo Cleaner or `git filter-repo`) before making the repository accessible to the second parent or any third party. Until the scrub is done, keep the repository private.

**Phase:** v1.3 prerequisite. Block on this before adding parent 2 as a repo collaborator.

---

### V-18: Server Actions blocked by CORS after custom domain configuration

**What goes wrong:**
Server Action calls (cell edits, publish) return 403 in browser console on the production deployment after pointing a custom domain to Vercel. Works fine on `*.vercel.app`.

**Why it happens:**
Next.js 16 Server Actions validate the `Origin` header against `x-forwarded-host`. If a reverse proxy (Cloudflare in proxy mode, AWS ALB) rewrites the host header, the check fails and the action is rejected as a CSRF attempt.

**Current risk:** Low — Vercel handles proxy headers correctly for `*.vercel.app`. Risk only materializes if a Cloudflare or external proxy is added in front.

**Prevention:**
If using Cloudflare or any reverse proxy, ensure `x-forwarded-host` is passed through. As a safety measure for custom domains, add to `next.config.ts`:
```ts
serverActions: {
  allowedOrigins: ['your-custom-domain.com']
}
```
Test Server Actions (edit a cell, click publish) immediately after configuring any custom domain.

**Phase:** v1.3 Phase 2 only if using a custom domain behind a proxy.

---

## Phase-Specific Warnings — v1.3 Vercel Deployment

| Phase | Topic | Likely Pitfall | Mitigation |
|-------|-------|---------------|------------|
| Phase 1 | Vercel env var scoping | Previews hit production DB (V-13) | Explicitly scope every Supabase-related var by environment |
| Phase 1 | Google Cloud Console | Redirect URIs not updated (V-1) | Add production and preview URIs before first deploy |
| Phase 1 | `middleware.ts` rename | Next.js 16 deprecation (V-5) | Run codemod or rename manually before build |
| Phase 1 | Env var exposure | Service role key with NEXT_PUBLIC_ prefix (V-7) | Audit all Vercel vars for prefix correctness |
| Phase 1 | Google OAuth verification | 3–5 day wait for calendar scope (V-12) | Start submission in Phase 1, not Phase 3 |
| Phase 1 | Supabase Pro | Free tier pauses production (V-8) | Upgrade before user handoff |
| Phase 2 | DB provisioning | Migrations not run on new project (V-14) | `drizzle-kit migrate` + post-migration SQL checklist |
| Phase 2 | Realtime publication | Table not in supabase_realtime (V-6) | SQL alter publication command, once per project |
| Phase 2 | RLS grants | Auto-grants absent on new projects (V-9) | GRANT authenticated role after migration |
| Phase 2 | Connection pooling | Direct DB URL exhausts connections (V-4) | Use Supavisor pooler URL for runtime; direct for migrations |
| Phase 3 | First sign-in sequence | GCal sync fails until both parents sign in (V-15) | Both parents sign in before any publish test |
| Phase 3 | RLS + Drizzle admin | service-role bypass requires direct DB URL (V-16) | Confirm DATABASE_URL = direct connection |
| Phase 3 | Realtime longevity | JWT expiry silences realtime after ~1h (V-10) | Add onAuthStateChange token refresh in RealtimeProvider |
| Phase 3 | Supabase Auth allowlist | Preview callback URL blocked (V-2) | Verify wildcard pattern covers all preview URL formats |

---

---

## v1.2 Migration Pitfalls — Auth.js → Supabase Auth

These pitfalls are specific to the v1.2 milestone: replacing Auth.js v5 + DrizzleAdapter with Supabase Auth, enabling RLS, and migrating the GCal token storage model.

---

### M-1: provider_refresh_token Is Not Stored by Supabase and Vanishes After First Session Refresh (CRITICAL)

**What goes wrong:**
Supabase Auth does not persist `provider_token` or `provider_refresh_token` to its own database. They are available once — in the response of `exchangeCodeForSession()` inside the OAuth callback route — and never again. After the first Supabase session refresh, both fields disappear from the session object entirely. This is by design (security concern about keeping provider tokens in GoTrue), not a bug.

The current GCal sync in `client.ts` reads `refresh_token` from the `accounts` table (Auth.js DrizzleAdapter schema). After removing Auth.js, that table is gone. If the new design relies on `supabase.auth.getSession().provider_refresh_token` at sync time, it will silently fail: the value is null or undefined on any request that is not the initial OAuth callback.

**Why it happens:**
GoTrue (Supabase's auth server) intentionally does not expose a `provider_token` refresh endpoint. The PKCE flow compounds this: the PKCE code verifier is tied to the origin that initiated the flow (Supabase's auth server), so your app's server code cannot use the provider's own PKCE refresh endpoint without also exposing the client secret in the browser — a security regression.

GitHub issues confirming this is by design:
- `supabase/supabase-js#934` — provider_token and provider_refresh_token missing after session refresh (confirmed by-design)
- `supabase/auth#1387` — "Cross-Origin Refreshing of provider_token is not allowed under OAuth"
- `supabase/supabase#21490` — "Using PKCE flow messes with the refreshing of the provider token"

**Consequences:**
- GCal sync breaks silently: `buildGCalClient()` will find no refresh token and throw.
- No runtime error on sign-in — only fails when the first publish/sync is triggered.
- Both parents may sign in successfully with the new auth stack and discover calendar sync is broken only when they try to publish.

**Prevention — required design for v1.2:**
The `user_google_tokens` table (already specified in PROJECT.md) must be populated inside the OAuth callback route handler (`/auth/callback`), at the moment `exchangeCodeForSession()` returns, which is the only time `provider_refresh_token` is available on the server.

```typescript
// /app/auth/callback/route.ts
const { data: { session } } = await supabase.auth.exchangeCodeForSession(code)

// provider_refresh_token is ONLY available here — capture it now
if (session?.provider_refresh_token) {
  await db.insert(userGoogleTokens)
    .values({
      email: session.user.email,
      refresh_token: session.provider_refresh_token,
      access_token: session.provider_token,
      updated_at: new Date(),
    })
    .onConflictDoUpdate({ /* upsert by email */ })
}
```

The `buildGCalClient()` function then reads from `user_google_tokens` instead of the old `accounts` table. The token refresh logic (manual POST to `oauth2.googleapis.com/token`) remains unchanged — Supabase Auth is not in that loop.

**Critical sub-trap — subsequent logins without prompt:consent:**
If `prompt: 'consent'` and `access_type: 'offline'` are not passed to `signInWithOAuth()`, Google will not return a `provider_refresh_token` on re-login. The callback route will see `provider_refresh_token: null` and must NOT overwrite the existing stored token with null. Only update the stored token when the incoming value is non-null.

**Warning signs:**
- GCal sync throws "No refresh token found for [email]" immediately after migration.
- `session.provider_refresh_token` is logged as `null` or `undefined` outside the callback route.
- The new code tries to read refresh tokens from `supabase.auth.getSession()` in a Server Action or Server Component — this will always be null post-callback.

**Phase to address:** First phase of v1.2 migration — before removing the old `accounts` table. Token capture in the callback route must be tested before the DrizzleAdapter schema is dropped.

---

### M-2: Supabase Middleware Must Call getUser() Not getSession() — And Must Set Both Request and Response Cookies (CRITICAL)

**What goes wrong:**
The current `middleware.ts` uses Auth.js's `auth()` wrapper which handles cookie management internally. Supabase's equivalent requires explicit setup: `createServerClient` must be initialized with a `cookies` adapter that reads from `request.cookies` and writes to both `request.cookies` (for Server Components in the same request) and `response.cookies` (for the browser). If either write is missing, sessions silently expire without refreshing — users get logged out unpredictably.

The second trap: `supabase.auth.getSession()` in middleware is explicitly documented as unsafe — the session comes from the cookie, which can be spoofed. Always use `supabase.auth.getUser()` (or `getClaims()` for local JWT validation) to protect routes.

**Why it happens:**
`@supabase/ssr`'s `createServerClient` requires manual cookie handling. The officially documented pattern requires three things that are easy to miss:
1. `getAll()` — read all cookies from `request.cookies`
2. `setAll()` on `request` — so Server Components later in the same request see the refreshed session
3. `setAll()` on `response` — so the browser stores the refreshed JWT

Missing step 2 means Server Components cannot see the refreshed session for the current request. Missing step 3 means the browser never stores the new token and the user gets logged out on next navigation.

Additionally: `createServerClient` must be instantiated **inside** the middleware function body, never at module scope. Vercel's Fluid Compute keeps warm server instances alive between requests; a module-scope client will carry one user's session into another user's request.

**Correct middleware skeleton:**

```typescript
// src/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  // MUST be inside the function — never at module scope
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          // Write to request so Server Components see the update in this request
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          // Rebuild response so the browser also gets the updated cookies
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // NEVER use getSession() here — it trusts the cookie without revalidation
  // getUser() validates against the Supabase Auth server on every call
  const { data: { user } } = await supabase.auth.getUser()

  const isOnHome = request.nextUrl.pathname === '/'
  if (!user && !isOnHome) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return supabaseResponse
}
```

**Warning signs:**
- Users are intermittently logged out even though their Supabase session should be valid.
- Session works in the browser but Server Components see a null user.
- A singleton `supabase` client is initialized outside the middleware function.
- Middleware uses `supabase.auth.getSession()` for route protection.

**Phase to address:** Middleware replacement — the first thing to wire in v1.2 before removing Auth.js.

---

### M-3: Drizzle ORM Bypasses RLS When Using the service_role Key — By Design (HIGH)

**What goes wrong:**
The existing Drizzle `db` client in `src/db/index.ts` connects to Postgres using the Supabase connection string (likely the `POSTGRES_URL` / direct connection with the database password, or via the `pg` driver with Supabase credentials). After enabling RLS on domain tables, this client will continue to bypass RLS entirely if it authenticates as the `service_role` PostgreSQL user.

A common v1.2 mistake: enable RLS on `schedule_entries` and add `auth.uid()` policies, then run the app and see queries still work — not because RLS is correctly enforced, but because the Drizzle client has the `service_role` key and silently bypasses every policy.

**Why it happens:**
Supabase's `service_role` key grants the `service_role` Postgres role, which has `BYPASSRLS = TRUE`. Any client authenticated with this key will never see an RLS policy trigger. For Server Actions that should run as an authenticated user, this means your policies are effectively dead. Conversely, if you switch Drizzle to the `anon` key, it will fail for server-side operations that legitimately need elevated access (migrations, seeding, GCal sync reading tokens).

**The correct two-client model for v1.2:**
- **Drizzle admin client** (service_role key): used only for migrations (`drizzle-kit`), seed scripts, and GCal sync (reading from `user_google_tokens` as a server-side trusted operation). Never used in Server Actions that operate on user-owned data.
- **Supabase client with JWT context** (for user-owned data): either use the `@supabase/ssr` `createServerClient` with the anon key and the user's session cookie (which sets `auth.uid()` correctly), or if using Drizzle queries under RLS, inject the JWT claims per-transaction using `set_config('request.jwt.claims', ...)`.

For v1.2's stated goal of "authenticated users only" RLS (not per-row user ownership), the simplest approach is:
```sql
-- All authenticated users can read and write all rows
CREATE POLICY "authenticated_access" ON schedule_entries
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

This means the Supabase client's anon key + active session cookie satisfies `TO authenticated`, and the Drizzle service_role client continues to work for background operations. No per-transaction JWT injection needed for v1.2 scope.

**Warning sign — the silent bypass trap:**
After enabling RLS, test with a request that has NO authentication (e.g., `curl` with no auth header). If the query still returns data, the Drizzle client is using service_role and bypassing RLS. RLS is only enforced on the `anon` and `authenticated` roles.

**Warning signs:**
- Enabling RLS on a table makes no observable difference to Server Action queries.
- The Drizzle `db` client uses `SUPABASE_SERVICE_ROLE_KEY` or the direct Postgres URL with the database password.
- No per-transaction `set_config` calls exist but per-user RLS policies are written.

**Phase to address:** RLS enablement phase. Test RLS enforcement by connecting with the anon key before declaring it done.

---

### M-4: Auth.js Table Removal Must Be Ordered to Avoid FK Constraint Failures

**What goes wrong:**
The Auth.js schema has a dependency chain: `accounts.userId → users.id` and `sessions.userId → users.id`. If a migration tries to drop `users` before dropping `accounts` and `sessions`, Postgres rejects it with:
```
ERROR: cannot drop table users because other objects depend on it
DETAIL: constraint accounts_userId_users_id_fk on table accounts depends on table users
```

Additionally, Drizzle Kit's schema diffing may emit a migration that drops the tables in the wrong order if the `auth.ts` schema file is simply deleted and `drizzle-kit generate` is run. Drizzle Kit has had bugs where FK-constrained table drops are not reordered.

A second concern: the domain tables (`schedule_entries`, `gcal_events`, `children`, `schedules`) do not currently reference the Auth.js `users` table by foreign key. Verify this before migration — if any domain table added a `user_id TEXT REFERENCES users(id)` during a previous phase, it must be migrated or nulled out before the `users` table can be dropped.

**Correct migration ordering:**
1. Drop `verificationTokens` (no FK dependencies)
2. Drop `sessions` (FK → `users`, safe to drop before users if accounts is still present)
3. Drop `accounts` (FK → `users`)
4. Drop `users` last

If using `drizzle-kit generate`, inspect the emitted SQL before applying. If the order is wrong, manually reorder the DROP TABLE statements. Alternatively, use `DROP TABLE IF EXISTS accounts, sessions, verificationTokens, users CASCADE;` — CASCADE handles the order automatically but will also drop any FK-dependent objects you may not have anticipated.

**Warning signs:**
- Migration fails with `cannot drop table users because other objects depend on it`.
- `drizzle-kit generate` emits a migration that drops `users` in the first statement.
- Domain tables were extended with `user_id` references in a previous phase.

**Phase to address:** Schema cleanup sub-task. Run in a dedicated migration, not combined with other schema changes.

---

### M-5: Existing Signed-In Users Are Invalidated Immediately on Auth Stack Replacement — No Graceful Transition

**What goes wrong:**
Auth.js sessions are stored as JWTs in the `__Secure-next-auth.session-token` cookie (or `next-auth.session-token` in dev). Supabase Auth sessions are stored in `sb-[project-ref]-auth-token` cookies. These are completely separate namespaces. The moment the new middleware goes live, all existing Auth.js cookies become meaningless — `supabase.auth.getUser()` will return null for every user who was signed in under Auth.js, and they will be silently redirected to the login page.

For a two-user production app mid-live, this is a forced re-login for both parents on the first deployment.

**Why it happens:**
There is no migration path for JWT sessions between auth libraries. The token formats, signing secrets, and cookie names are incompatible.

**What to do:**
Accept that both parents will need to sign in again after the v1.2 deployment. This is not recoverable — it is the expected behavior. The mitigation is operational: communicate to both parents before deploying ("after tonight's update, please sign in again with Google"). The re-sign-in is also the mechanism by which `provider_refresh_token` is captured into the new `user_google_tokens` table for the first time.

**Sub-trap: First sign-in after migration must succeed before GCal sync is available.** If one parent deploys and signs in but the other has not yet signed in under Supabase Auth, the GCal sync for the second parent's calendar will fail (no refresh token in `user_google_tokens` yet). This is expected behavior, but the error toast should be informative ("Parent B's calendar is not connected yet — please ask them to sign in") rather than a generic failure.

**Warning signs:**
- Both parents are logged out immediately after first deployment with new auth stack.
- GCal sync fails for one parent's calendar after the other parent initiates publish.
- The `user_google_tokens` table is empty for one parent after migration.

**Phase to address:** Deployment strategy. Coordinate sign-in for both parents immediately after v1.2 deploy before any publish/sync is attempted.

---

### M-6: ISR-Cached Pages + Supabase Cookie Refresh = Session Cross-Contamination

**What goes wrong:**
If any page in the `/dashboard` route has ISR enabled (even inadvertently, via a parent layout that lacks `export const dynamic = 'force-dynamic'`), Next.js may cache a response that includes a `Set-Cookie` header containing a freshly-refreshed Supabase JWT. When that cached response is served to the other parent, their browser stores the token and they are temporarily signed in as the wrong person.

**Why it happens:**
Supabase's middleware refreshes the session JWT and writes it to the response via `Set-Cookie`. If the response is cached by Next.js's ISR cache or a CDN before it reaches the browser, the cookie goes with it. The next request that receives that cached response will have the wrong JWT installed.

**Prevention:**
Add `export const dynamic = 'force-dynamic'` to all route segments that require authentication. For this app, that means `app/dashboard/page.tsx` and `app/dashboard/layout.tsx` at minimum. Add `Cache-Control: private, no-store` to all authenticated API routes.

Also, for `realtime-provider.tsx` and any other Client Components that call `supabase.auth.getSession()` directly: note that `getClaims()` performs local JWT signature verification and is preferred over `getSession()` for security-sensitive checks, but does not contact the auth server. For the two-user app at hand, this distinction is low risk, but correct usage is `getUser()` (server validation) in Server Components and middleware, and `getSession()` only in Client Components where the session is already established.

**Warning signs:**
- Both parents share a session intermittently after publishing schedule changes.
- Next.js build logs show ISR for `/dashboard` (no `dynamic = 'force-dynamic'` export).
- A CDN sits in front of Vercel without `Cache-Control: private, no-store` on auth routes.

**Phase to address:** Auth setup phase, before deploying to production. For this two-user app on Vercel free tier with no CDN, ISR is off by default for dynamic routes — but the explicit export is a safety guarantee worth adding.

---

### M-7: The Supabase Callback Route Is the Only Place to Capture provider_refresh_token — Callback Route Failures Silently Skip Token Storage

**What goes wrong:**
The `/auth/callback` route handler is the only server-side location where `provider_refresh_token` is present. If this route handler throws an error, encounters a DB constraint, or returns early before the token upsert executes, the token is silently lost. The user is still signed in to the app via Supabase Auth (the session cookie is set), but `user_google_tokens` has no entry for them, and GCal sync fails.

The failure is particularly insidious because:
1. The user sees a successful sign-in (redirect to `/dashboard` works).
2. Supabase Auth session is valid.
3. The error only manifests when publishing a schedule change.

**Why it happens:**
The `exchangeCodeForSession()` call and the `user_google_tokens` upsert are two separate operations. If they are not in an explicit error boundary, a DB write failure (e.g., schema mismatch, wrong column name) silently swallows the token.

**Prevention:**
```typescript
// In /auth/callback/route.ts
const { data, error: sessionError } = await supabase.auth.exchangeCodeForSession(code)
if (sessionError) {
  // redirect to error page
}

const { session } = data
if (session?.provider_refresh_token) {
  try {
    await db.insert(userGoogleTokens)
      .values({ ... })
      .onConflictDoUpdate({ ... })
  } catch (err) {
    // Log loudly — token storage failure = broken GCal sync
    console.error('[auth/callback] CRITICAL: Failed to store Google refresh token', err)
    // Decide: redirect to error page, or continue with a banner?
    // For v1.2, redirect to an error page is safer than silently continuing
  }
} else {
  // provider_refresh_token absent — user already has one stored, or consented without offline scope
  console.warn('[auth/callback] No provider_refresh_token in session — existing token preserved')
}
```

Verify the stored token immediately after the callback in the test suite: sign in with a fresh test account, check `user_google_tokens` row exists, sign in again without `prompt: 'consent'` (simulating re-login), verify existing token was NOT overwritten with null.

**Warning signs:**
- GCal sync fails for a user immediately after their first sign-in with the new auth stack.
- `user_google_tokens` is empty even after a successful login.
- The callback route has no error handling around the DB write for token storage.
- `console.error` is absent from the token storage path.

**Phase to address:** Callback route implementation, v1.2. Token storage must be tested before the Auth.js `accounts` table is removed.

---

### M-8: Domain Tables Currently Use TEXT IDs — Supabase Auth Uses UUID — No Direct FK Link Exists (LOW RISK, CONFIRM)

**What goes wrong:**
The existing domain tables (`schedule_entries`, `children`, `schedules`, `gcal_events`) use `TEXT` primary keys generated by `crypto.randomUUID()`. The `users` table in Auth.js also uses `TEXT` IDs. Supabase Auth's `auth.users` table uses `UUID` type.

For v1.2, there is no FK relationship between domain tables and `auth.users` — the app identifies users by `config.parents[].email` (config-driven, not DB-driven). This design is unchanged in v1.2 and poses no FK migration risk. The new `user_google_tokens` table links by email, not by `auth.users.id`.

**Confirm before migration:** Run `SELECT tc.table_name, ccu.table_name AS referenced_table FROM information_schema.table_constraints tc JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name IN ('users', 'accounts', 'sessions');` to verify no domain table holds a FK into the Auth.js `users` table. If any FK exists, it must be handled before dropping the Auth.js schema.

**Phase to address:** Pre-migration audit step.

---

## Original Pitfalls — Calendar Integration and Real-Time

### Pitfall 1: Refresh Token Not Returned on Subsequent Logins

**What goes wrong:**
When a user who has previously authorized the app logs in again, Google does not return a new refresh token — only an access token. If the previously stored refresh token was lost (cleared database, dev environment reset, token rotation mistake), the user's Calendar integration silently breaks. Calendar syncs fail with 401 errors and no recovery path exists without forcing the user through OAuth consent again.

**Why it happens:**
Google only returns a refresh token the first time a user grants consent, or when `prompt=consent` is explicitly forced. Developers often assume a new login always yields a new refresh token. The refresh token is then stored carelessly (in session, not persisted to database), lost during database migrations, or never stored at all.

**How to avoid:**
- Always request `access_type=offline` and `prompt=consent` on the initial OAuth flow — or on any re-authorization flow.
- Persist the refresh token to the database immediately on receipt (within the same transaction as creating/updating the user record).
- On subsequent logins where no refresh token is returned by Google, do NOT overwrite the stored token with null — keep the existing one.
- Implement a "reconnect calendar" UI pathway that forces `prompt=consent` when the stored token is revoked/missing.

**Warning signs:**
- Calendar sync calls return 401 or 403 after a dev environment reset.
- Only happens to some users but not others (those who re-authenticated without `prompt=consent`).
- "Token invalid" errors that cannot be reproduced from scratch.

**Phase to address:**
Auth setup phase (Google OAuth integration). Must be correct before any Calendar API code is written.

---

### Pitfall 2: Refresh Tokens Expire in 7 Days While App is in Testing Mode

**What goes wrong:**
If the Google Cloud project's OAuth consent screen is in "Testing" publishing status, all issued refresh tokens expire after exactly 7 days. For a two-user app where both parents need persistent calendar access, this means calendar sync breaks silently every week until the app is verified and moved to "Production" publishing status.

**Why it happens:**
Developers build and test the app in Testing mode, assume it works, then deploy to real users without realizing the 7-day expiry applies even in "production-like" environments. There is no obvious error — the refresh token just becomes invalid after 7 days.

**How to avoid:**
- Move the OAuth consent screen publishing status to "Production" before giving the app to real users, even if it is a private two-person app. This requires completing Google's verification process for sensitive scopes (Google Calendar read/write).
- For a private app used by only 2 known users, an alternative is to keep it in Testing mode and add both users as explicit test users — but the 7-day re-authorization requirement remains and will create friction.
- Budget time for the Google OAuth verification process: typically 3-5 business days, but potentially longer.

**Warning signs:**
- Calendar sync stops working exactly 7 days after a user first connected.
- Errors only affect users who have not recently re-authenticated.
- Works fine in testing (because testers re-authenticate frequently) but breaks for real users.

**Phase to address:**
Deployment / go-live phase. Must be resolved before handing the app to real users.

---

### Pitfall 3: Google Calendar Scope Triggers OAuth Verification Requirement

**What goes wrong:**
Any scope that reads or writes Google Calendar events is classified by Google as "sensitive." Publishing an app that requests sensitive scopes to external users (anyone outside the Google Workspace org) without completing the OAuth App Verification process results in an "unverified app" warning screen shown to users. For a two-parent app where both parents need to authorize, this blocks adoption.

**Why it happens:**
Developers focus on building the integration and defer the verification step as "admin work." The verification requirement is easy to overlook until the app is ready to ship.

**How to avoid:**
- Request the minimum required scope: `https://www.googleapis.com/auth/calendar.events.owned` (create, change, delete events on calendars the user owns) rather than the full `calendar` scope.
- Start the OAuth verification process early — it takes 3-5 business days and may require a privacy policy URL, app description, and a demo video.
- If both users have the same Google Workspace domain (unlikely for co-parents), configure the app as internal to skip external verification.

**Warning signs:**
- OAuth consent screen shows "unverified app" warning when testing with accounts not listed as test users.
- Users are blocked by a "Google hasn't verified this app" interstitial screen.

**Phase to address:**
Auth setup phase (scope selection). Verification process must start at least 1 week before planned user handoff.

---

### Pitfall 4: Duplicate Google Calendar Events From Retry-on-Failure Sync Logic

**What goes wrong:**
When a calendar sync call fails mid-execution (network timeout, 500 error, rate limit), the sync is retried. If the first call partially succeeded (event was created in Google Calendar but the response was lost), the retry creates a second identical event. The result is two "Emma @ dad" events on the same day, which cannot be automatically deduplicated without knowing which one to delete.

**Why it happens:**
Google Calendar's events.insert endpoint uses POST semantics and is not idempotent. A retried POST creates a new event rather than finding the existing one. Developers implement retry logic without accounting for partial success.

**How to avoid:**
- Store Google Calendar event IDs in your own database at the moment of creation — this is the source of truth for which event represents which custody day.
- Use `extendedProperties.private` on Calendar events to tag them with your own internal ID (e.g., `vuoroasuminen_day_id: "2026-04-15_child_1_parent_a"`). This allows reconciliation: before creating, query by your internal ID to check if the event already exists.
- For each custody day row, store `gcal_event_id_parent_a` and `gcal_event_id_parent_b` columns. Upsert logic: if the column is populated, call `events.patch`; if null, call `events.insert` and store the returned ID.
- Never retry a create without checking if the event already exists first.

**Warning signs:**
- Parents report seeing duplicate events in Google Calendar.
- Database has a `gcal_event_id` column but it is sometimes NULL after sync.
- Sync code uses a simple retry loop without checking for existing events.

**Phase to address:**
Calendar sync implementation phase.

---

### Pitfall 5: Orphaned Events When Custody Days Are Deleted or Reassigned

**What goes wrong:**
When a parent reassigns a custody day (e.g., child moves from parent A to parent B), the old Google Calendar event on parent A's calendar is never deleted. Over time, both parents accumulate stale events that no longer reflect the actual schedule. There is no built-in cleanup mechanism.

**Why it happens:**
The sync logic only creates and updates events; it does not implement delete. Developers focus on "push current state" and forget "remove stale state." The problem is invisible during development (small amount of test data) but grows in production.

**How to avoid:**
- Treat each custody day as having two Google Calendar event IDs: one per parent calendar. On every publish (draft → published transition), reconcile by:
  1. If child is with parent A: ensure event exists in parent A's calendar, delete from parent B's calendar if present.
  2. If child is with parent B: reverse.
- Store both event IDs in the database for every custody day per child. A NULL event ID means "not currently on that parent's calendar."
- Implement a reconcile/audit function that can scan all published days, check the database IDs, and delete orphaned events on demand.

**Warning signs:**
- Parents report events appearing on the wrong parent's calendar.
- Database has no column for "which calendar is this event currently in."
- Event deletion is never called in the sync code.

**Phase to address:**
Calendar sync implementation phase. Must be designed alongside event creation, not added later.

---

### Pitfall 6: Full-Day Events and Timezone Misalignment Between Parents

**What goes wrong:**
Full-day events in Google Calendar use `start.date` and `end.date` with the format `YYYY-MM-DD` (no time, no timezone). This seems simple, but if the server constructs dates in UTC and one parent is east of UTC while the other is west, the same "2026-04-15" in UTC may render as April 14 in one parent's calendar and April 15 in the other's. The custody schedule appears to shift by one day for one parent.

**Why it happens:**
Developers store custody days as timestamps (UTC datetime) in the database rather than plain calendar dates. When converting to a Google Calendar all-day event, the UTC date is used, which may differ from the parent's local date near midnight.

**How to avoid:**
- Store custody days as plain `date` values (e.g., PostgreSQL `DATE` type, not `TIMESTAMP WITH TIME ZONE`) in the database. A custody day is "April 15, 2026" — it is not a point in time.
- Pass `YYYY-MM-DD` strings directly to Google Calendar's `start.date` and `end.date` fields. Never derive the date from a UTC timestamp at runtime.
- The Google Calendar all-day event `timeZone` field has no meaning for `date`-type events — do not set it.
- For end dates: Google Calendar all-day events are exclusive-end. An event on April 15 needs `start.date: "2026-04-15"` and `end.date: "2026-04-16"`.

**Warning signs:**
- One parent's calendar shows custody days shifted by one day compared to the other's.
- Database schema uses `TIMESTAMP` instead of `DATE` for custody day records.
- Date construction involves `new Date(...)` or `.toISOString()` anywhere in the sync path.

**Phase to address:**
Data model design phase (before any calendar sync code is written). Fix the schema type; do not patch the sync logic.

---

### Pitfall 7: Real-Time Sync Breaking Silently Without Client Reconnection

**What goes wrong:**
The real-time subscription (WebSocket/Supabase Realtime) silently drops and stops delivering updates. One parent makes a change; the other parent's UI appears up to date but is actually stale. When both parents then edit based on stale state and publish, the last write wins — but the losing parent does not know their edit was overwritten.

**Why it happens:**
WebSocket connections drop due to network interruptions, idle timeouts, or server-side disconnection (rate limits exceeded). Libraries like Supabase JS auto-reconnect at the socket level, but do not re-fetch missed changes that occurred during the disconnection window. The UI shows stale data as if it were live.

**How to avoid:**
- On reconnect, always perform a full data re-fetch for the current schedule window. Do not trust that real-time events were received during the disconnection gap.
- Implement a visible "last updated" timestamp in the UI so parents can see if data is fresh.
- Add a visible connection status indicator (connected / reconnecting / offline) so parents know when real-time is not working.
- Use Supabase Realtime's `postgres_changes` subscription with a channel presence/status listener to detect disconnection events.

**Warning signs:**
- No reconnection + re-fetch logic in the client code.
- UI has no indication of real-time connection status.
- Integration tests do not simulate WebSocket reconnection after a gap.

**Phase to address:**
Real-time collaboration implementation phase.

---

### Pitfall 8: Last-Write-Wins Causing Silent Data Loss on Simultaneous Edits

**What goes wrong:**
Both parents have the schedule open at the same time. Parent A changes Monday to "Emma with dad." Simultaneously, Parent B changes the same Monday to "Emma with mom." Both see the other parent's change momentarily, then their own write wins (or vice versa, depending on timing). One parent's intent is silently discarded, and neither parent receives any notification that a conflict occurred.

**Why it happens:**
Last-write-wins is intentional per the project spec, but the implementation often lacks the feedback loop that makes it safe. Without acknowledging the overwrite to the losing editor, they may not realize their change was discarded and act on stale assumptions.

**How to avoid:**
- Last-write-wins is the correct conflict resolution policy for this use case. The key is making overwrites visible, not preventing them.
- When a real-time update arrives that changes a cell the current user just edited, flash the cell in the UI to indicate it was changed by the other parent.
- Include a `updated_by` and `updated_at` field on each custody day row. Show "Updated by [other parent's name] X seconds ago" in the UI.
- Ensure the real-time subscription delivers the overwrite event back to the originating client, not just to other clients.

**Warning signs:**
- No `updated_by` column in the schema.
- Real-time subscription only broadcasts to "other" clients, not back to the originator.
- UI has no visual indication when a cell is remotely modified.

**Phase to address:**
Real-time collaboration implementation phase and data model phase.

---

### Pitfall 9: Draft/Publish State Machine Implemented as Boolean Flags

**What goes wrong:**
The draft state is implemented as `is_draft: boolean` or `is_published: boolean` instead of an explicit state field. As requirements evolve ("partially published" — some days published, some still draft; "re-draft after publish"), the boolean breaks down. Queries become complicated combinations of flag checks, and invalid states become possible (e.g., `is_draft: true` AND `is_published: true`).

**Why it happens:**
Boolean flags are the path of least resistance for an MVP. When only two states exist initially, a boolean seems sufficient. Adding a third state requires a migration and refactoring of all flag-based logic.

**How to avoid:**
- Use a single explicit `status` enum column per custody day: `draft | published`. This is the correct cardinality for this app's requirements.
- If the planning horizon means some days in a range are always draft and some are published, model this at the day level (each row has its own status), not at a "plan" level.
- Define valid state transitions explicitly in the API layer: only `draft → published` is allowed (a publish action); there is no "unpublish" unless explicitly designed.

**Warning signs:**
- Schema has `is_draft` and/or `is_published` boolean columns.
- API has no transition validation — any combination of flag values is accepted.
- Queries filter by multiple boolean columns to determine effective state.

**Phase to address:**
Data model design phase.

---

### Pitfall 10: Google Calendar API Rate Limits Hit During Bulk Publish

**What goes wrong:**
When a parent publishes a 12-week draft, the sync code generates up to 84 days × 2 children × 2 parent calendars = 336 individual Calendar API calls, all at once. This can exhaust the per-minute quota, resulting in 403/429 errors, partial syncs, and an inconsistent state where some calendar events are created and others are not.

**Why it happens:**
The sync logic iterates over all dirty days and fires one API call per event. Developers test with small datasets (a few days) and do not discover the quota problem until a large publish is triggered.

**How to avoid:**
- Batch Calendar API writes: use the Google Calendar batch endpoint or queue writes with a delay between them.
- Process sync writes sequentially with a small delay between calls (e.g., 50ms) rather than firing all concurrently.
- Track which days have been synced successfully (update `gcal_event_id` in the database after each successful write) so a partial sync can be resumed rather than restarted.
- On 429/403 rate-limit errors, implement exponential backoff with jitter (not a fixed retry loop).
- Display sync progress to the user for large publishes rather than blocking the UI on a single operation.

**Warning signs:**
- Sync code uses `Promise.all()` on all calendar API calls simultaneously.
- No per-event tracking of sync status in the database.
- 403 errors with `usageLimits` reason appear in logs after bulk publishes.

**Phase to address:**
Calendar sync implementation phase.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store `gcal_event_id` on the schedule table only, not per parent | Simpler schema | Cannot independently track which parent's calendar has the event; orphan cleanup is impossible | Never — add both `gcal_event_id_parent_a` and `gcal_event_id_parent_b` from the start |
| Use `TIMESTAMP` instead of `DATE` for custody days | Familiar type | Timezone-dependent date extraction causes calendar events to appear on wrong day | Never — custody days are dates, not timestamps |
| Skip the `updated_by` / `updated_at` on custody day rows | Less schema columns | Last-write-wins produces silent data loss with no audit trail | Never — add from the start; cost is negligible |
| Sync calendar in-request (synchronous HTTP calls to Google during the publish API call) | Simpler architecture | User waits for all Calendar API calls to complete; partial failures block publish response | Acceptable for MVP; refactor to background job before scale |
| Keep OAuth app in "Testing" publishing status | Skip verification process | Refresh tokens expire every 7 days; users must re-authorize weekly | Never for real users — move to Production before first external user |
| Request the full `calendar` scope instead of `calendar.events.owned` | One scope, no thought required | Users see a more alarming permissions screen; harder to pass OAuth verification | Never — use minimum required scope |
| No reconnection re-fetch after WebSocket drop | Simpler client code | Stale data served as live; edits based on stale state get silently overwritten | Never — always re-fetch on reconnect |
| Read provider_refresh_token from supabase.auth.getSession() in Server Actions | Familiar session API pattern | Always null outside the initial OAuth callback — token was never there | Never — store tokens in user_google_tokens at callback time |
| Use service_role Drizzle client for user-facing Server Actions under RLS | Works immediately, no RLS setup needed | RLS policies are silently bypassed — security goal of v1.2 not achieved | Never once RLS is required — use anon key client or set JWT context per transaction |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Google OAuth | Not requesting `access_type=offline` | Always include `access_type=offline` in the initial auth URL |
| Google OAuth | Not forcing `prompt=consent` on re-authorization flows | Use `prompt=consent` when re-authorizing to guarantee a new refresh token |
| Google OAuth | Overwriting stored refresh token with NULL when re-login returns no token | Only update the stored refresh token when a new, non-null token is received |
| Google Calendar API | Using `dateTime` fields for all-day events | Use `start.date` / `end.date` with `YYYY-MM-DD` format; do not set `start.dateTime` |
| Google Calendar API | All-day event end date equals start date | End date must be the day after the event: a single-day event on April 15 needs `end.date: "2026-04-16"` |
| Google Calendar API | Using POST (insert) for retries without checking existence | Store the returned event ID; use PATCH/update for existing events, INSERT only for new ones |
| Google Calendar API | Firing all sync writes concurrently | Serialize with delay or batch to stay within per-minute quota |
| Supabase Auth | Reading provider_refresh_token from session in Server Actions | Capture once at `/auth/callback` in `exchangeCodeForSession()` response; store to `user_google_tokens` |
| Supabase Auth | Using `getSession()` in middleware for route protection | Use `getUser()` in middleware — `getSession()` trusts spoofable cookies |
| Supabase Auth | Initializing `createServerClient` at module scope | Always initialize inside the request handler body to prevent cross-request session leakage |
| Supabase RLS | Enabling RLS but using service_role client for all queries | Service_role bypasses RLS entirely; use anon key client for user-authenticated queries |
| Supabase Realtime | Assuming no changes were missed after reconnect | Re-fetch full schedule window on every reconnect event |
| Vercel deploy | Using Supabase direct DB URL (port 5432) for runtime queries | Use Supavisor pooler URL (port 6543) for Vercel serverless; direct URL only for drizzle-kit |
| Vercel deploy | Setting env vars without explicit environment scope | Scope each Supabase var to "Production" or "Preview" explicitly to prevent cross-environment data writes |

---

## Sources

**v1.3 Vercel Deployment:**
- Supabase Redirect URLs docs (wildcard syntax): https://supabase.com/docs/guides/auth/redirect-urls
- Supabase Production Checklist: https://supabase.com/docs/guides/deployment/going-into-prod
- Supabase Breaking Change — auto-grants removed: https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically
- Supabase Realtime Authorization: https://supabase.com/docs/guides/realtime/authorization
- Supabase Postgres Changes: https://supabase.com/docs/guides/realtime/postgres-changes
- Supabase Managing Environments: https://supabase.com/docs/guides/deployment/managing-environments
- Vercel + Supabase connection pooling: https://www.iloveblogs.blog/guides/supabase-connection-pooling-vercel
- Vercel Supabase issues 2026: https://kuberns.com/blogs/vercel-supabase/
- Next.js 16 Upgrade Guide (middleware → proxy, async APIs): https://nextjs.org/docs/app/guides/upgrading/version-16
- Google Sensitive Scope Verification: https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification
- Supabase service_role key exposure (CVE-2025-48757): https://gptsters.com/fix/lovable/service-role-key-exposed
- Vercel Community — Google OAuth redirect URL with preview URLs: https://community.vercel.com/t/google-oauth-redirect-url-with-vercel-preview-urls-supabase/6345
- NEXT_PUBLIC_ security guide: https://www.hashbuilds.com/articles/next-js-environment-variables-complete-security-guide-2025

**v1.2 Migration and Original Research:**
- Supabase Docs — Login with Google (official): https://supabase.com/docs/guides/auth/social-login/auth-google
- Supabase Docs — Server-Side Auth for Next.js (official): https://supabase.com/docs/guides/auth/server-side/nextjs
- Supabase Docs — Advanced SSR Auth Guide (official): https://supabase.com/docs/guides/auth/server-side/advanced-guide
- Supabase Docs — Row Level Security (official): https://supabase.com/docs/guides/database/postgres/row-level-security
- Drizzle ORM Docs — RLS support (official): https://orm.drizzle.team/docs/rls
- GitHub: supabase/supabase-js#934 — provider_refresh_token missing after session refresh: https://github.com/supabase/supabase-js/issues/934
- GitHub: supabase/auth#1387 — Cross-origin refreshing of provider_token not allowed: https://github.com/supabase/auth/issues/1387
- GitHub: supabase/supabase#21490 — PKCE flow messes with provider_token refresh: https://github.com/supabase/supabase/issues/21490
- Google OAuth 2.0 for Web Server Applications (official): https://developers.google.com/identity/protocols/oauth2/web-server
- Google Calendar API Scopes (official): https://developers.google.com/workspace/calendar/api/auth

---

*Pitfalls research for: Co-parenting custody scheduling app with Google Calendar integration (vuoroasuminen)*
*Original research: 2026-04-04 | v1.2 migration supplement: 2026-05-09 | v1.3 Vercel deployment: 2026-05-15*
