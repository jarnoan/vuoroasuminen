# Phase 13: Invite + Access Gate - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 13 delivers: (1) invite link generation and acceptance flow so Parent B can join the app without manual config, and (2) middleware access gate enforcing both authentication and onboarding completeness on all protected routes.

**In scope:**
- Invite link generation Server Action (token in DB, 72h expiry, one outstanding at a time)
- Wizard setup-complete step updated to show copy-to-clipboard invite URL (Phase 12 StepComplete component)
- Dashboard invite section (show link, regenerate, hide once Parent B has joined)
- `/invite/<token>` route — validates token, stores in cookie, redirects to Google OAuth
- `/auth/callback` updated to consume invite cookie, update `family_config.parent2_email` to actual sign-in email, mark token used
- `proxy.ts` middleware extended with onboarding check (auth + family_config existence + email match)
- `/auth/error` page: Finnish message for unrecognised email (not parent1 or parent2)

**Out of scope:**
- Email sending — Parent A copies link manually
- Parent B calendar ID collection during invite acceptance (Parent A already entered both IDs in Phase 12)
- Welcome screen after invite acceptance
- Edit family config post-onboarding (future milestone)
- Multiple outstanding invite tokens

</domain>

<decisions>
## Implementation Decisions

### Invite UI Entry Point
- **D-01:** Wizard setup-complete step (Phase 12 `StepComplete` component) is updated in Phase 13 to generate and display the invite URL with a copy-to-clipboard button. This is the primary first-time entry point — user just finished setup and gets the link immediately.
- **D-02:** Dashboard also shows an invite section (card/block) with the current invite link and a "Generate new link" button. This is the regeneration entry point for expired or used links.
- **D-03:** Dashboard invite section is hidden once Parent B has joined. Detection: check if a `user_google_tokens` row exists for `family_config.parent2_email`. If it does, Parent B has signed in at least once → section disappears permanently.

### Invite Link Mechanics (from Phase 12 research — locked)
- **D-04:** Token format: `crypto.randomBytes(32).toString('base64url')` → 43-char URL-safe string. Stored in `invite_tokens.token` (UNIQUE). Already in schema.
- **D-05:** Invite URL: `https://<domain>/invite/<token>`. Expiry: 72 hours from creation.
- **D-06:** Only one outstanding (non-expired, non-used) invite token per creator. Server Action that generates a new token first hard-deletes any prior unused tokens for the same `created_by` email before inserting the new one.
- **D-07:** Token survives the OAuth roundtrip via a short-lived HttpOnly cookie (`invite_token=<value>; Max-Age=600; HttpOnly; Secure; SameSite=Lax`). Not a query param — Google OAuth does not guarantee extra params survive the redirect.
- **D-08:** `invite_tokens.used_at` is stamped on redemption (not deleted) — preserves audit trail.

### Invite Acceptance: Parent B Email Handling
- **D-09:** The invite link is the authorization — Parent B may sign in with any Google account, regardless of what email Parent A entered in the wizard. On invite acceptance (in `/auth/callback`), `family_config.parent2_email` is updated to the actual email used by Parent B. This handles the case where Parent B wants to use a different email than Parent A assumed.
- **D-10:** After token consumption and `parent2_email` update, Parent B is redirected straight to `/dashboard` — no welcome screen.

### Middleware Gate Scope
- **D-11:** `proxy.ts` extended with onboarding check. Protected routes = all routes except `/setup`, `/auth/*`, `/invite/*`, `/`, and static assets. Three-tier check:
  1. Not signed in → redirect to `/`
  2. Signed in, no `family_config` row → redirect to `/setup`
  3. Signed in, `family_config` exists, email doesn't match parent1 or parent2 → redirect to `/auth/error` (Finnish error message) + sign out session
  4. Signed in, email matches → pass through
- **D-12:** Unrecognised email (scenario 3 above) shows a dedicated Finnish error page at `/auth/error`. Session is invalidated. Message: "Tämä tili ei kuulu tähän perheeseen." (This account is not part of this family.)
- **D-13:** Middleware onboarding check must read `family_config` from DB. Use the admin Drizzle connection (service_role) — same pattern as all other server-side reads. Do NOT read family_config at module scope (Vercel warm instance leak risk — D-10 from Phase 8 context).

### Invite Regeneration
- **D-14:** Regeneration UI lives in the dashboard invite section only. Shows: current link (if active), expiry time, status (active / expired / used). "Generate new link" button calls the same Server Action as initial generation (which deletes prior unused tokens first).
- **D-15:** Wizard setup-complete step shows the invite link but has no regenerate button — regeneration is dashboard-only.

