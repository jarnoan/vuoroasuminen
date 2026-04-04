# Phase 1: Foundation - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a working Next.js app where both parents can sign in with their Google accounts (with Calendar API scope), sign out, and have their session persist across browser refresh. The complete database schema supporting all future phases is created in Supabase via Drizzle migrations. No schedule functionality is built yet — Phase 1 ends with a header nav shell and a placeholder body.

</domain>

<decisions>
## Implementation Decisions

### Configuration (SETP-01)
- **D-01:** Use a hybrid config model — `config/app.ts` holds non-secret structured data (parent names, children list, schedule start date, firstParent); `.env.local` holds private data (parent emails, calendar IDs, Google OAuth client ID/secret, Supabase URL/key)
- **D-02:** `config/app.ts` shape: `{ parents: [{ id, name }], children: string[], startDate: string, firstParent: string }` — typed TypeScript, version-controlled
- **D-03:** Parent emails and calendar IDs go in `.env.local` (not in config file) — keep them private even in a private repo

### Post-Auth Landing Page
- **D-04:** After sign-in, render a nav shell with a header-only layout: app logo/name, signed-in user's Google profile picture, and a sign-out button
- **D-05:** Body shows a "Schedule coming soon" placeholder — no nav tabs or section links in Phase 1; full layout freedom deferred to Phase 2

### Google OAuth Token Handling
- **D-06:** Implement full refresh token rotation in Phase 1 — Auth.js `jwt` callback exchanges expired access tokens using the stored refresh token; do not defer to Phase 4
- **D-07:** Store `refresh_token` and `access_token` (with expiry) in the Auth.js `accounts` table via the Drizzle adapter — required for server-side Calendar API calls in Phase 4

### Database Schema
- **D-08:** Full domain schema created in Phase 1: Auth.js tables (`users`, `accounts`, `sessions`, `verification_tokens`) + all domain tables (`children`, `schedules`, `schedule_entries`, `gcal_events`)
- **D-09:** Use `DATE` column type (not `TIMESTAMP`) for custody day columns — timezone-safe, matches GCAL-05
- **D-10:** Use a `status` enum (draft/published) — not a boolean flag — on `schedule_entries`
- **D-11:** Include `gcal_events` mirror table from day one so Phase 4 has a clean idempotency surface

### Deployment
- **D-12:** Phase 1 targets local development only (`next dev`); Vercel deployment, CI/CD, and env var management in the Vercel dashboard are deferred to Phase 2 or later

### Claude's Discretion
- Auth.js session strategy details (database sessions are required; implementation specifics are at Claude's discretion)
- Drizzle schema file organization (single schema file vs split by domain)
- Supabase connection: direct vs pooled (Supavisor) — choose appropriate for local dev
- Tailwind/shadcn setup details during project bootstrap

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above and in the following files:

### Project Requirements
- `.planning/REQUIREMENTS.md` — Full v1 requirements; Phase 1 covers AUTH-01 through AUTH-04, SETP-01
- `.planning/ROADMAP.md` — Phase 1 success criteria (section: Phase 1: Foundation)
- `CLAUDE.md` — Stack decisions, version constraints, and what NOT to use

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project; no existing components or utilities

### Established Patterns
- None yet — Phase 1 establishes the patterns for all subsequent phases

### Integration Points
- Auth.js Drizzle adapter writes to `accounts` table → Phase 4 reads `refresh_token` from there
- `config/app.ts` `parents` array → referenced by schedule pre-fill (Phase 2), calendar sync (Phase 4)
- `children` DB table → seeded from `config/app.ts` on first run; referenced by schedule grid (Phase 2)

</code_context>

<specifics>
## Specific Ideas

- Parent IDs in config: `'father'` and `'mother'` (string literals, not numeric)
- Children in config: array of strings (names only) — `['Emma', 'Olivia']` shape shown in discussion
- `startDate` in config is the first Monday of the alternating-week pattern

</specifics>

<deferred>
## Deferred Ideas

- Vercel deployment and CI/CD setup — deferred to Phase 2 or later
- Nav tabs for Schedule, Statistics sections — deferred to Phase 2 when sections are built
- Full-skeleton layout (sidebar, grid structure) — deferred to Phase 2

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-04-04*
