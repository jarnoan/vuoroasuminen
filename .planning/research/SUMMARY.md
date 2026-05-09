# Research Summary: v1.2 Supabase Auth Migration

**Synthesized:** 2026-05-09
**Milestone:** v1.2 — Replace Auth.js v5 + DrizzleAdapter with Supabase Auth; enable RLS on all domain tables
**Sources:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md

---

## Stack Changes

### Remove

| Package | Why |
|---------|-----|
| `next-auth@^5.0.0-beta.30` | Fully replaced by Supabase Auth; session management, OAuth flow, and middleware all migrate to `@supabase/ssr` |
| `@auth/drizzle-adapter@^1.11.1` | Was needed to persist OAuth tokens in `accounts` table; that table is being dropped |

Run: `npm uninstall next-auth @auth/drizzle-adapter`

### No new packages needed

`@supabase/ssr@^0.10.0` and `@supabase/supabase-js@^2.101.1` are already installed and cover everything. The `0.10.x` series includes the fix for Next.js 15 async `cookies()` — use `await cookies()` when calling `createServerClient` in server contexts.

### Environment variables

| Variable | Action | Notes |
|----------|--------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Keep | Already present |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Keep | Already present; valid through at least end of 2026 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Keep | Used by `googleapis` for GCal token exchange — separate from Supabase OAuth config |
| `SUPABASE_SERVICE_ROLE_KEY` | Add | Required for admin Drizzle connection (GCal sync, token writes) |
| `AUTH_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` | Remove | Auth.js specific |
| Google OAuth credentials for Supabase | Dashboard only | Configure in Supabase Dashboard -> Authentication -> Providers -> Google; NOT in `.env` |

---

## Key Patterns

### 1. PKCE Flow with Manual Redirect (sign-in Server Action)

`@supabase/ssr` defaults to PKCE (required for SSR). The sign-in Server Action calls `signInWithOAuth` on a server client; the method returns a redirect URL which Next.js `redirect()` sends the browser to. The OAuth callback is handled by a Route Handler at `/auth/callback`.

Required params on every sign-in — do not omit:
- `access_type: 'offline'` — requests refresh_token from Google
- `prompt: 'consent'` — forces re-consent so Google re-issues refresh_token every time
- `scopes: 'https://www.googleapis.com/auth/calendar'`

Both params mirror the fix that solved the `invalid_grant` bug in v1.0 and must be preserved.

### 2. Provider Token Capture in Callback Route (the only opportunity)

Supabase does not persist `provider_token` or `provider_refresh_token`. They exist exactly once: in the session returned by `exchangeCodeForSession(code)` inside `/auth/callback/route.ts`. After the callback redirects, they are gone forever from any subsequent `getSession()` or `getUser()` call.

The callback route must upsert into `user_google_tokens` immediately after `exchangeCodeForSession` succeeds. Only upsert when `provider_refresh_token` is non-null — do not overwrite an existing valid token with null on re-logins without `prompt:consent`. Wrap the DB write in a try/catch and log loudly on failure — a silent DB error here means broken GCal sync with no obvious cause at publish time.

### 3. Double Cookie Write in Middleware

The middleware must write cookies to both `request.cookies` (so Server Components in the same request see the refreshed session) AND rebuild `supabaseResponse` with the updated cookies (so the browser stores the new JWT). Missing either write causes intermittent random logouts.

Use `getUser()`, never `getSession()`, for route protection in middleware. `getSession()` trusts a spoofable cookie without server revalidation. `getUser()` validates against the Supabase Auth server on every call.

Initialize `createServerClient` inside the middleware function body, never at module scope. Vercel warm instances share module scope across requests — a module-scope client leaks one user's session into another user's request.

### 4. withRLS Transaction Wrapper for Drizzle

Drizzle connects as a Postgres superuser and bypasses RLS entirely. To make Drizzle queries respect RLS, every user-context query must run inside a transaction that injects the user's JWT claims into `request.jwt.claims`, sets `request.jwt.claim.sub`, and switches `SET LOCAL ROLE authenticated`. Use `set_config(..., TRUE)` (transaction-local) — never `FALSE`, which persists for the entire connection and leaks auth context across pooled requests.

