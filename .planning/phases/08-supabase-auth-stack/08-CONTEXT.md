# Phase 8: Supabase Auth Stack - Context

**Gathered:** 2026-05-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the auth path with Supabase Google OAuth (PKCE). Capture Google refresh tokens in a new `user_google_tokens` table. Update GCal sync to use an `ownerEmail` model (one owner for all calendars). Add a token-absent warning banner to the dashboard. Auth.js v5 remains installed — this phase runs in parallel without removing it. Middleware switches to Supabase `getUser()`.

</domain>

<decisions>
## Implementation Decisions

### Calendar Ownership Model (GCAL-01, GCAL-02)
- **D-01:** Single shared owner — both calendars use the same `ownerEmail` in `app.ts`. GCal sync reads `ownerEmail` per calendar entry and uses that token, regardless of which parent triggered publish.
- **D-02:** `ownerEmail` is set to whichever user sets up the app and has write access to both calendars. This is configurable — whoever does the initial setup puts their email as `ownerEmail` on both calendar entries.
- **D-03:** Only the calendar owner needs to sign in for GCal sync to work. The other parent can sign in too (they get a `user_google_tokens` row) but their token is not used for sync.

### Token Failure Page (SAUTH-06)
- **D-04:** When the OAuth callback does not yield a `refresh_token`, redirect to an explicit error page (not a silent dashboard redirect).
- **D-05:** Error page is in Finnish, consistent with the rest of the UI.
- **D-06:** Error page offers a "Kirjaudu sisään uudelleen" button that triggers a new OAuth flow with `prompt:consent` + `access_type:offline`. Message: something like "Tarvitsemme pääsyn kalenteriin. Kirjaudu sisään uudelleen ja myönnä tarvittavat oikeudet."

### Warning Banner (SAUTH-07)
- **D-07:** Per-session dismiss — the banner reappears on every page load until the calendar owner's `user_google_tokens` row exists. No storage needed. This keeps the user aware that sync is broken until fixed.
- **D-08:** Banner includes a sign-in link as CTA. Finnish copy: "Kalenterin omistaja ei ole kirjautunut — kalenterisynkronointi ei toimi." + [Kirjaudu sisään] link that triggers sign-in flow.

### Middleware & Session Strategy (from STATE.md — locked)
- **D-09:** Middleware uses `supabase.auth.getUser()` (not `getSession()`) for route protection. `getUser()` validates the JWT server-side; `getSession()` trusts a spoofable cookie.
- **D-10:** Supabase client must NOT be initialized at module scope in middleware. Vercel warm instances share module scope and can leak sessions between users.
- **D-11:** GCal sync and `user_google_tokens` reads always use the admin Drizzle connection (`service_role` key), not the anon Supabase client.

### Claude's Discretion
- Supabase server/middleware client helper locations (e.g., `src/lib/supabase/server.ts`, `src/lib/supabase/middleware.ts`)
- `user_google_tokens` table column names and migration details
- `buildGCalClient` refactor — reads from `user_google_tokens` by `ownerEmail` instead of `accounts` by parent email; env var name changes (`AUTH_GOOGLE_ID` → `GOOGLE_CLIENT_ID` or keep existing)
- `requireAuthorizedParent()` refactor — uses Supabase `getUser()` instead of Auth.js `auth()`
- Route path for OAuth callback (e.g., `/auth/callback`)
- Route path for token error page (e.g., `/auth/error`)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §SAUTH — SAUTH-01 through SAUTH-07 definitions
- `.planning/REQUIREMENTS.md` §GCAL — GCAL-01, GCAL-02 definitions

### Roadmap
- `.planning/ROADMAP.md` §Phase 8 — goal, success criteria (5-point GATE), UI hint

