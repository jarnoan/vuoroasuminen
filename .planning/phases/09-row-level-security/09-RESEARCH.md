# Phase 9: Row Level Security - Research

**Researched:** 2026-05-13
**Domain:** Supabase Row Level Security + Realtime Postgres Changes + @supabase/ssr client consolidation
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** RLS policies are written as a raw SQL script at `supabase/policies.sql` — tracked in git, run once manually via Supabase Dashboard SQL editor or `psql`. No Supabase CLI migration system introduced.

**D-02:** The project uses `db:push` (not Drizzle migrations); `supabase/policies.sql` is the canonical record of all RLS DDL alongside the Drizzle schema files.

**D-03:** Consolidate `src/lib/supabase/client.ts` to re-export `createBrowserClient` from `@supabase/ssr` instead of wrapping `createClient` from `@supabase/supabase-js`. Remove the module-level singleton guard — `@supabase/ssr` handles its own caching internally.

**D-04:** `RealtimeProvider` and `sign-in-button.tsx` get the fix automatically once `client.ts` is updated — no per-component changes needed beyond the import.

**D-05:** `owner-warning-banner.tsx` and `auth/error/page.tsx` already import `createBrowserClient` from `@supabase/ssr` directly — leave them as-is (already correct).

**D-06:** Switch the token upsert in `src/app/auth/callback/route.ts` from the admin Drizzle connection to `supabase.from('user_google_tokens').upsert()` using the authenticated Supabase server client (already present after `exchangeCodeForSession`). This makes the RLS policy actively enforce that only the signed-in user can write their own row.

**D-07:** GCal sync reads `user_google_tokens` via admin Drizzle (service_role) — keep as-is. Sync runs server-side behind `requireAuthorizedParent()`; service_role bypasses RLS appropriately.

**D-08:** Policy SQL for `user_google_tokens`: `USING (auth.email() = email)` for SELECT and UPDATE; INSERT also needs a `WITH CHECK (auth.email() = email)` to block cross-user writes.

**D-09:** Domain tables (`children`, `schedules`, `schedule_entries`, `gcal_events`) use `USING (auth.role() = 'authenticated')` — any authenticated Supabase session can read/write. Per-household isolation is explicitly deferred to a future milestone.

**D-10:** Admin Drizzle (service_role) is the connection for all server-side reads and mutations (Server Components, Server Actions, GCal sync). Service_role bypasses RLS — this is intentional and unchanged from Phase 8 D-11.

### Claude's Discretion

- Exact SQL syntax for each policy (SELECT / INSERT / UPDATE / DELETE per table)
- Whether to enable `FORCE ROW LEVEL SECURITY` on the table owner role (Supabase default behavior is sufficient — no need to force)
- Supabase Realtime publication check: verify `schedule_entries` is in the `supabase_realtime` publication (likely already true; if not, add it)

### Deferred Ideas (OUT OF SCOPE)

- **Per-household RLS isolation** — `USING (household_id = auth.uid()::uuid)` style policies — explicitly out of scope for v1.2
- **Gender-neutral terminology** (`father`/`mother` → `parent1`/`parent2`) — carried from Phase 8 deferred ideas
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RLS-01 | RLS enabled on all domain tables (`children`, `schedules`, `schedule_entries`, `gcal_events`) — unauthenticated requests return no data | SQL `ENABLE ROW LEVEL SECURITY` + `USING (auth.role() = 'authenticated')` policies block anon requests |
| RLS-02 | Any authenticated user can read and write all rows on domain tables (v1.2 baseline) | All four CRUD operations get `USING (auth.role() = 'authenticated')` policies |
| RLS-03 | Each user can read and write only their own row in `user_google_tokens` | `USING ((auth.jwt() ->> 'email') = email)` policy plus client-side upsert switch (D-06) |
| RLS-04 | Supabase Realtime subscription uses authenticated Supabase JWT so RLS is enforced on live updates | `createBrowserClient` from `@supabase/ssr` automatically sends session JWT to Realtime; client.ts consolidation (D-03) unblocks this |
</phase_requirements>

