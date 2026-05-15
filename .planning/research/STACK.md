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

---

# Stack — Vercel Deployment (v1.3)

**Researched:** 2026-05-15
**Scope:** Two Supabase projects (staging + production) with Vercel preview and production environments
**Confidence:** HIGH — core patterns verified against Supabase official docs, Vercel CLI docs, and community discussions

---

## New Dependencies

| Package | Version | Purpose | Why Needed |
|---------|---------|---------|------------|
| `supabase` (devDependency) | `2.98.2` | `supabase db push --db-url <url>` — apply Drizzle-generated SQL migrations to remote projects in CI without running a local Supabase stack | Drizzle's `db:push` command (`drizzle-kit push`) is a schema-sync shortcut that bypasses migration history — it is unsuitable for production because it can silently drop columns. The Supabase CLI's `db push` command applies versioned SQL files with a migration history table, making it safe for automated CI deployment to both staging and production. Install as devDep so the exact version is pinned and reproducible in GitHub Actions via `npm ci`. |
| `vercel` (devDependency) | `54.1.0` | `vercel env add / env pull` — manage per-environment variables from the CLI during initial Vercel project setup | The Supabase Vercel marketplace integration supports only one linked Supabase project per Vercel project. Because this deployment uses two separate projects (staging + prod), env vars must be set manually. The CLI enables scripted, repeatable setup of the ~15 vars that differ per environment. Not required at runtime; can also be done via the Vercel dashboard. |

No other new runtime packages are needed. The existing stack (Next.js 16, @supabase/supabase-js, @supabase/ssr, Drizzle ORM, googleapis) handles both environments without changes.

---

## Configuration Changes

### 1. `drizzle.config.ts` — change `out` directory

**Current:** `out: "./drizzle"`

**Change to:** `out: "./supabase/migrations"`

**Why:** The Supabase CLI's `supabase db push` reads from `supabase/migrations/` by convention. Aligning Drizzle's output directory with that path means the same SQL files are the authoritative source for both local schema introspection and CI migration deployment. The existing migration file at `drizzle/0000_slow_tag.sql` must be moved to `supabase/migrations/0000_slow_tag.sql`; the `drizzle/meta/` directory moves to `supabase/migrations/meta/`.

### 2. `.env.example` — add `NEXT_PUBLIC_SITE_URL`

```env
# Canonical production URL — used to construct absolute OAuth redirect URLs.
# Set to your Vercel production domain (e.g. https://vuoroasuminen.vercel.app).
# Leave unset in preview environments; the app falls back to NEXT_PUBLIC_VERCEL_URL.
NEXT_PUBLIC_SITE_URL=
```

**Why:** Supabase Auth's `signInWithOAuth` call requires an absolute `redirectTo` URL. In production this must be the canonical domain. In Vercel preview deployments, `NEXT_PUBLIC_VERCEL_URL` is automatically injected per-deployment. The auth redirect logic must therefore use: `process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_VERCEL_URL ?? 'http://localhost:3000'`.

`SUPABASE_SERVICE_ROLE_KEY` is already present in the codebase per v1.2 research — confirm it is in `.env.example` and in `src/env.ts` validation.

### 3. `src/env.ts` — add `NEXT_PUBLIC_SITE_URL` (optional, non-fatal if absent)

`NEXT_PUBLIC_SITE_URL` should be optional — absent on preview deployments where `NEXT_PUBLIC_VERCEL_URL` fills the role. Do not add it to the required array; instead use a fallback chain in the auth callback route.

### 4. Vercel project — environment variable setup (manual, no marketplace integration)

The Supabase marketplace integration only supports one project link and auto-sets production variables. Skip it. Set all variables manually with scoped values:

