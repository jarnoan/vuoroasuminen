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

---

# Stack — Mobile-First Responsive Layout (v1.4)

**Researched:** 2026-05-17
**Scope:** Additions and config changes only. Existing stack (Next.js 16, Tailwind v4, shadcn/ui canary, Supabase, TypeScript 5) is NOT re-evaluated.
**Confidence:** HIGH — verified against Tailwind v4 official docs, Next.js 16.2.6 official docs, Context7 shadcn/ui corpus, and npm registry.

---

## New Package Additions

| Package | Version | Install Command | Why |
|---------|---------|----------------|-----|
| `vaul` | `^1.1.2` | via `npx shadcn@canary add drawer` (auto-installed) | shadcn/ui Drawer component wraps vaul; needed for the statistics panel bottom-sheet on mobile (MOB-05). Not in project node_modules yet. |
| `tailwindcss-safe-area` | `^1.3.0` | `npm install tailwindcss-safe-area` | iOS notch/home-indicator safe-area insets. Required only if the implementation adds fixed/sticky elements that touch screen edges. Conditional — flag during phase planning. |

No other npm installs are required. All other responsive work uses existing Tailwind v4 utilities, copy-pasted shadcn hooks, and configuration changes.

---

## Tailwind v4 Responsive Utilities

**Confidence: HIGH** — verified against official Tailwind v4 documentation.

Tailwind v4 is mobile-first by default. No patterns from the existing codebase break. The relevant additions for v1.4:

### Container queries (built into v4, no plugin)

Container queries let a component respond to its *parent container's* width rather than the viewport. This is the correct pattern for the schedule table: the table lives inside a constrained column, so it should reflow based on available container width, not a guess about viewport width.

Mark a container element with `@container`, then use `@sm:`, `@md:`, etc. on children:

```html
<div class="@container">
  <div class="flex-col @md:flex-row">…</div>
</div>
```

Named containers work for nested layouts:
```html
<div class="@container/table">
  <th class="hidden @sm/table:table-cell">Notes</th>
</div>
```

No plugin install needed. No `tailwind.config.js` entry. Works in v4 out of the box.

### Column hide/show pattern

Standard Tailwind pattern for hiding table columns on narrow viewports:

```html
<th class="hidden sm:table-cell">Notes</th>
<td class="hidden sm:table-cell">…</td>
```

For the custody schedule: the Notes column is the natural candidate to hide at the narrowest viewports (360px). Day and child columns stay always visible.

### Range variants (new in v4)

`md:max-lg:flex` — applies only between md and lg breakpoints. Useful for mid-range adjustments without extra class clutter.

### Custom breakpoints (v4 syntax — CSS, not config file)

```css
/* app/globals.css */
@import "tailwindcss";
@theme {
  --breakpoint-xs: 22.5rem; /* 360px — target phone minimum */
}
```

No `tailwind.config.js` needed. Adding an `xs` breakpoint makes `xs:`, `max-xs:` available throughout the app for 360px targeting.

---

## shadcn/ui Mobile Components

**Confidence: HIGH** — verified against Context7 shadcn/ui corpus (llms.txt, May 2026).

### Drawer (bottom sheet)

shadcn/ui Drawer wraps vaul. Install via:

```bash
npx shadcn@canary add drawer
```

This adds `vaul` as a runtime dependency automatically. The Drawer renders as a bottom sheet that slides up from the screen bottom — the right UX for the statistics panel collapse on mobile (MOB-05).

The official shadcn/ui responsive pattern pairs Drawer (mobile) with Dialog (desktop) using `useMediaQuery`:

```tsx
const isDesktop = useMediaQuery("(min-width: 768px)")
if (isDesktop) return <Dialog>…</Dialog>
return <Drawer open={open} onOpenChange={setOpen}>…</Drawer>
```

### Sheet (slide-in panel)

shadcn/ui Sheet slides from any edge (top/right/bottom/left). The Sidebar component already uses Sheet for mobile nav internally. Relevant for header/nav adaptation (MOB-04).

Install via:
```bash
npx shadcn@canary add sheet
```

### Table

shadcn/ui Table wraps in `overflow-x-auto` by default — this creates horizontal scroll, which is exactly what v1.4 must eliminate. The fix is to override the table markup with grid/flex-based layout for narrow viewports using container query classes. No new component is needed; the change is in how the existing schedule table is structured.

---

## useMediaQuery Hook

**Confidence: HIGH** — verified against shadcn.io/hooks documentation.

shadcn.io provides a `useMediaQuery` hook as a copy-paste TypeScript snippet at https://shadcn.io/hooks/use-media-query. This is not an installable package — per the shadcn design philosophy, you own the code.

Copy it into `src/hooks/use-media-query.ts`. The hook:
- Uses `window.matchMedia` API
- Accepts a `defaultValue` parameter for SSR safety (prevents hydration mismatch)
- Must be used inside a `'use client'` component

**Set `defaultValue: false` (assume mobile)** to avoid a desktop-layout flash on first render on phones. The component will correct to the actual value after hydration.

**Server-side breakpoint detection:** Not needed for v1.4. All responsive layout switching is CSS-driven (Tailwind utilities + container queries). No server-side user-agent sniffing or cookie-based breakpoint detection should be added — this pattern is fragile and unnecessary when CSS handles the layout.

---

## Viewport Meta Tag

**Confidence: HIGH** — verified against Next.js 16.2.6 official docs (last updated 2026-05-13).

Next.js App Router automatically injects into every page:

```html
<meta name="viewport" content="width=device-width, initial-scale=1" />
```

No action is needed for basic mobile scaling.

**Do not add `maximum-scale=1` or `user-scalable=no`.** Pinch-to-zoom is an accessibility requirement. Disabling it fails WCAG 1.4.4 and frustrates users with low vision.

**Add a `viewport` export only if `tailwindcss-safe-area` is used**, because safe-area insets require `viewport-fit=cover`:

```ts
// app/layout.tsx
import type { Viewport } from 'next'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',   // enables env(safe-area-inset-*) on iOS
}
```

---

## iOS Safe Area Insets

**Confidence: HIGH** — verified against tailwindcss-safe-area GitHub README (v4 section confirmed) and npm registry (v1.3.0).

iPhones with notches and home indicators need `env(safe-area-inset-*)` padding to prevent content hiding behind system chrome.

`tailwindcss-safe-area` v1.3.0 supports Tailwind v4 natively via `@import` (not `@plugin` — v4 uses a different plugin API):

```bash
npm install tailwindcss-safe-area
```

```css
/* app/globals.css */
@import "tailwindcss";
@import "tailwindcss-safe-area";
```

Provides utilities: `pb-safe`, `pt-safe`, `px-safe`, `pr-safe-offset-4` (safe area + 4), `pb-safe-or-8` (max of safe area or 8).

**Prerequisite:** `viewportFit: 'cover'` in the `viewport` export (see above). Without it, `env(safe-area-inset-*)` evaluates to 0.

**Scope flag:** Only add `tailwindcss-safe-area` if the implementation adds fixed/sticky bottom elements (e.g. a floating action toolbar). If all content scrolls normally without fixed positioning near screen edges, safe area insets are not needed.

---

## Touch Gesture Libraries

**Confidence: HIGH** — verified against npm registry and library documentation.

**Recommendation: Do not add any gesture library for v1.4.**

The five v1.4 requirements (MOB-01 through MOB-05) are all solved by CSS layout changes and existing shadcn/ui components:

| Requirement | Solution | Needs gesture lib? |
|-------------|---------|-------------------|
| MOB-01 — table reflow | Tailwind container queries + column hiding | No |
| MOB-02 — clear button guard | shadcn/ui AlertDialog (confirm tap) | No |
| MOB-03 — view toolbar compact | Tailwind responsive classes | No |
| MOB-04 — header/nav mobile | shadcn/ui Sheet | No |
| MOB-05 — statistics panel collapse | shadcn/ui Drawer | No |

**If a future phase requires swipe-to-reveal on table rows**, the right library is `react-swipeable` v7.0.2 (2.1 KB, zero dependencies, `useSwipeable` hook, supports mouse + touch). Do not install it now.

Do not use `@use-gesture/react` for this use case — it is a full gesture system (drag, pinch, scroll, wheel) that adds unnecessary bundle weight for a layout-only task.

---

## What NOT to Add

| Package | Why Not |
|---------|---------|
| `react-swipeable` | No swipe interactions in v1.4 scope |
| `@use-gesture/react` | Full gesture system, overkill for layout work |
| `next-useragent` / `ua-parser-js` | Server-side breakpoint sniffing is fragile and unnecessary; CSS + container queries handle all layout |
| Any `window.matchMedia` polyfill | Not needed — target is modern smartphones (iOS 15+, Chrome 100+) |
| `framer-motion` | Animation is not a v1.4 requirement; Tailwind transitions are sufficient |

---

## Installation Summary

```bash
# Drawer component — also installs vaul@^1.1.2 automatically:
npx shadcn@canary add drawer

# Sheet component (if not already installed):
npx shadcn@canary add sheet

# Safe area insets (conditional — only if fixed/sticky bottom elements are added):
npm install tailwindcss-safe-area
```

```css
/* app/globals.css — add only if tailwindcss-safe-area is installed */
@import "tailwindcss";
@import "tailwindcss-safe-area";
```

```ts
/* app/layout.tsx — add only if tailwindcss-safe-area is installed */
import type { Viewport } from 'next'
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}
```

```ts
/* Copy to src/hooks/use-media-query.ts — no npm install */
// Source: https://shadcn.io/hooks/use-media-query
```

---

## Sources

- Tailwind CSS v4 Responsive Design (official docs): https://tailwindcss.com/docs/responsive-design
- Tailwind CSS v4 Container Queries (SitePoint, 2025): https://www.sitepoint.com/tailwind-css-v4-container-queries-modern-layouts/
- shadcn/ui Drawer component docs: https://ui.shadcn.com/docs/components/drawer
- shadcn/ui Sheet component docs: https://ui.shadcn.com/docs/components/sheet
- shadcn/ui Table component docs: https://ui.shadcn.com/docs/components/table
- shadcn.io useMediaQuery hook: https://www.shadcn.io/hooks/use-media-query
- Next.js 16 generateViewport API reference (updated 2026-05-13): https://nextjs.org/docs/app/api-reference/functions/generate-viewport
- tailwindcss-safe-area GitHub (v4 @import support): https://github.com/mvllow/tailwindcss-safe-area
- vaul npm (v1.1.2, React 19 peer dep confirmed): https://github.com/emilkowalski/vaul
- react-swipeable v7.0.2 (FormidableLabs — for future reference): https://github.com/FormidableLabs/react-swipeable

---
*Stack addendum for: Vuoroasuminen v1.4 — Mobile-First Responsive Layout*
*Updated: 2026-05-17*
