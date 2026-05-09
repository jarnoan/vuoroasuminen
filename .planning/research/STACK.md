# Stack Research

**Domain:** Real-time collaborative scheduling web app (co-parenting custody planner)
**Researched:** 2026-05-09 (updated for v1.2 Supabase Auth migration)
**Confidence:** HIGH (core stack verified via Context7 and official Supabase docs)

---

## v1.2 Migration: Auth.js → Supabase Auth

This section supersedes the Auth.js portions of the original stack research. All other stack
decisions (Next.js 16, Drizzle ORM, Supabase PostgreSQL + Realtime, Tailwind v4, googleapis)
remain unchanged and are not re-researched here.

---

### Packages to Remove

| Package | Installed Version | Why Remove |
|---------|------------------|------------|
| `next-auth` | `^5.0.0-beta.30` | Replaced by Supabase Auth entirely; no longer needed for session management or OAuth |
| `@auth/drizzle-adapter` | `^1.11.1` | Auth.js adapter — persisted Auth.js `accounts`/`sessions`/`users` tables; those tables are being dropped |

**Uninstall command:**
```bash
npm uninstall next-auth @auth/drizzle-adapter
```

---

### Packages to Add or Update

#### @supabase/ssr — Already Present, Version Is Current

Current installed version: `^0.10.0`
Latest release: `0.10.3` (May 7, 2026)

`@supabase/ssr` is already in the project and covers everything needed for Supabase Auth in
Next.js App Router: `createServerClient` for Server Components / Route Handlers / Middleware,
`createBrowserClient` for Client Components. **No new package install required.**

The `^0.10.0` range will resolve to `0.10.3`. The `0.10.x` series contains the fix for
Next.js 15 async `cookies()` handling — the fix is to `await cookies()` when calling
`createServerClient` inside server functions. This pattern is now the documented standard.

#### @supabase/supabase-js — Already Present, No Change

Current installed version: `^2.101.1`. Used for Realtime subscriptions. No change needed.

---

### Environment Variables

#### Already in project (Supabase platform)

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

The `NEXT_PUBLIC_SUPABASE_ANON_KEY` name remains valid until end of 2026. Supabase is rolling
out new `sb_publishable_xxx` keys (opt-in as of mid-2025, forced migration no earlier than
late 2026). No action required for v1.2; the existing anon key continues to work.

#### New for v1.2 — Google OAuth credentials in Supabase Dashboard

These are configured in the Supabase Dashboard (Authentication → Providers → Google), NOT as
app-level env vars. The Google Client ID and Secret live in the Supabase project config, not
in the Next.js `.env.local`.

For local development with Supabase CLI, they map to:
```env
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=<google-client-id>
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET=<google-client-secret>
```
These are CLI-only / `supabase/config.toml` values. In production, set them via the Supabase
Dashboard — they do not appear in the Next.js `.env`.

#### Already in project — Google Calendar API (unchanged)

```env
GOOGLE_CLIENT_ID=<same-value>
GOOGLE_CLIENT_SECRET=<same-value>
```

These continue to be used by `googleapis` for server-side Calendar sync. They are separate
from Supabase's OAuth credentials (same Google Cloud credentials can be reused — same Client ID
and Secret — but they serve different code paths: Supabase for login, googleapis for GCal).

#### New for v1.2 — Supabase service-role key for RLS bypass in server actions

```env
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

Required when Server Actions need to write to tables that have RLS enabled, where the user's
JWT is not available (e.g., background GCal sync writing to `gcal_events`). Use the service
role client only on the server; never expose to the browser.

---

### Google OAuth Provider Token Access

**Critical constraint:** Supabase Auth does NOT persist `provider_token` or
`provider_refresh_token` in the database. They are available only once: in the session
returned by `exchangeCodeForSession` in the OAuth callback route.

**The v1.2 design uses a `user_google_tokens` table** (per PROJECT.md) where the app
manually stores the Google refresh token extracted from the callback. This is the correct
approach — store it yourself immediately in the callback handler.

**Required signInWithOAuth parameters to get a Google refresh token:**
```typescript
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${origin}/auth/callback`,
    queryParams: {
      access_type: 'offline',   // makes Google issue a refresh_token
      prompt: 'consent',        // forces re-consent; ensures refresh_token is re-issued
    },
    scopes: 'https://www.googleapis.com/auth/calendar',
  },
})
```

Both `access_type: 'offline'` and `prompt: 'consent'` are required — this mirrors the pattern
that solved the `invalid_grant` bug in v1.0 (same decision logged in PROJECT.md Key Decisions).

**Callback route — where to extract and persist the tokens:**
```typescript
// app/auth/callback/route.ts
const { data, error } = await supabase.auth.exchangeCodeForSession(code)
const providerRefreshToken = data.session?.provider_refresh_token
const providerAccessToken  = data.session?.provider_token
// → INSERT INTO user_google_tokens (user_email, refresh_token, access_token, ...) ...
```