---

## Summary

Phase 9 enables Row Level Security on all five tables in the application. The work has three distinct parts: (1) writing `supabase/policies.sql` with `ENABLE ROW LEVEL SECURITY` and `CREATE POLICY` DDL for each table, (2) switching `src/lib/supabase/client.ts` from a hand-rolled singleton over `createClient` to a thin re-export of `createBrowserClient` from `@supabase/ssr`, and (3) switching the `user_google_tokens` upsert in the OAuth callback from admin Drizzle to the authenticated Supabase server client.

The critical insight for RLS-04 is why the current `client.ts` breaks Realtime after RLS is enabled. The existing code creates a plain `@supabase/supabase-js` client at module scope — that client has no cookie access, so it connects to Realtime as `anon` (not `authenticated`). Once RLS policies exist, Realtime silently drops all events because the anon role has no SELECT policy. Switching to `createBrowserClient` from `@supabase/ssr` gives the client cookie-based session awareness, so Realtime automatically receives the user's JWT and the `authenticated` role, satisfying RLS policies.

The `auth.email()` function referenced in D-08 is not listed in official Supabase RLS docs — the correct approach is `(auth.jwt() ->> 'email')` to extract email from the JWT claim. This is a MEDIUM-confidence finding: the function may exist as an undocumented alias, but using the JWT extraction form is guaranteed correct and documented. The planner should use `(auth.jwt() ->> 'email')` as the safe default; if the user prefers `auth.email()`, they can confirm it works in the SQL editor before committing.

**Primary recommendation:** Three files change (client.ts, callback/route.ts, new supabase/policies.sql). All other files are untouched. The SQL script is the only manual step — run it once in the Supabase Dashboard SQL editor after writing it.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| RLS policy enforcement | Database (Supabase/Postgres) | — | Policies execute inside Postgres per-row on every query; client code cannot override |
| Policy DDL delivery | Manual (SQL editor / psql) | — | D-01 locked: no migration system; `supabase/policies.sql` run manually |
| Authenticated Realtime JWT | Browser client (`@supabase/ssr`) | — | `createBrowserClient` reads cookies; passes session JWT to Realtime WebSocket automatically |
| Token upsert RLS enforcement | API / Route Handler | Database | Switching from admin Drizzle → authed Supabase client lets RLS policy enforce the write |
| GCal sync token read | API / Backend (service_role) | — | Service_role bypasses RLS; appropriate for trusted server-side operations |

---

## Standard Stack

### Core (already installed)

| Library | Version in package.json | Purpose | Notes |
|---------|--------------------------|---------|-------|
| `@supabase/ssr` | ^0.10.0 | `createBrowserClient` for cookie-based browser client | Already installed; `createBrowserClient` is the correct export for client.ts |
| `@supabase/supabase-js` | ^2.101.1 | Realtime WebSocket management; underlying engine | Used by `@supabase/ssr` internally; no direct use in client.ts after refactor |

No new packages needed for this phase.

---

## Architecture Patterns

### System Architecture Diagram

```
OAuth callback (GET /auth/callback)
  └─> supabase.auth.exchangeCodeForSession(code)
        └─> session established (JWT set in cookie)
        └─> supabase.from('user_google_tokens').upsert(...)
              └─> RLS policy: (auth.jwt() ->> 'email') = email  [enforced by Postgres]
                    └─> only writes own row

Browser client (RealtimeProvider)
  └─> createBrowserClient() from @supabase/ssr  [reads cookie]
        └─> session JWT present  →  role = 'authenticated'
        └─> Realtime WebSocket handshake with JWT
              └─> RLS SELECT policy: auth.role() = 'authenticated'  [evaluated per event]
                    └─> events delivered to both parents

Server Actions / GCal sync
  └─> db (admin Drizzle, service_role)
        └─> RLS bypassed entirely  [service_role privilege]
```