For v1.2's `USING (true)` policies (any authenticated user), the admin Drizzle client would also satisfy the policy if the role were switched. The `withRLS` wrapper establishes the pattern now so that future per-row ownership policies (AUDT-01) require only a policy expression change, not structural refactoring.

### 5. Admin db vs RLS db Split

Two Drizzle connections with `prepare: false` (required by Supavisor transaction pooler):

| Connection | When to use |
|------------|-------------|
| `db` (service_role / admin) | GCal sync, token reads/writes in callback, migrations |
| `withRLS(session, tx => ...)` | Server Actions acting on behalf of authenticated users |

GCal sync and `user_google_tokens` reads always use the admin connection — they are server-initiated operations on behalf of the calendar owner, not the currently-signed-in user.

---

## Critical Path

The migration has strict dependencies. This is the safe ordering:

```
1.  Create user_google_tokens table (raw SQL migration — FK to auth.users not expressible in Drizzle)
2.  Implement new /auth/callback route handler (captures provider_refresh_token, upserts to user_google_tokens)
3.  Implement signInWithGoogle Server Action (PKCE flow, offline + consent params)
4.  Implement Supabase middleware (double cookie write, getUser() guard)
5.  Update createClient utilities (server.ts: async + await cookies(); client.ts: -> createBrowserClient)
6.  Update buildGCalClient to read from user_google_tokens (not accounts table)

--- GATE: sign in -> verify token row exists -> verify GCal sync works end-to-end ---

7.  Enable RLS on domain tables + user_google_tokens (SQL migration)
8.  Update Drizzle schema (add pgPolicy declarations, add userGoogleTokens table definition)
9.  Implement withRLS wrapper; update Server Actions to use it
10. Remove Auth.js schema from Drizzle (auth.ts) + run migration to drop Auth.js tables
    Drop order: verificationTokens -> sessions -> accounts -> users
11. Uninstall next-auth + @auth/drizzle-adapter
12. Remove NEXTAUTH_* env vars
13. Update all import sites (grep for @auth/, DrizzleAdapter, auth() from next-auth)
14. Add `export const dynamic = 'force-dynamic'` to all authenticated route segments
```

Steps 1-6 must be verified before steps 7-14 begin. The Auth.js tables must not be dropped until GCal sync is confirmed working against `user_google_tokens`.

---

## Watch Out For

**1. provider_refresh_token vanishes after first session refresh (CRITICAL)**
Capture it in the callback route during `exchangeCodeForSession`. Never read it from `getSession()` in a Server Action — it will always be null there. A silent DB error in the callback leaves the user signed in but with broken GCal sync that only manifests at publish time.

**2. Missing double cookie write in middleware causes random logouts (CRITICAL)**
The `setAll` handler in middleware must write to both `request.cookies` and the rebuilt `supabaseResponse`. Do not create a new `NextResponse` after the Supabase client is set up — if you must, copy cookies explicitly.

**3. Drizzle service_role client silently bypasses RLS (HIGH)**
After enabling RLS, test with an unauthenticated curl request — if data still returns, the service_role client is bypassing policies. The `withRLS` pattern is required for any Server Action query that should be subject to RLS enforcement.

**4. Auth.js table drop order must respect FK constraints (HIGH)**
Drop `verificationTokens` -> `sessions` -> `accounts` -> `users`. Drizzle Kit's generated migration may order these incorrectly — inspect the SQL before applying. Run the FK audit query first to confirm no domain table has an unexpected FK into the Auth.js `users` table.

**5. Both parents must re-sign-in immediately after deployment (OPERATIONAL)**
Auth.js and Supabase Auth use incompatible cookie namespaces — both parents will be force-logged-out on first deployment. GCal sync will fail until both parents have signed in under the new auth stack. Coordinate a simultaneous sign-in immediately after deploy before any publish is attempted.

---

## RLS Design

All decisions for v1.2 are intentionally simple — any authenticated user can read and write everything. Row-level ownership is deferred to AUDT-01.

**Domain tables** (`children`, `schedules`, `schedule_entries`, `gcal_events`) — identical policy on all four:

```sql
ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON public.<table>
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
```

GCal sync writes to `gcal_events` via the admin connection which bypasses RLS — the policy does not interfere.

**`user_google_tokens`** — owner-scoped:

```sql
ALTER TABLE public.user_google_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_only" ON public.user_google_tokens
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id::uuid)
  WITH CHECK ((select auth.uid()) = user_id::uuid);
```

