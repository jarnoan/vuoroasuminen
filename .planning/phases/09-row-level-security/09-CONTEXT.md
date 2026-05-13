# Phase 9: Row Level Security - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Enable RLS on all domain tables (`children`, `schedules`, `schedule_entries`, `gcal_events`, `user_google_tokens`). Unauthenticated Supabase API and Realtime requests return no data. Domain tables use a simple authenticated-user policy (any signed-in user can read/write all rows — per-household isolation is future work). `user_google_tokens` uses a per-user policy (each user accesses only their own row).

</domain>

<decisions>
## Implementation Decisions

### RLS SQL Delivery
- **D-01:** RLS policies are written as a raw SQL script at `supabase/policies.sql` — tracked in git, run once manually via Supabase Dashboard SQL editor or `psql`. No Supabase CLI migration system introduced.
- **D-02:** The project uses `db:push` (not Drizzle migrations); `supabase/policies.sql` is the canonical record of all RLS DDL alongside the Drizzle schema files.

### Realtime Client Auth (RLS-04)
- **D-03:** Consolidate `src/lib/supabase/client.ts` to re-export `createBrowserClient` from `@supabase/ssr` instead of wrapping `createClient` from `@supabase/supabase-js`. Remove the module-level singleton guard — `@supabase/ssr` handles its own caching internally.
- **D-04:** `RealtimeProvider` and `sign-in-button.tsx` get the fix automatically once `client.ts` is updated — no per-component changes needed beyond the import.
- **D-05:** `owner-warning-banner.tsx` and `auth/error/page.tsx` already import `createBrowserClient` from `@supabase/ssr` directly — leave them as-is (already correct).

### user_google_tokens Policy (RLS-03)
- **D-06:** Switch the token upsert in `src/app/auth/callback/route.ts` from the admin Drizzle connection to `supabase.from('user_google_tokens').upsert()` using the authenticated Supabase server client (already present after `exchangeCodeForSession`). This makes the RLS policy actively enforce that only the signed-in user can write their own row.
- **D-07:** GCal sync reads `user_google_tokens` via admin Drizzle (service_role) — keep as-is. Sync runs server-side behind `requireAuthorizedParent()`; service_role bypasses RLS appropriately.
- **D-08:** Policy SQL for `user_google_tokens`: `USING (auth.email() = email)` for SELECT and UPDATE; INSERT also needs a `WITH CHECK (auth.email() = email)` to block cross-user writes.

### Domain Table Policies
- **D-09:** Domain tables (`children`, `schedules`, `schedule_entries`, `gcal_events`) use `USING (auth.role() = 'authenticated')` — any authenticated Supabase session can read/write. Per-household isolation is explicitly deferred to a future milestone.
- **D-10:** Admin Drizzle (service_role) is the connection for all server-side reads and mutations (Server Components, Server Actions, GCal sync). Service_role bypasses RLS — this is intentional and unchanged from Phase 8 D-11.

### Claude's Discretion
- Exact SQL syntax for each policy (SELECT / INSERT / UPDATE / DELETE per table)
- Whether to enable `FORCE ROW LEVEL SECURITY` on the table owner role (Supabase default behavior is sufficient — no need to force)
- Supabase Realtime publication check: verify `schedule_entries` is in the `supabase_realtime` publication (likely already true; if not, add it)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §RLS — RLS-01 through RLS-04 definitions
- `.planning/ROADMAP.md` §Phase 9 — goal, success criteria (4 must-be-true)

### Phase 8 decisions (carry forward)
- `.planning/phases/08-supabase-auth-stack/08-CONTEXT.md` — D-11 (admin Drizzle for GCal/token reads), D-09/D-10 (middleware session strategy)

### Files to modify
- `src/lib/supabase/client.ts` — consolidate to `@supabase/ssr` re-export (D-03)
- `src/app/auth/callback/route.ts` — switch token upsert to Supabase client (D-06)
- `src/components/schedule/realtime-provider.tsx` — verify import unchanged after client.ts fix
- `src/components/sign-in-button.tsx` — verify import unchanged after client.ts fix

### Files to create
- `supabase/policies.sql` — all RLS `ENABLE ROW LEVEL SECURITY` + `CREATE POLICY` SQL (D-01)

### Supabase docs
- Supabase RLS with Next.js / `@supabase/ssr` — authenticated Realtime requires cookie-based browser client
- Supabase Realtime Postgres Changes + RLS — table must be in `supabase_realtime` publication; client uses JWT automatically when session is set via `@supabase/ssr`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/supabase/server.ts`: `createSupabaseServerClient()` — already cookie-wired; use in callback for the token upsert (D-06)
- `@supabase/ssr` already installed — `createBrowserClient` export available at no extra cost
- `src/app/auth/callback/route.ts`: already has a Supabase server client post-`exchangeCodeForSession`; the `supabase` variable is in scope at the point of the Drizzle upsert

### Established Patterns
- `@supabase/ssr` `createBrowserClient` already used in `owner-warning-banner.tsx` and `auth/error/page.tsx` — precedent for cookie-based browser client in this codebase
- Server Actions use admin Drizzle (`db` from `@/db`) for all mutations — no change to this pattern

### Integration Points
- `src/lib/supabase/client.ts`: replace body with re-export from `@supabase/ssr` (single-line change)
- `src/app/auth/callback/route.ts`: replace `db.insert(userGoogleTokens)...onConflictDoUpdate(...)` block with `supabase.from('user_google_tokens').upsert(...)` — `supabase` is already in scope
- `supabase/` directory: create new directory + `policies.sql`

</code_context>

<specifics>
## Specific Ideas

- `supabase/policies.sql` should include a comment block explaining each policy group and noting that service_role bypasses all policies (for future-reader clarity)
- The `auth/callback` Supabase client upsert: use `supabase.from('user_google_tokens').upsert({ email: userEmail, refresh_token: providerRefreshToken, updated_at: new Date().toISOString() }, { onConflict: 'email' })` — column names must match the actual DB column names (`refresh_token`, `updated_at`), not Drizzle camelCase aliases

</specifics>

<deferred>
## Deferred Ideas

- **Per-household RLS isolation** — `USING (household_id = auth.uid()::uuid)` style policies — explicitly out of scope for v1.2 (REQUIREMENTS.md Out of Scope)
- **Gender-neutral terminology** (`father`/`mother` → `parent1`/`parent2`) — carried from Phase 8 deferred ideas

</deferred>

---

*Phase: 09-row-level-security*
*Context gathered: 2026-05-13*