`provider_refresh_token` and `provider_token` are present in the session object returned by
`exchangeCodeForSession` when `access_type: 'offline'` and `prompt: 'consent'` were passed.
They are NOT persisted by Supabase and are only available at this moment — must be saved here.

---

### Next.js 15 + React 19 Compatibility

| Area | Status | Notes |
|------|--------|-------|
| `@supabase/ssr` 0.10.x + Next.js 15 | Compatible | Requires `await cookies()` (async) — already the documented pattern in Supabase's current guides |
| `@supabase/supabase-js` 2.x + React 19 | Compatible | No known issues |
| `createServerClient` in Server Components | Compatible | Pass `cookieStore` obtained from `await cookies()` |
| `createServerClient` in Middleware | Compatible | Use `request.cookies.getAll()` (synchronous in middleware context) |

The `cookies() should be awaited` error seen in older setups is resolved by making the
`createClient` utility function `async` and `await`-ing `cookies()`. This is the current
pattern in all Supabase documentation as of 2026.

---

### Google Calendar Sync: Token Access Model Change

In v1.0/v1.1, Auth.js persisted Google refresh tokens automatically in the `accounts` table
via DrizzleAdapter. In v1.2, that table is removed. The new `user_google_tokens` table
replaces it with a simpler schema:

- Keyed by `user_email` (not internal user ID) — aligns with the `ownerEmail` field in `app.ts`
- GCal sync Server Action looks up the owner's refresh token by `ownerEmail`, constructs an
  `OAuth2Client` with that token, then calls googleapis as before
- Token refresh must be handled manually: catch `invalid_grant`, re-prompt user to sign in;
  or implement an explicit token refresh before each GCal API call using `OAuth2Client.refreshAccessToken()`

No new npm packages are needed for this — `googleapis` already handles the OAuth2 client
and token refresh mechanics.

---

## Updated Supporting Libraries Table (v1.2 state)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `@supabase/ssr` | `^0.10.0` (→ 0.10.3) | Supabase Auth session management in Next.js App Router | Already installed; covers auth need |
| `@supabase/supabase-js` | `^2.101.1` | Realtime subscriptions + browser auth client | Already installed; no change |
| `googleapis` | `^171.4.0` | Google Calendar API + OAuth2 token refresh | Already installed; no change |
| `drizzle-orm` | `^0.45.2` | DB queries for `user_google_tokens` and domain tables | Already installed; no change |
| `pg` | `^8.20.0` | PostgreSQL driver | Already installed; no change |
| `zod` | `^4.3.6` | Server Action validation | Already installed; no change |
| `next-auth` | `^5.0.0-beta.30` | **REMOVE** — replaced by Supabase Auth | Remove |
| `@auth/drizzle-adapter` | `^1.11.1` | **REMOVE** — no longer needed | Remove |

---

## What Changes vs. What Stays the Same

**Changes:**
- Auth session management: Auth.js JWT cookies → Supabase Auth cookie-based sessions
- Token persistence: Auth.js `accounts` table → custom `user_google_tokens` table
- Middleware: `auth()` from next-auth → `supabase.auth.getUser()` via `createServerClient`
- Session access in Server Components: `auth()` → `supabase.auth.getUser()` or `getSession()`

**Stays the same:**
- `googleapis` OAuth2Client usage for GCal sync — same API, different token source
- `@supabase/supabase-js` for Realtime subscriptions
- `createBrowserClient` from `@supabase/ssr` already in use for Realtime; now also used for
  `supabase.auth.signInWithOAuth()` and `supabase.auth.signOut()` in Client Components
- Drizzle ORM for all DB access; Drizzle schema gains `user_google_tokens` table, loses Auth.js tables
- All other dependencies unchanged

---

## Sources

- Supabase official docs — Login with Google: https://supabase.com/docs/guides/auth/social-login/auth-google
- Supabase official docs — Setting up Server-Side Auth for Next.js: https://supabase.com/docs/guides/auth/server-side/nextjs
- Supabase official docs — Auth quickstart for Next.js: https://supabase.com/docs/guides/auth/quickstarts/nextjs
- Context7 — @supabase/ssr docs (createServerClient, middleware, cookie setup): https://context7.com/supabase/ssr
- GitHub — supabase/ssr releases (v0.10.3 latest, May 7 2026): https://github.com/supabase/ssr/releases
- GitHub — supabase/ssr issue #107 (Next.js 15 async cookies compatibility): https://github.com/supabase/ssr/issues/107
- GitHub — supabase/ssr issue #75 (cookies() async update for Next.js 15): https://github.com/supabase/ssr/issues/75
- GitHub Discussion #22578 — storing provider tokens (Supabase doesn't persist them): https://github.com/orgs/supabase/discussions/22578
- GitHub Discussion #29260 — Upcoming changes to Supabase API Keys (publishable keys): https://github.com/orgs/supabase/discussions/29260

---
*Stack research updated for: Vuoroasuminen v1.2 — Supabase Auth migration*
*Updated: 2026-05-09*
