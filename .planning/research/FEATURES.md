# Features — Vercel Deployment

**Project:** Vuoroasuminen v1.3
**Researched:** 2026-05-15
**Confidence:** HIGH (all claims verified against official Vercel and Supabase docs, current 2026)

---

## Table Stakes (must have for production)

These must be done before the app can be considered deployed. Missing any of these = broken auth or wrong database.

### 1. Two separate Supabase projects exist

Create one project for staging/preview and one for production. They have different `project-ref` values, different database contents, different auth configurations, different API keys.

- Staging project: used by all Vercel Preview deployments (non-`main` branches)
- Production project: used only by Vercel Production deployments (`main` branch)

This is the only safe approach. The Supabase Vercel native integration (marketplace) does NOT scope variables per-environment for preview branches on the Hobby plan — it passes production credentials to preview by default. Manual env var configuration is required to get proper isolation.

### 2. Vercel environment variables wired per environment

Each of the following must be configured twice in Vercel — once scoped to **Production**, once scoped to **Preview** — pointing to the respective Supabase project.

Variables that differ between environments:

| Variable | Production value | Preview value |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<prod-ref>.supabase.co` | `https://<staging-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | prod anon key | staging anon key |
| `DATABASE_URL` | prod connection string (port 5432) | staging connection string |
| `GOOGLE_CLIENT_ID` | prod OAuth client ID | staging OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | prod OAuth client secret | staging OAuth client secret |

Variables that exist only in Production (app config, real user data):

| Variable | Notes |
|---|---|
| `PARENT_FATHER_EMAIL` | Real parent email |
| `PARENT_MOTHER_EMAIL` | Real parent email |
| `PARENT_FATHER_CALENDAR_ID` | Real Google Calendar ID |
| `PARENT_MOTHER_CALENDAR_ID` | Real Google Calendar ID |
| `PARENT_FATHER_NAME` | Display name in UI |
| `PARENT_MOTHER_NAME` | Display name in UI |
| `APP_CHILDREN` | Comma-separated real children names |
| `APP_START_DATE` | Real alternating schedule start date |
| `APP_FIRST_PARENT` | `father` or `mother` |

`NEXT_PUBLIC_` variables are embedded into the JavaScript bundle at build time — not runtime. Changing them in Vercel settings has no effect on existing deployments. A redeploy is required.

Server-only variables (no `NEXT_PUBLIC_` prefix) are read at runtime and take effect without rebuilding.

### 3. Supabase Auth — Site URL set to the correct app domain

In each Supabase project: Authentication → URL Configuration → Site URL.

This is the default redirect destination after auth when the app does not specify a `redirectTo`. It must be an exact match for the deployment domain.

- Production Supabase project: `https://vuoroasuminen.vercel.app` (or custom domain if configured)
- Staging Supabase project: `https://vuoroasuminen-git-staging-<team-slug>.vercel.app` (or whatever URL the staging branch resolves to)

Getting this wrong does not prevent login — it causes silent redirect failures to the wrong URL after auth.

### 4. Supabase Auth — Additional redirect URLs allowlist per project

Supabase Auth validates the `redirectTo` parameter against a per-project allowlist before redirecting after authentication. The app currently passes `window.location.origin + "/auth/callback"` as `redirectTo` — this is the correct pattern. It resolves dynamically to the actual domain the browser is on, so no code change is needed per environment.

For the **production** Supabase project, add:
- `https://vuoroasuminen.vercel.app/auth/callback`
- `https://vuoroasuminen.vercel.app/**` (broad fallback, covers future routes)

For the **staging** Supabase project, add:
- `https://vuoroasuminen-git-staging-<team-slug>.vercel.app/auth/callback`
- `https://*-vuoroasuminen-<team-slug>.vercel.app/**` (wildcard covers all preview deployment URLs)
- `http://localhost:3000/**` (local development)

Supabase wildcard syntax: `*` matches non-separator characters (not `.` or `/`), `**` matches any sequence. Use `**` after the path separator to cover all sub-paths. Do not use `*` to match subdomains — use the explicit subdomain format or `**` at the domain level.

### 5. Google OAuth — Supabase Auth Google provider configured per project

Each Supabase project needs Google OAuth credentials: Authentication → Providers → Google → enter Client ID + Client Secret.