### Existing implementation (read before touching)
- `src/auth.ts` — Auth.js v5 config with DrizzleAdapter, JWT strategy, token persistence in `accounts` table; stays installed but middleware no longer references it for route protection
- `src/auth.config.ts` — Google provider config with `prompt:consent` + `access_type:offline`; MUST be preserved in Supabase OAuth config
- `src/middleware.ts` — currently Auth.js middleware; must be replaced with Supabase `getUser()` guard
- `src/lib/gcal/client.ts` — `buildGCalClient(parentEmail)` currently reads from `accounts` table via Drizzle; must be refactored to read from `user_google_tokens` by `ownerEmail`
- `src/lib/gcal/sync.ts` — calls `buildGCalClient(parentEmail)` per-parent; must be updated to use `ownerEmail` from config instead
- `src/config/app.ts` — `AppConfig` interface needs `ownerEmail` field per calendar entry; `ParentId = "father" | "mother"` type (do not refactor in Phase 8)
- `src/lib/supabase/client.ts` — existing browser Supabase client (for Realtime); reference for package usage; `@supabase/ssr` already installed
- `src/actions/schedule.ts` — `requireAuthorizedParent()` uses Auth.js `auth()`; must be refactored to Supabase `getUser()`
- `src/db/schema/auth.ts` — Auth.js schema tables; stays in place for Phase 8; dropped in Phase 10
- `src/db/index.ts` — Drizzle admin connection; `user_google_tokens` reads/writes use this

### Supabase Auth docs (authoritative)
- `@supabase/ssr` package for Next.js App Router server/middleware clients
- Supabase PKCE OAuth flow docs — `exchangeCodeForSession()` in callback route; `provider_refresh_token` available only at this moment

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/supabase/client.ts`: browser Supabase client already exists; server and middleware clients need to be added alongside it
- `@supabase/ssr` and `@supabase/supabase-js` both installed; no new packages needed for auth
- `src/components/ui/button.tsx`: use for error page CTA button
- shadcn `Alert` or a simple banner div: use for warning banner in dashboard

### Established Patterns
- Server Component fetches data → Client Component handles UI → Server Action mutates
- `requireAuthorizedParent()` auth guard in every Server Action (refactor to Supabase `getUser()`)
- Finnish UI copy throughout; error page and warning banner must be Finnish
- Inline expand panels below schedule table (ExtendPanel, ClearPanel) — banner sits in header/top of dashboard, not inline

### Integration Points
- `src/middleware.ts`: replace Auth.js `auth()` with Supabase `getUser()` guard; create per-request Supabase server client (not module-scope)
- `src/config/app.ts`: add `ownerEmail: string` to each calendar entry in the `parents` array; document that it should be the email of whoever has write access to both calendars
- `src/lib/gcal/client.ts`: refactor `buildGCalClient` — accepts ownerEmail, looks up token in `user_google_tokens` via admin Drizzle connection
- `src/lib/gcal/sync.ts`: pass `ownerEmail` from config to `buildGCalClient` for each calendar (not the triggering parent's email)
- `src/app/dashboard/page.tsx`: check if calendar owner's `user_google_tokens` row exists; pass `showOwnerWarning: boolean` to `DashboardShell`
- New: `src/app/auth/callback/route.ts` — PKCE code exchange, `exchangeCodeForSession()`, capture `provider_refresh_token`, write to `user_google_tokens`, redirect to dashboard or error page
- New: `src/app/auth/error/page.tsx` — Finnish error page with "Kirjaudu sisään uudelleen" button
- `src/db/schema/` — add `user_google_tokens` table (email PK, refresh_token, updated_at)
- New sign-in button: replace `signIn("google")` from `next-auth/react` with Supabase OAuth sign-in trigger

</code_context>

<specifics>
## Specific Ideas

- Error page copy (Finnish): "Tarvitsemme pääsyn kalenteriin. Kirjaudu sisään uudelleen ja myönnä tarvittavat oikeudet." + button [Kirjaudu sisään uudelleen] that re-triggers OAuth
- Warning banner copy (Finnish): "Kalenterin omistaja ei ole kirjautunut — kalenterisynkronointi ei toimi." + link [Kirjaudu sisään]
- Warning banner is per-session dismissible (X button, no storage, reappears on reload until owner's token row exists)
- `ownerEmail` config: same email on both calendar entries when one person manages both calendars; can be set differently if each parent owns their own calendar (but per D-01, single owner is the expected default)
- GATE (from ROADMAP.md success criteria): all 5 criteria must be verified before Phase 9 begins — sign-in, session persistence, `user_google_tokens` row with non-null `refresh_token`, GCal sync via `ownerEmail`, and warning banner for absent token

</specifics>

<deferred>
## Deferred Ideas

- **Gender-neutral terminology** — The user noted that `father`/`mother` in `ParentId`, `app.ts`, and UI labels should be replaced with neutral terms (e.g., `parent1`/`parent2` or configurable names). Affects `ParentId` type and many files — separate refactor phase/task.

</deferred>

---

*Phase: 08-supabase-auth-stack*
*Context gathered: 2026-05-09*