**Variables to set for Production scope only (`vercel env add <name> production`):**
- `NEXT_PUBLIC_SUPABASE_URL` → production project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → production anon key
- `SUPABASE_SERVICE_ROLE_KEY` → production service role key
- `DATABASE_URL` → production direct connection string (port 5432, not pooler)
- `NEXT_PUBLIC_SITE_URL` → `https://<production-domain>`
- `PARENT_FATHER_EMAIL`, `PARENT_MOTHER_EMAIL` → real parent emails
- `PARENT_FATHER_NAME`, `PARENT_MOTHER_NAME` → display names
- `PARENT_FATHER_CALENDAR_ID`, `PARENT_MOTHER_CALENDAR_ID` → real calendar IDs
- `APP_CHILDREN` → real children names
- `APP_START_DATE` → real alternating-week start date
- `APP_FIRST_PARENT` → `father` or `mother`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` → Google OAuth credentials (same values as staging if sharing one OAuth client)

**Variables to set for Preview scope only (`vercel env add <name> preview`):**
- Same variable names, values pointing at the staging Supabase project
- `NEXT_PUBLIC_SITE_URL` → omit or leave empty (let `NEXT_PUBLIC_VERCEL_URL` handle preview URLs)
- `PARENT_*` and `APP_*` → can mirror production values or use test values; staging DB is fully isolated

**Vercel system variable to rely on (injected automatically, no action needed):**
- `NEXT_PUBLIC_VERCEL_URL` — set by Vercel per-deployment to the unique preview URL (e.g. `vuoroasuminen-abc123-jarno.vercel.app`); use this in the auth redirect fallback

### 5. Supabase Dashboard — per-project Auth settings

Each Supabase project requires identical configuration steps (done twice, once per project):

- **Authentication → Providers → Google:** enter `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- **Authentication → URL Configuration → Site URL:** set to the canonical URL for that environment
  - Production: `https://<production-domain>`
  - Staging: the fixed preview URL for the `main`-branch staging deployment, or leave as default
- **Authentication → URL Configuration → Additional Redirect URLs:** add `https://*-<vercel-account-slug>.vercel.app/**` to accept all Vercel preview deployment URLs without listing each one individually (Supabase supports glob patterns; Google Cloud Console does not)

### 6. Google Cloud Console — OAuth authorized redirect URIs

The OAuth callback that Supabase receives is always `https://<supabase-project-ref>.supabase.co/auth/v1/callback`. Each Supabase project has a distinct project ref, so both must be registered explicitly in Google Cloud Console → APIs & Services → Credentials → Authorized redirect URIs:

```
https://<staging-project-ref>.supabase.co/auth/v1/callback
https://<production-project-ref>.supabase.co/auth/v1/callback
```

Google does not accept wildcards in redirect URIs. The Vercel preview deployment URLs never appear in Google's redirect URI list — Supabase acts as the OAuth intermediary and handles the preview URL matching via its own wildcard Redirect URLs configuration.

### 7. GitHub Actions — migration CI/CD (new `.github/workflows/` directory)

Two workflow files handle automatic schema migration on branch merge. These replace the current manual `npm run db:push` workflow for remote deployments.

**`.github/workflows/migrate-staging.yml`** (trigger: push to `develop` branch or all preview branches):
```yaml
name: Migrate Staging DB
on:
  push:
    branches: [develop]
jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '24' }
      - run: npm ci
      - run: npx supabase db push --db-url "$STAGING_DATABASE_URL"
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          STAGING_DATABASE_URL: ${{ secrets.STAGING_DATABASE_URL }}
```

**`.github/workflows/migrate-production.yml`** (trigger: push to `main`):
```yaml
name: Migrate Production DB
on:
  push:
    branches: [main]
jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '24' }
      - run: npm ci
      - run: npx supabase db push --db-url "$PROD_DATABASE_URL"
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          PROD_DATABASE_URL: ${{ secrets.PROD_DATABASE_URL }}
```

**GitHub repository secrets required:**
- `SUPABASE_ACCESS_TOKEN` — personal access token from Supabase Dashboard → Account → Access Tokens (shared across both workflows)
- `STAGING_DATABASE_URL` — staging project direct connection string (port 5432)
- `PROD_DATABASE_URL` — production project direct connection string (port 5432)