After enabling, the Supabase dashboard shows a **Callback URL** for that project in the form:
```
https://<project-ref>.supabase.co/auth/v1/callback
```
This is different from the app's `/auth/callback` route. The Supabase callback URL is the internal endpoint that receives the authorization code from Google. The app's `/auth/callback` route is where users land after Supabase processes the code.

Both are needed; they do different things.

### 6. Google Cloud Console — Authorized redirect URIs registered

Google performs an exact byte-for-byte match on the redirect URI. The Supabase callback URL for each project must be registered as an Authorized redirect URI in the Google Cloud Console for the corresponding OAuth client.

For the staging OAuth client:
- Authorized redirect URIs: `https://<staging-ref>.supabase.co/auth/v1/callback`
- Authorized JavaScript origins: staging app domain + `http://localhost:3000`

For the production OAuth client:
- Authorized redirect URIs: `https://<prod-ref>.supabase.co/auth/v1/callback`
- Authorized JavaScript origins: production app domain

### 7. Production domain working before sharing with second user

The app must be reachable at a stable HTTPS URL. The default Vercel domain `vuoroasuminen.vercel.app` is sufficient for launch. If a custom domain is used, all Supabase Auth URLs (Site URL, additional redirect URLs), Google OAuth origins, and Vercel env vars must reflect the custom domain.

### 8. Supabase production project on paid plan before real-user handoff

Supabase free tier pauses projects after 1 week of inactivity. The production Supabase project must be upgraded to Pro ($25/month) before sharing with the second parent. The staging project can remain on the free tier.

---

## Environment Variable Strategy

### How Vercel maps deployments to environments

| Trigger | Environment | Which env vars are injected |
|---|---|---|
| Push to `main` | Production | Variables scoped to Production |
| Push to any other branch | Preview | Variables scoped to Preview |
| PR created | Preview | Variables scoped to Preview |
| `vercel --prod` CLI | Production | Variables scoped to Production |
| `vercel` CLI (no flag) | Preview | Variables scoped to Preview |

### Setting the same variable for multiple environments

A variable can be set multiple times in Vercel with different scopes. To have `NEXT_PUBLIC_SUPABASE_URL` point to different projects:

1. Add `NEXT_PUBLIC_SUPABASE_URL` scoped to **Production** → prod project URL
2. Add `NEXT_PUBLIC_SUPABASE_URL` scoped to **Preview** → staging project URL

This is the core mechanism for wiring two separate Supabase projects.

### Branch-specific overrides (Hobby plan staging pattern)

On the Hobby plan there are no Custom Environments (those require Pro). A `staging` branch can still get dedicated variables by scoping a Preview variable to a specific branch name. Branch-specific variables override same-named Preview variables.

For this project with a two-user app and minimal branching, the simpler model works: all Preview deployments use staging credentials, all Production deployments use production credentials. No branch-specific overrides needed.

### Key system variables Vercel provides automatically

| Variable | Scope | Value | Notes |
|---|---|---|---|
| `VERCEL_ENV` | Build + runtime | `production`, `preview`, or `development` | Useful for conditional logic |
| `VERCEL_URL` | Build + runtime | deployment URL without `https://` (e.g., `vuoroasuminen-abc123.vercel.app`) | Unique per deployment commit |
| `VERCEL_BRANCH_URL` | Build + runtime | branch URL without `https://` | Stable per branch |
| `VERCEL_PROJECT_PRODUCTION_URL` | Build + runtime | production domain, always set even in preview deployments | Useful for generating canonical OG URLs |

`NEXT_PUBLIC_VERCEL_URL` is the framework-prefixed version, available in client-side code. The current codebase does not need this because `window.location.origin` already resolves correctly at runtime.

### `NEXT_PUBLIC_` build-time baking

Variables prefixed `NEXT_PUBLIC_` are inlined into the compiled JavaScript bundle. If you change a `NEXT_PUBLIC_` variable value in the Vercel dashboard, the change does not apply to existing or in-progress deployments — only new deployments pick it up. Server-only variables (without `NEXT_PUBLIC_`) are evaluated at request time, so changes take effect without rebuilding.

### Pulling env vars locally