### Recommended Project Structure

```
supabase/
└── policies.sql        # NEW: all RLS DDL — ENABLE + CREATE POLICY statements
src/
└── lib/supabase/
    └── client.ts       # CHANGE: re-export createBrowserClient from @supabase/ssr
src/app/auth/callback/
└── route.ts            # CHANGE: token upsert via supabase.from(...) not db.insert(...)
```

### Pattern 1: Enable RLS on a Table

**What:** One `ALTER TABLE` statement per table enables the feature. Until policies are added, all non-service_role access is denied.
**When to use:** Run this before adding policies; order matters (enable first, then policies).

```sql
-- Source: https://supabase.com/docs/guides/database/postgres/row-level-security
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;
```

### Pattern 2: Domain Table Policy (any authenticated user, all CRUD)

**What:** Four policies (SELECT, INSERT, UPDATE, DELETE) each checking `auth.role() = 'authenticated'`. Unauthenticated (anon) requests are denied.
**When to use:** Tables shared across all users in v1.2 (children, schedules, schedule_entries, gcal_events).

```sql
-- Source: https://supabase.com/docs/guides/database/postgres/row-level-security
CREATE POLICY "authenticated users can select"
  ON public.children
  FOR SELECT
  TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated users can insert"
  ON public.children
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated users can update"
  ON public.children
  FOR UPDATE
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated users can delete"
  ON public.children
  FOR DELETE
  TO authenticated
  USING (auth.role() = 'authenticated');
```

Repeat this block for `schedules`, `schedule_entries`, and `gcal_events`.

### Pattern 3: Per-User Table Policy (user_google_tokens)

**What:** Policies that restrict each row to the user whose email matches the JWT email claim.
**When to use:** `user_google_tokens` — each parent must access only their own token row.

```sql
-- Source: https://supabase.com/docs/guides/auth/jwt-fields (email is a standard JWT claim)
-- NOTE: auth.email() is referenced in D-08 but is NOT in official Supabase docs.
--       The safe, documented form is (auth.jwt() ->> 'email').
--       See Assumptions Log entry A1.

CREATE POLICY "user can select own token"
  ON public.user_google_tokens
  FOR SELECT
  TO authenticated
  USING ((auth.jwt() ->> 'email') = email);

CREATE POLICY "user can insert own token"
  ON public.user_google_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') = email);

CREATE POLICY "user can update own token"
  ON public.user_google_tokens
  FOR UPDATE
  TO authenticated
  USING ((auth.jwt() ->> 'email') = email)
  WITH CHECK ((auth.jwt() ->> 'email') = email);
```

No DELETE policy for `user_google_tokens` — rows are never deleted by the application.

### Pattern 4: client.ts Consolidation

**What:** Replace the hand-rolled singleton that calls `createClient` from `@supabase/supabase-js` with a direct re-export from `@supabase/ssr`. The key difference: `@supabase/ssr`'s `createBrowserClient` reads the session from cookies, so Realtime connections carry the authenticated JWT.

**Current (broken for RLS)**:
```typescript
// src/lib/supabase/client.ts — CURRENT
import { createClient } from "@supabase/supabase-js"

let client: ReturnType<typeof createClient> | null = null

export function createBrowserClient() {
  if (client) return client
  // ...
  client = createClient(url, anonKey, { realtime: { params: { eventsPerSecond: 10 } } })
  return client
}
```

**Fixed (correct for RLS)**:
```typescript
// src/lib/supabase/client.ts — AFTER FIX
// Source: @supabase/ssr docs, createBrowserClient from @supabase/ssr
export { createBrowserClient } from "@supabase/ssr"
```

After this change, callers pass URL and anonKey explicitly (matching how `owner-warning-banner.tsx` and `auth/error/page.tsx` already call it):

```typescript
// In RealtimeProvider and sign-in-button.tsx — callers must be updated
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)
```

