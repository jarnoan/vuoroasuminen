# Pitfalls Research

**Domain:** Co-parenting custody scheduling web app with Google Calendar integration and real-time collaboration
**Researched:** 2026-04-04 (original); 2026-05-09 (v1.2 migration supplement)
**Confidence:** HIGH (OAuth/Calendar API behavior verified against official Google docs; real-time patterns from multiple corroborating sources; migration pitfalls verified against Supabase official docs and open GitHub issues)

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

---

## Phase-Specific Warnings — v1.2 Migration

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| OAuth callback route | provider_refresh_token unavailable outside callback (M-1) | Capture and persist to `user_google_tokens` immediately in callback handler |
| Middleware replacement | Missing double cookie write, module-scope client, getSession() usage (M-2) | Follow exact Supabase SSR middleware pattern; test session refresh across requests |
| RLS enablement | service_role client silently bypasses all policies (M-3) | Test with anon key / unauthenticated request to verify policies block access |
| Schema cleanup | FK constraint order on Auth.js table drop (M-4) | Drop in order: verificationTokens → sessions → accounts → users; or use CASCADE |
| Deployment | Both parents forced re-login; GCal sync unavailable until both sign in (M-5) | Communicate to both parents; deploy when both available to sign in together |
| Dashboard caching | ISR cache leaks refreshed JWT cookies across users (M-6) | Add `export const dynamic = 'force-dynamic'` to all authenticated route segments |
| GCal token handoff | v1.2 sync reads `user_google_tokens`, not old `accounts` table (M-1, M-7) | Build and test new `buildGCalClient()` before dropping Auth.js schema |

---

## Sources

- Supabase Docs — Login with Google (official): https://supabase.com/docs/guides/auth/social-login/auth-google
- Supabase Docs — Server-Side Auth for Next.js (official): https://supabase.com/docs/guides/auth/server-side/nextjs
- Supabase Docs — Advanced SSR Auth Guide (official): https://supabase.com/docs/guides/auth/server-side/advanced-guide
- Supabase Docs — Row Level Security (official): https://supabase.com/docs/guides/database/postgres/row-level-security
- Drizzle ORM Docs — RLS support (official): https://orm.drizzle.team/docs/rls
- GitHub: supabase/supabase-js#934 — provider_refresh_token missing after session refresh (by-design): https://github.com/supabase/supabase-js/issues/934
- GitHub: supabase/auth#1387 — Cross-origin refreshing of provider_token not allowed: https://github.com/supabase/auth/issues/1387
- GitHub: supabase/supabase#21490 — PKCE flow messes with provider_token refresh: https://github.com/supabase/supabase/issues/21490
- GitHub: orgs/supabase/discussions#22653 — How to store provider_refresh_token: https://github.com/orgs/supabase/discussions/22653
- rphlmr/drizzle-supabase-rls — Community RLS+Drizzle pattern: https://github.com/rphlmr/drizzle-supabase-rls
- MakerKit — Using Drizzle as Supabase client (RLS pattern, January 2025): https://makerkit.dev/docs/next-supabase-turbo/recipes/drizzle-supabase
- Google OAuth 2.0 for Web Server Applications (official): https://developers.google.com/identity/protocols/oauth2/web-server
- Google Calendar API Scopes (official): https://developers.google.com/workspace/calendar/api/auth

---

*Pitfalls research for: Co-parenting custody scheduling app with Google Calendar integration (vuoroasuminen)*
*Original research: 2026-04-04 | v1.2 migration supplement: 2026-05-09*