Note: `--db-url` with `SUPABASE_ACCESS_TOKEN` bypasses the interactive `supabase link` step, making the workflow fully non-interactive.

---

## Not Needed

| Item | Why Not |
|------|---------|
| Supabase database branching | Supabase's branching feature creates ephemeral per-PR Supabase instances — valuable for teams reviewing migrations in isolation. For a two-user app with two environments, two named projects are sufficient and avoid the complexity and per-branch billing. |
| Separate Google OAuth clients per environment | One OAuth client with both Supabase callback URIs registered covers both environments. Separate clients are only justified when independent secret rotation or strict audit separation is required — not the case here. |
| Supabase Vercel marketplace integration | Only allows one Supabase project per Vercel project. Skip entirely; manual env var setup via Vercel dashboard/CLI is cleaner when two projects are involved. |
| `@vercel/postgres` or Vercel Storage products | Database is Supabase Postgres. Vercel's own storage products are irrelevant. |
| `dotenv-cli`, `env-cmd`, or cross-env | `vercel env pull` handles syncing remote env vars to local `.env.local`. No extra dotenv tooling needed. |
| Separate `next.config.ts` per environment | Next.js does not support per-environment config files natively. All environment differences flow through `process.env.*` already handled in `src/env.ts` and `src/config/app.ts`. |
| `t3-env` / `@t3-oss/env-nextjs` | The existing `src/env.ts` validation covers the ~12 required variables adequately. Introducing a dependency for a fixed-size env schema adds no value. |
| Vercel Pro "Custom Environments" | Designed for teams with many persistent non-main branches needing dedicated env var sets. For one staging + one production, free-tier `preview` and `production` environment scoping is sufficient. |
| `supabase init` / local Supabase Docker stack | The project uses a remote staging project for development (not local Supabase). Only the CLI's `db push` subcommand is needed; no `supabase/config.toml`, no Docker dependency. |
| `drizzle-kit push` for production migrations | `drizzle-kit push` is a schema-sync tool — it introspects the current DB state and applies the diff without migration files. This means no audit trail and potential data loss on column renames. Use `drizzle-kit generate` to produce SQL files, then `supabase db push` in CI to apply them safely. Keep `npm run db:push` only for local dev iteration on the staging project. |

---

## Sources

- Supabase docs — Managing Environments (CI/CD migrations with GitHub Actions): https://supabase.com/docs/guides/deployment/managing-environments
- Supabase blog — The Vibe Coder's Guide to Supabase Environments (two-project strategy): https://supabase.com/blog/the-vibe-coders-guide-to-supabase-environments
- Supabase docs — Redirect URLs (wildcard patterns for Vercel preview URLs): https://supabase.com/docs/guides/auth/redirect-urls
- Supabase docs — Google OAuth provider (callback URL pattern): https://supabase.com/docs/guides/auth/social-login/auth-google
- Supabase GitHub Discussion #30561 — multiple Supabase projects with Vercel (integration limitation, manual env vars required): https://github.com/orgs/supabase/discussions/30561
- Vercel docs — Environment Variables (production vs preview scoping): https://vercel.com/docs/environment-variables
- Vercel docs — `vercel env` CLI reference: https://vercel.com/docs/cli/env
- Vercel Community — Google OAuth redirect URL with Vercel preview URLs + Supabase (wildcard solution): https://community.vercel.com/t/google-oauth-redirect-url-with-vercel-preview-urls-supabase/6345
- Drizzle ORM migration strategy with Supabase in production (case study, generate vs push): https://zenn.dev/azuma317/articles/drizzle-migration-supabase-production?locale=en
- `supabase` npm version 2.98.2 — verified via `npm view supabase version`
- `vercel` npm version 54.1.0 — verified via `npm view vercel version`

---
*Stack addendum for: Vuoroasuminen v1.3 — Vercel deployment*
*Updated: 2026-05-15*