**Important:** D-04 says "no per-component changes needed beyond the import" — but the current callers (`RealtimeProvider`, `sign-in-button.tsx`) call `createBrowserClient()` with no arguments. After the re-export, `createBrowserClient` requires the URL and anonKey arguments (that is the `@supabase/ssr` signature). Both callers MUST be updated to pass those two arguments. This contradicts D-04's framing. See Open Questions #1.

### Pattern 5: Supabase Realtime publication check

**What:** Postgres Changes requires the table to be in the `supabase_realtime` publication.
**How to verify:** In Supabase Dashboard → Database → Replication → supabase_realtime publication. If `schedule_entries` is not listed, add it:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.schedule_entries;
```

### Anti-Patterns to Avoid

- **Using `auth.uid()` for email comparison:** `user_google_tokens` stores email as the PK, not a UUID. `auth.uid()` returns the Supabase user UUID. These are different values. Do not use `auth.uid() = email`.
- **Missing WITH CHECK on INSERT:** `USING` clause filters existing rows (SELECT/UPDATE/DELETE). INSERT policies require `WITH CHECK`. An INSERT policy with only `USING` silently allows all inserts.
- **Module-level singleton using `createClient`:** The existing `client.ts` pattern uses `@supabase/supabase-js` directly. This client has no cookie storage — Realtime connects as `anon`. After RLS is on, no events are delivered.
- **Mixing Drizzle admin connection for user-scoped writes:** Using `db.insert(userGoogleTokens)` (service_role) makes the per-user RLS policy meaningless for the callback path — it bypasses RLS entirely.
- **Forgetting the `TO authenticated` role target:** Policies without `TO authenticated` apply to all roles including `anon`. The `TO authenticated` clause ensures the policy only affects authenticated sessions; anon sessions fall back to deny-all.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session JWT in Realtime | Manual `setAuth()` calls or passing token in headers | `createBrowserClient` from `@supabase/ssr` | SSR client reads cookie automatically; `setAuth()` is for third-party auth only |
| Email extraction from JWT | Custom JWT decode logic in RLS | `(auth.jwt() ->> 'email')` | Built-in Postgres JSON operator on the JWT already set by Supabase Auth |
| Service-role bypass | Custom middleware or header tricks | Admin Drizzle pool (`service_role` key) | Already established in Phase 8 D-11; service_role bypasses RLS by design |

---

## Common Pitfalls

### Pitfall 1: Realtime stops delivering events after RLS is enabled

**What goes wrong:** After adding `ENABLE ROW LEVEL SECURITY` with no SELECT policy, Realtime silently drops all events to the browser client. The WebSocket connection stays open but no payloads arrive.
**Why it happens:** Realtime evaluates the subscribed client's RLS SELECT policy before sending each event. If there is no SELECT policy (or the client's role has no matching policy), access is denied and the event is dropped.
**How to avoid:** Enable RLS and add SELECT policies atomically in the same `policies.sql` script. Run the full script at once, not statement-by-statement.
**Warning signs:** Realtime channel shows status `SUBSCRIBED` in browser devtools but no events arrive after a DB write.

### Pitfall 2: Realtime still connects as `anon` after client.ts fix

**What goes wrong:** Even after updating `client.ts`, the browser client subscribes to Realtime as the `anon` role.
**Why it happens:** `createBrowserClient` from `@supabase/ssr` requires the URL and anonKey arguments. If callers still call the old zero-argument signature from the prior singleton, they may get an error or fall back to anonymous.
**How to avoid:** Update `RealtimeProvider` and `sign-in-button.tsx` to pass URL and anonKey when calling `createBrowserClient`.
**Warning signs:** Browser devtools Network → WS → look for `access_token` message in the WebSocket frames. If the token is the anon API key rather than a JWT, the session is not being passed.

### Pitfall 3: auth.email() vs (auth.jwt() ->> 'email')

**What goes wrong:** D-08 specifies `USING (auth.email() = email)` but `auth.email()` is not in official Supabase RLS documentation.
**Why it happens:** It may exist as an undocumented convenience function, or D-08 may be based on community examples rather than official docs.
**How to avoid:** Use the documented `(auth.jwt() ->> 'email')` form. Test in the Supabase SQL editor: `SELECT (auth.jwt() ->> 'email');` before writing policies. If `auth.email()` resolves successfully there, either form works.
**Warning signs:** Policy creation fails with `function auth.email() does not exist`.

### Pitfall 4: Callback upsert column names (snake_case vs camelCase)

**What goes wrong:** The Drizzle schema uses `refreshToken` (camelCase alias) but the Supabase client writes to the raw column name `refresh_token` (snake_case). Switching from Drizzle's typed insert to `supabase.from(...).upsert(...)` requires using raw column names.
**Why it happens:** Drizzle's TypeScript layer translates camelCase to snake_case automatically. The Supabase PostgREST client uses snake_case column names from the actual DB schema.
**How to avoid:** CONTEXT.md already flags this in `<specifics>`: use `{ email, refresh_token, updated_at }` not `{ email, refreshToken, updatedAt }`.
**Warning signs:** The upsert succeeds (no error returned) but the row has a null `refresh_token` — a column name mismatch silently inserts nulls for unrecognized keys.

### Pitfall 5: Missing supabase/ directory

**What goes wrong:** `supabase/policies.sql` is in a directory that does not yet exist.
**Why it happens:** The project has never used the Supabase CLI; no `supabase/` folder was created.
**How to avoid:** Create the `supabase/` directory as part of Wave 0. Include a `README` comment at the top of `policies.sql` explaining the manual-run process.
**Warning signs:** N/A — just needs to be created.

---

## Code Examples

### Full policies.sql template

```sql
-- supabase/policies.sql
-- Row Level Security policies for vuoroasuminen
-- Run once via Supabase Dashboard → SQL editor, or psql.
-- service_role (admin Drizzle connection) bypasses all policies — intentional.