```bash
vercel env pull --environment=preview   # downloads staging credentials to .env.local
vercel env pull --environment=production # downloads production credentials (careful)
```

This replaces manual `.env.local` maintenance. `vercel env pull` without a flag downloads the Development environment (separate from Preview).

---

## Google OAuth per Environment

### Two separate OAuth clients are required

Google's production OAuth policy states that OAuth clients used in production must not contain test redirect URIs or JavaScript origins that are only available to developers. Sharing a single OAuth client between staging and production violates this requirement.

The correct setup:

**Staging Google Cloud OAuth client:**
- OAuth consent screen: Testing mode — only explicitly added Google accounts can sign in
- No verification required in testing mode
- Authorized redirect URIs: `https://<staging-ref>.supabase.co/auth/v1/callback`
- Authorized JavaScript origins: staging deployment domain + `http://localhost:3000`

**Production Google Cloud OAuth client (separate client, can be same or separate GCP project):**
- OAuth consent screen: Published — requires Google verification before external users can sign in
- Verification takes 3–5 business days — begin before scheduling second-parent access
- Authorized redirect URIs: `https://<prod-ref>.supabase.co/auth/v1/callback`
- Authorized JavaScript origins: production deployment domain only

### Why `window.location.origin` in the sign-in button is correct

The app passes `redirectTo: window.location.origin + "/auth/callback"`. This evaluates at click time in the browser to whatever domain is in the address bar. In production this becomes `https://vuoroasuminen.vercel.app/auth/callback`; in a preview deployment it becomes `https://vuoroasuminen-xyz123.vercel.app/auth/callback`.

This means no code changes are needed between environments. The only requirement is that whatever URL resolves is present in the Supabase additional redirect URLs allowlist for that project.

### Two-layer redirect validation — which service validates what

Google and Supabase each validate one redirect URL, and they are different URLs:

| Layer | What is validated | Where it is configured |
|---|---|---|
| Google | Supabase's internal callback URL (`/auth/v1/callback`) | Google Cloud Console → Authorized redirect URIs |
| Supabase | The app's `redirectTo` parameter (`/auth/callback`) | Supabase Auth → Additional redirect URLs |

A common mistake: registering the app's `/auth/callback` URL in Google's console. Google does not redirect to the app's callback — it redirects to Supabase. Supabase then redirects to the app.

### Full OAuth flow

```
1. User clicks sign in
2. Browser calls supabase.auth.signInWithOAuth({ redirectTo: window.location.origin + "/auth/callback" })
3. Supabase Auth constructs a Google authorization URL with:
      redirect_uri = https://<supabase-ref>.supabase.co/auth/v1/callback
4. Google validates: is that redirect_uri in the OAuth client's Authorized redirect URIs? YES
5. User authenticates with Google, Google redirects to Supabase /auth/v1/callback
6. Supabase exchanges code for tokens, stores Supabase session
7. Supabase validates: is the app's redirectTo in the Additional redirect URLs allowlist? YES
8. Supabase redirects browser to https://<app-domain>/auth/callback
9. App's /auth/callback route handler:
   a. Calls supabase.auth.exchangeCodeForSession(code)
   b. Reads provider_refresh_token from the session (only available at this moment)
   c. Upserts refresh token to user_google_tokens table
   d. Redirects to /dashboard
```

### Configuration matrix

| What to configure | Where | Staging | Production |
|---|---|---|---|
| Google Client ID + Secret | Supabase Auth → Providers → Google | Staging client credentials | Prod client credentials |
| Google Client ID + Secret | Vercel env vars (for manual GCal token exchange) | Staging client credentials | Prod client credentials |
| Supabase callback URL (`/auth/v1/callback`) | Google Cloud Console → Authorized redirect URIs | `https://<staging-ref>.supabase.co/auth/v1/callback` | `https://<prod-ref>.supabase.co/auth/v1/callback` |
| App domain | Google Cloud Console → Authorized JavaScript origins | Staging deployment domain | Production deployment domain |
| Site URL | Supabase Auth → URL Configuration | Staging app URL | Production app URL |
| App redirect URLs | Supabase Auth → Additional redirect URLs | Wildcard for preview URLs + localhost | Exact production URL |

---

## Nice to Have