Each parent can only see their own token row via any RLS-respecting client. GCal sync reads via admin connection, bypassing this policy — correct behavior.

**`user_google_tokens` table schema** (raw SQL — Drizzle cannot express FK to `auth.users`):

```sql
CREATE TABLE public.user_google_tokens (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email         text        NOT NULL,
  refresh_token text        NOT NULL,
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX user_google_tokens_user_id_idx ON public.user_google_tokens(user_id);
CREATE UNIQUE INDEX user_google_tokens_email_idx   ON public.user_google_tokens(email);
```

Drizzle schema mirrors this without the FK declaration (cross-schema FK not supported by Drizzle). The FK is enforced by the raw SQL migration only.

**`buildGCalClient` after migration:** reads by `email` (matching `ownerEmail` from `app.ts`), uses the admin Drizzle connection. Always exchanges `refresh_token` for a fresh `access_token` on each GCal call — never relies on the stored `access_token` which expires in ~1 hour.

---

## Open Questions

1. **Error UX when `user_google_tokens` row is absent for a parent.** With `prompt:consent` forced on every sign-in this should not occur in normal flow, but if one parent has not signed in yet after deployment, GCal sync for their calendar fails at publish time. Decision: show a dismissible warning banner on dashboard load when the current user's token row is absent, prompting sign-out and back in.

2. **`withRLS` adoption scope for v1.2.** The `USING (true)` policies mean the admin `db` technically satisfies them already. Recommendation: implement `withRLS` for schedule-mutation Server Actions now to establish the pattern for AUDT-01; leave GCal sync and token ops on admin `db`.

3. **Google Cloud Console redirect URI.** Must point to `https://<ref>.supabase.co/auth/v1/callback` (Supabase's auth server), NOT the Next.js app's `/auth/callback`. The `redirectTo` in `signInWithOAuth` is the post-auth redirect to the app's callback handler. Confirm both are configured before any sign-in testing.

4. **Supabase Dashboard URL configuration for preview deployments.** Add `https://*.vercel.app/auth/callback` to the Supabase allowlist if preview deployments are used. Confirm before first end-to-end test on a preview URL.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Package changes | HIGH | Verified against installed package.json; no new installs needed |
| PKCE / OAuth flow | HIGH | Confirmed in official Supabase docs and Context7 source |
| provider_refresh_token behavior | HIGH | Confirmed by multiple official GitHub issues marked by-design; callback-only window is definitive |
| Middleware double-cookie pattern | HIGH | Exact pattern from official Supabase SSR docs |
| RLS policies | HIGH | SQL verified; Drizzle pgPolicy declarations confirmed against Drizzle docs |
| withRLS Drizzle pattern | MEDIUM | Community pattern (rphlmr/drizzle-supabase-rls); works but not officially documented by Drizzle |
| Auth.js table drop order | HIGH | FK chain is straightforward; verified against Postgres docs |
| ISR / dynamic = force-dynamic | HIGH | Standard Next.js pattern; critical for preventing cookie cross-contamination |

**Overall: HIGH** — all critical patterns are sourced from official documentation or confirmed-by-design GitHub issues.

---

## Roadmap Implications

The migration decomposes into three natural phases with a hard gate between phases 1-2 and phase 3:

**Phase 1: New auth stack in parallel (non-destructive)**
Wire all Supabase Auth infrastructure while Auth.js is still present. Deliverables: `user_google_tokens` table, `/auth/callback` route, `signInWithGoogle` Server Action, Supabase middleware, updated client utilities, updated `buildGCalClient`. Gate: sign in with new flow, confirm token row exists, confirm GCal sync works end-to-end.

**Phase 2: RLS enablement**
Enable RLS on all domain tables. Implement `withRLS` for Server Actions. Test that unauthenticated requests are blocked. Can happen while Auth.js is still installed.

**Phase 3: Auth.js removal (destructive)**
Drop Auth.js schema tables (FK-safe order), remove packages, clean import sites, remove env vars. Deploy. Coordinate both parents re-signing-in immediately after deployment before any publish is attempted.

Research flags: None — all phases have well-documented patterns. No phase requires additional research.

---

*Synthesized for: Vuoroasuminen v1.2 — Supabase Auth Migration*
*Synthesized: 2026-05-09*