-- ============================================================
-- Domain tables: any authenticated user can read/write all rows
-- Per-household isolation is future work (see REQUIREMENTS.md Out of Scope)
-- ============================================================

-- children
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can select children"
  ON public.children FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated can insert children"
  ON public.children FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated can update children"
  ON public.children FOR UPDATE TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated can delete children"
  ON public.children FOR DELETE TO authenticated
  USING (auth.role() = 'authenticated');

-- schedules
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can select schedules"
  ON public.schedules FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated can insert schedules"
  ON public.schedules FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated can update schedules"
  ON public.schedules FOR UPDATE TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated can delete schedules"
  ON public.schedules FOR DELETE TO authenticated
  USING (auth.role() = 'authenticated');

-- schedule_entries
ALTER TABLE public.schedule_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can select schedule_entries"
  ON public.schedule_entries FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated can insert schedule_entries"
  ON public.schedule_entries FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated can update schedule_entries"
  ON public.schedule_entries FOR UPDATE TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated can delete schedule_entries"
  ON public.schedule_entries FOR DELETE TO authenticated
  USING (auth.role() = 'authenticated');

-- gcal_events
ALTER TABLE public.gcal_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can select gcal_events"
  ON public.gcal_events FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated can insert gcal_events"
  ON public.gcal_events FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated can update gcal_events"
  ON public.gcal_events FOR UPDATE TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated can delete gcal_events"
  ON public.gcal_events FOR DELETE TO authenticated
  USING (auth.role() = 'authenticated');

-- ============================================================
-- user_google_tokens: per-user isolation
-- Each parent can only access their own row (matched by email JWT claim)
-- GCal sync uses service_role (admin Drizzle) — bypasses RLS intentionally
-- ============================================================

ALTER TABLE public.user_google_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user can select own token"
  ON public.user_google_tokens FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'email') = email);

CREATE POLICY "user can insert own token"
  ON public.user_google_tokens FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') = email);