### Claude's Discretion
- Exact Finnish copy for setup-complete invite step and dashboard invite section
- Whether dashboard invite section is a separate Server Component or inline in the dashboard page
- Whether to read `user_google_tokens` for Parent B join detection in a Server Component or in middleware
- Precise shadcn/ui component for copy-to-clipboard (Input + Button, or a dedicated CopyButton component)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research (Phase 12 — covers Phase 13 invite design)
- `.planning/research/ONBOARDING-STACK.md` — Invite token design, validation flow, cookie mechanism, why cookie not query param, RLS policies for `invite_tokens`. Authoritative for technical implementation.
- `.planning/research/ONBOARDING-FEATURES.md` — Phase 13 invite UX: step 5 "Invite Parent B", calendar ID discovery context, interaction states.

### Requirements
- `.planning/REQUIREMENTS.md` §Onboarding — ONBR-05, ONBR-06, ONBR-07 definitions
- `.planning/ROADMAP.md` §Phase 13 — goal, success criteria

### Existing implementation (read before touching)
- `src/proxy.ts` — current middleware; extend with onboarding check (D-11)
- `src/app/auth/callback/route.ts` — add invite cookie consumption after line 71 (token upsert); update `family_config.parent2_email`
- `src/db/schema/domain.ts` — `inviteTokens` table definition (already exists, no schema changes needed)
- `src/app/setup/setup-wizard.tsx` (or equivalent StepComplete component) — update setup-complete step to generate + display invite URL
- `src/app/auth/error/page.tsx` — existing error page; add Finnish "unrecognised email" variant or extend existing page

### Prior phase decisions
- `.planning/phases/12-onboarding-wizard/12-CONTEXT.md` §D-01 — setup-complete screen has "hand-off note for Phase 13" (update this to the actual invite link)
- `.planning/phases/12-onboarding-wizard/12-CONTEXT.md` §D-10 — dashboard-level redirect to /setup is server component redirect(); Phase 13 moves this to middleware
- `.planning/phases/08-supabase-auth-stack/08-CONTEXT.md` §D-11 — GCal sync + all server-side writes use service_role Drizzle connection
- `.planning/phases/08-supabase-auth-stack/08-CONTEXT.md` §D-09 — middleware must NOT initialize Supabase client at module scope (Vercel warm instance leak)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/proxy.ts` — middleware; extend auth check with onboarding check (D-11); currently ~25 lines
- `src/app/auth/callback/route.ts` — inject invite token consumption after `user_google_tokens` upsert (line ~71)
- `src/app/auth/error/page.tsx` — existing Finnish error page; extend or add new variant for unrecognised email
- `src/components/ui/button.tsx`, `src/components/ui/alert.tsx` — reuse for dashboard invite section
- `src/actions/setup.ts` — existing Server Action pattern for setup wizard; invite generation follows same pattern

### Established Patterns
- Service_role Drizzle connection for all server-side DB writes (Phase 8 D-11)
- `supabase.auth.getUser()` in middleware (not `getSession()`) — Phase 8 D-09
- Finnish UI language — all user-facing copy in Finnish
- `next-safe-action` + `zod` for Server Actions — already installed
- `crypto.randomUUID()` used in `inviteTokens.id.$defaultFn` — same Node built-in for `crypto.randomBytes(32)`

### Integration Points
- `src/proxy.ts` — add three-tier onboarding check after existing auth check
- `src/app/auth/callback/route.ts` — read `invite_token` cookie, validate, update `family_config.parent2_email`, mark token used
- `src/app/dashboard/page.tsx` — add invite section (hide when Parent B `user_google_tokens` row exists for `parent2_email`)
- `src/app/setup/` — update StepComplete to generate + show invite link after wizard completion

</code_context>

<specifics>
## Specific Ideas

- **Email update on invite:** `/auth/callback` updates `family_config.parent2_email` to the actual sign-in email when consuming an invite token. Parent B's choice of Google account overrides what Parent A entered — the invite link is the authorization, not email matching.
- **Parent B join detection:** Check if `user_google_tokens` row exists for `family_config.parent2_email`. Row present = Parent B has authenticated at least once = hide dashboard invite section.
- **Unrecognised user:** Finnish error: "Tämä tili ei kuulu tähän perheeseen." Session signed out on that page.
- **Middleware reads family_config:** Must happen on every request for protected routes. Acceptable for a two-user app (single-row table, fast). Use service_role connection, no module-scope client.

</specifics>

<deferred>
## Deferred Ideas

- Parent B's own calendar ID picker during invite acceptance — future milestone (Parent A already set both calendar IDs in Phase 12)
- Welcome screen for Parent B after joining — not needed; straight to dashboard
- Edit family config post-onboarding (rename children, change calendar IDs) — future milestone
- Parent A notification when Parent B joins — future milestone
- Regenerate invite from setup-complete screen — dashboard is the regeneration entry point

</deferred>

---

*Phase: 13-invite-access-gate*
*Context gathered: 2026-05-17*