These are not blockers for the initial deployment. Address after both parents are live.

### Custom domain instead of `.vercel.app`

Vercel allows attaching a custom domain (e.g., `vuoroasuminen.fi`) to the production deployment via DNS configuration. Provides a more professional URL. If added after initial launch, requires updating: Supabase Site URL, Supabase redirect URLs, Google Authorized JavaScript origins, and Vercel Production env vars that contain the domain.

### `vercel env pull` workflow for local development

Running `vercel env pull --environment=preview` downloads staging Supabase credentials into `.env.local`. Eliminates manual `.env.local` maintenance and ensures local development always matches the staging environment.

### Deployment protection bypass for automated testing

Vercel Preview deployments are protected by default (Vercel authentication required to view). For Playwright or other E2E tests that need to reach preview URLs without a browser login, configure `VERCEL_AUTOMATION_BYPASS_SECRET` in project settings and pass it as an `x-vercel-protection-bypass` header. Not needed unless CI runs E2E tests against preview deployments.

### Health check route

A simple `GET /api/health` route returning `200 { ok: true }` allows smoke-testing after each deployment. Confirms that env vars resolved and the app started. Can be tested with `curl` after deploying.

### Supabase database branching (future consideration, not for this milestone)

Supabase has an experimental branching feature that creates ephemeral database branches per PR, automatically provisioned and torn down. As of 2026 this is in limited availability on paid plans. The manual two-project approach used here is more reliable and simpler to reason about for a two-user app.

---

## Dependencies Between Steps

Hard ordering constraints:

```
Step 1: Create staging Supabase project
Step 2: Create production Supabase project
        (Steps 1 and 2 can be done in parallel)

Step 3: Create staging Google OAuth client
        Needs: staging Supabase project reference (to know what callback URL to register)

Step 4: Create production Google OAuth client
        Needs: production Supabase project reference

Step 5: Configure Google OAuth in staging Supabase project
        Needs: staging Google OAuth client credentials

Step 6: Configure Google OAuth in production Supabase project
        Needs: production Google OAuth client credentials

Step 7: Configure Vercel environment variables (all env vars, both scopes)
        Needs: both sets of Supabase credentials
        Needs: both sets of Google OAuth credentials

Step 8: Initial deployment to Vercel (push to main)
        Needs: all env vars configured
        Produces: stable Vercel deployment URL

Step 9: Set Site URL and Additional redirect URLs in staging Supabase project
        Needs: staging deployment URL (from step 8)

Step 10: Set Site URL and Additional redirect URLs in production Supabase project
        Needs: production deployment URL (from step 8)

Step 11: Verify Google OAuth Authorized JavaScript origins are correct
        Needs: final deployment URLs (from step 8)

Step 12: Smoke test sign-in and GCal publish in staging
         Needs: all of the above

Step 13: Upgrade production Supabase project to Pro plan

Step 14: Begin Google OAuth verification (production client)
         Needs: production deployment working (step 12 equivalent for prod)
         Note: 3-5 business day wait
```

Steps 1-2 can be done in parallel. Steps 3-6 can be done in parallel once their respective Supabase projects exist. Step 7 can be done once any Supabase credentials exist (partial), but must be complete before step 8.

---

## Sources

- Vercel: Environment Variables — https://vercel.com/docs/environment-variables
- Vercel: Environments (Preview vs Production) — https://vercel.com/docs/deployments/environments
- Vercel: System Environment Variables (VERCEL_ENV, VERCEL_URL) — https://vercel.com/docs/environment-variables/system-environment-variables
- Vercel: Set Up a Staging Environment — https://vercel.com/kb/guide/set-up-a-staging-environment-on-vercel
- Supabase: Managing Environments — https://supabase.com/docs/guides/deployment/managing-environments
- Supabase: Redirect URLs (wildcards, Site URL, additional URLs) — https://supabase.com/docs/guides/auth/redirect-urls
- Supabase: Login with Google (callback URL format) — https://supabase.com/docs/guides/auth/social-login/auth-google
- Google: OAuth 2.0 Policies (separate projects per environment) — https://developers.google.com/identity/protocols/oauth2/policies
- Google: Using OAuth 2.0 for Web Server Applications — https://developers.google.com/identity/protocols/oauth2/web-server