CREATE POLICY "user can update own token"
  ON public.user_google_tokens FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'email') = email)
  WITH CHECK ((auth.jwt() ->> 'email') = email);

-- No DELETE policy: token rows are never deleted by the application.
```

### Updated callback upsert (D-06)

```typescript
// src/app/auth/callback/route.ts — token upsert section AFTER fix
// Uses supabase (authenticated server client) instead of db (admin Drizzle)
// RLS policy will enforce: only the signed-in user can write their own row

const { error: upsertError } = await supabase
  .from('user_google_tokens')
  .upsert(
    {
      email: userEmail,
      refresh_token: providerRefreshToken,   // snake_case — raw DB column name
      updated_at: new Date().toISOString(),  // snake_case — raw DB column name
    },
    { onConflict: 'email' }
  )

if (upsertError) {
  console.error("[auth/callback] token upsert failed:", upsertError)
  return NextResponse.redirect(new URL("/auth/error", request.url))
}
console.log("[auth/callback] token row upserted for", userEmail)
```

### Updated client.ts (D-03)

```typescript
// src/lib/supabase/client.ts — AFTER FIX
// Re-exports createBrowserClient from @supabase/ssr.
// Callers must pass (url, anonKey) — this matches how owner-warning-banner.tsx
// and auth/error/page.tsx already call it.
export { createBrowserClient } from "@supabase/ssr"
```

### Updated callers (RealtimeProvider + sign-in-button)

```typescript
// In RealtimeProvider and sign-in-button.tsx
import { createBrowserClient } from "@/lib/supabase/client"

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)
```

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `auth.email()` is not an official Supabase RLS helper function — using `(auth.jwt() ->> 'email')` instead | Patterns 3, Code Examples | If `auth.email()` does exist as an undocumented function, both forms work; no functional regression. If we used `auth.email()` and it does NOT exist, policy creation fails with a runtime error. Safe default: use the documented form. |
| A2 | D-04 claims callers need "no per-component changes beyond the import" — but switching from a zero-argument singleton to `@supabase/ssr`'s `createBrowserClient` requires callers to pass URL and anonKey | Pitfall 2, Pattern 4, Open Questions | If callers are not updated, they will receive a TypeScript error or runtime exception. The callers MUST be updated — this is a code change, not just an import change. |
| A3 | `schedule_entries` is already in the `supabase_realtime` publication (Supabase Dashboard adds all tables by default in many configurations) | Discretion items | If not in the publication, Realtime events are never emitted from the database layer. Must be verified and added if absent. |

---

## Open Questions

1. **D-04 vs required caller updates**
   - What we know: D-04 says "no per-component changes needed beyond the import." The current callers (`RealtimeProvider`, `sign-in-button.tsx`) call `createBrowserClient()` with zero arguments.
   - What's unclear: `@supabase/ssr`'s `createBrowserClient` signature is `createBrowserClient(supabaseUrl, supabaseKey, options?)` — it requires two arguments. After the re-export, callers calling it with zero arguments will fail.
   - Recommendation: Treat D-04 as "no logic changes needed" — callers do need to add the two URL/key arguments. Both `RealtimeProvider` and `sign-in-button.tsx` must be updated. The planner should include this in the task for those files.

2. **`auth.email()` availability**
   - What we know: D-08 specifies `auth.email()`. Official Supabase docs only document `auth.uid()` and `auth.jwt()`.
   - What's unclear: Whether `auth.email()` is a valid undocumented convenience function.
   - Recommendation: Use `(auth.jwt() ->> 'email')` in `policies.sql`. Add a SQL editor smoke test step: run `SELECT (auth.jwt() ->> 'email');` after enabling RLS to confirm the extraction works before writing policies.

3. **`supabase_realtime` publication membership for `schedule_entries`**
   - What we know: Supabase Realtime requires a table to be in the `supabase_realtime` publication to emit CDC events.
   - What's unclear: Whether `schedule_entries` was already added to this publication during Phase 8 setup or the initial Supabase project creation.
   - Recommendation: Include a verification step in the plan: check the Supabase Dashboard → Database → Replication panel. If not present, add `ALTER PUBLICATION supabase_realtime ADD TABLE public.schedule_entries;` to `policies.sql`.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 9 is a SQL DDL + TypeScript code change only. The Supabase database is already accessible (Phase 8 gate was passed). No new external tools, runtimes, or CLI utilities are required.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Covered in Phase 8 |
| V3 Session Management | no | Covered in Phase 8 |
| V4 Access Control | yes | Supabase RLS policies (this phase) |
| V5 Input Validation | no | Server Actions use zod; not changed in this phase |
| V6 Cryptography | no | Not changed in this phase |

### Known Threat Patterns for Supabase RLS

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthenticated DB read via PostgREST | Information Disclosure | `ENABLE ROW LEVEL SECURITY` + `USING (auth.role() = 'authenticated')` |
| Cross-user token read (one parent reads other's refresh token) | Information Disclosure | `USING ((auth.jwt() ->> 'email') = email)` on `user_google_tokens` |
| Cross-user token write (one parent overwrites other's token) | Tampering | `WITH CHECK ((auth.jwt() ->> 'email') = email)` on INSERT/UPDATE |
| Realtime subscription delivers events to wrong client | Information Disclosure | SELECT RLS policy required for Realtime to deliver events; `createBrowserClient` ensures authenticated role |
| Service_role key exposed to client | Elevation of Privilege | Never expose `SUPABASE_SERVICE_ROLE_KEY` in public env vars; admin Drizzle is server-only |

---

## Sources

### Primary (HIGH confidence)
- [Supabase RLS official docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — ENABLE RLS syntax, policy DDL, auth.uid(), auth.jwt()
- [Supabase Realtime Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes) — supabase_realtime publication, RLS interaction with CDC events
- [Supabase Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization) — JWT requirements for authenticated Realtime subscriptions
- [Supabase JWT Claims Reference](https://supabase.com/docs/guides/auth/jwt-fields) — confirmed `email` is a standard required JWT claim in Supabase Auth tokens
- [Supabase auth-helpers createBrowserClient source](https://github.com/supabase/auth-helpers/blob/main/packages/ssr/src/createBrowserClient.ts) — cookie-based storage implementation

### Secondary (MEDIUM confidence)
- [Fix Supabase Realtime Issue When RLS Is Enabled (Medium)](https://medium.com/@kidane10g/supabase-realtime-stops-working-when-rls-is-enabled-heres-the-fix-154f0b43c69a) — confirmed: using `createBrowserClient` from `@supabase/ssr` consistently is the documented fix; SELECT policy required for Realtime
- [Row Level Security in Supabase: Complete Guide for Next.js with @supabase/ssr (2026)](https://blog.starmorph.com/blog/row-level-security-supabase-tables-nextjs) — confirmed `createBrowserClient` vs `createClient` distinction for cookie-based JWT

### Tertiary (LOW confidence, flagged)
- WebSearch results consistently not finding `auth.email()` in any Supabase official docs — used to flag A1 in Assumptions Log

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — `@supabase/ssr` already installed; no new packages; official docs consulted
- Architecture: HIGH — three bounded file changes with clear before/after states; decisions locked in CONTEXT.md
- SQL policy syntax: HIGH — confirmed via official Supabase RLS docs; `(auth.jwt() ->> 'email')` confirmed safe via JWT Claims Reference
- `auth.email()` function: LOW — not found in official docs; safe fallback (`auth.jwt() ->> 'email'`) documented
- D-04 caller update requirement: MEDIUM — inferred from `@supabase/ssr` API signature; flagged in Open Questions

**Research date:** 2026-05-13
**Valid until:** 2026-06-13 (Supabase RLS is stable; @supabase/ssr API unlikely to change in 30 days)
