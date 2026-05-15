# Phase 9: Row Level Security - Pattern Map

**Mapped:** 2026-05-13
**Files analyzed:** 5 (1 new, 4 modified)
**Analogs found:** 4 / 5 (1 file has no prior analog — SQL DDL)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/policies.sql` | config (DDL) | — | none in codebase | no analog |
| `src/lib/supabase/client.ts` | utility (client factory) | request-response | `src/lib/supabase/server.ts` | role-match |
| `src/app/auth/callback/route.ts` | route handler | request-response | `src/app/auth/callback/route.ts` itself (modify in place) | self |
| `src/components/schedule/realtime-provider.tsx` | component (provider) | event-driven | `src/components/owner-warning-banner.tsx` | role-match |
| `src/components/sign-in-button.tsx` | component (action trigger) | request-response | `src/components/owner-warning-banner.tsx` | exact |

---

## Pattern Assignments

### `supabase/policies.sql` (config, DDL — no codebase analog)

No existing SQL files exist in this codebase. Use the RESEARCH.md Code Examples section as the authoritative template. Key conventions confirmed from the DB schema:

- Table names (from `src/db/schema/tokens.ts` and `src/db/schema/domain.ts`): `user_google_tokens`, `children`, `schedules`, `schedule_entries`, `gcal_events`
- `user_google_tokens` PK column is `email` (text) — confirmed from `src/db/schema/tokens.ts` line 4
- `refresh_token` column (snake_case) — confirmed from `src/db/schema/tokens.ts` line 5 (Drizzle alias `refreshToken` → raw column `refresh_token`)

**SQL structure to follow** (from RESEARCH.md lines 322–435):

```sql
-- supabase/policies.sql
-- Row Level Security policies for vuoroasuminen
-- Run once via Supabase Dashboard → SQL editor, or psql.
-- service_role (admin Drizzle connection) bypasses all policies — intentional.

-- Domain tables: any authenticated user can read/write all rows
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

-- Repeat this block for: schedules, schedule_entries, gcal_events

-- user_google_tokens: per-user isolation
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

**Critical SQL rules:**
- INSERT policies require `WITH CHECK`, not `USING` — `USING` only filters existing rows (SELECT/UPDATE/DELETE)
- Always include `TO authenticated` on every policy — without it the policy applies to `anon` too
- Use `(auth.jwt() ->> 'email')` not `auth.email()` — the latter is undocumented and may not exist
- `ENABLE ROW LEVEL SECURITY` must come before `CREATE POLICY` statements for each table
- No DELETE policy on `user_google_tokens` — confirmed by D-08 and application design

**Optional publication check** (append to policies.sql if `schedule_entries` is not in the `supabase_realtime` publication):

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.schedule_entries;
```

---

### `src/lib/supabase/client.ts` (utility, request-response)

**Analog:** `src/components/owner-warning-banner.tsx` and `src/app/auth/error/page.tsx`

Both already-correct files show the target pattern: import `createBrowserClient` from `@supabase/ssr` directly and call it with explicit URL and anonKey arguments.

**Current implementation** (`src/lib/supabase/client.ts` lines 1–18 — full file):

```typescript
import { createClient } from "@supabase/supabase-js"

let client: ReturnType<typeof createClient> | null = null

export function createBrowserClient() {
  if (client) return client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  client = createClient(url, anonKey, {
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  })

  return client
}
```

**Target pattern** — replace entire file body with a single re-export line:

```typescript
// src/lib/supabase/client.ts — AFTER FIX
// Re-export from @supabase/ssr so callers get a cookie-aware client.
// Callers must pass (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY).
// @supabase/ssr handles its own internal caching — no singleton guard needed.
export { createBrowserClient } from "@supabase/ssr"
```

**Analog pattern confirmed** — `src/components/owner-warning-banner.tsx` lines 5, 15–17:

```typescript
import { createBrowserClient } from "@supabase/ssr"
// ...
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)
```

**Important:** After this change the import path `@/lib/supabase/client` still works — `client.ts` just re-exports. No import path changes in callers needed. But callers that call `createBrowserClient()` with zero arguments MUST be updated to pass URL and anonKey (see RealtimeProvider and sign-in-button sections below).

---

### `src/app/auth/callback/route.ts` (route handler, request-response)

**Analog:** Self — this file is modified in place. The existing structure is preserved; only the token upsert block changes.

**Full current file** (`src/app/auth/callback/route.ts` lines 1–80) has already been read. Key context:

- `supabase` variable (authenticated server client) is already in scope at line 38 and remains valid through the end of the function
- `userEmail` (line 49) and `providerRefreshToken` (line 48) are already extracted before the upsert block
- The try/catch block (lines 58–77) is what gets replaced

**Current upsert block** (lines 58–77) — what to replace:

```typescript
try {
  await db
    .insert(userGoogleTokens)
    .values({
      email: userEmail,
      refreshToken: providerRefreshToken,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userGoogleTokens.email,
      set: {
        refreshToken: providerRefreshToken,
        updatedAt: new Date(),
      },
    })
  console.log("[auth/callback] token row upserted for", userEmail)
} catch (err) {
  console.error("[auth/callback] db insert failed:", err)
  return NextResponse.redirect(new URL("/auth/error", request.url))
}
```

**Replacement pattern** (RESEARCH.md lines 440–459):

```typescript
const { error: upsertError } = await supabase
  .from('user_google_tokens')
  .upsert(
    {
      email: userEmail,
      refresh_token: providerRefreshToken,   // snake_case — raw DB column name, not Drizzle alias
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

**Import cleanup:** After replacing the upsert, `db` from `@/db` and `userGoogleTokens` from `@/db/schema/tokens` are no longer used in this file. Remove those two imports (lines 4–5 of the current file).

**Column name mapping** (from `src/db/schema/tokens.ts`):
- Drizzle `refreshToken` → DB column `refresh_token`
- Drizzle `updatedAt` → DB column `updated_at`
- `new Date().toISOString()` produces the ISO string PostgREST/Supabase client expects for timestamp columns

---

### `src/components/schedule/realtime-provider.tsx` (component/provider, event-driven)

**Analog:** `src/components/owner-warning-banner.tsx` — already uses the correct `createBrowserClient` with URL and anonKey arguments.

**Current zero-argument call** (`src/components/schedule/realtime-provider.tsx` line 38):

```typescript
const supabase = createBrowserClient()
```

**Target pattern** (matching `owner-warning-banner.tsx` lines 15–17):

```typescript
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)
```

The import on line 4 (`import { createBrowserClient } from "@/lib/supabase/client"`) stays the same — no import path change.

Everything else in the component (channel setup, payload validation, cleanup in useEffect return) is unchanged.

---

### `src/components/sign-in-button.tsx` (component, request-response)

**Analog:** `src/components/owner-warning-banner.tsx` — identical OAuth trigger pattern, already using the correct call signature.

**Current zero-argument call** (`src/components/sign-in-button.tsx` line 8):

```typescript
const supabase = createBrowserClient()
```

**Target pattern** (matching `owner-warning-banner.tsx` lines 15–17):

```typescript
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)
```

The import on line 3 (`import { createBrowserClient } from "@/lib/supabase/client"`) stays the same.

The `signInWithOAuth` call (lines 9–24) is structurally identical to `owner-warning-banner.tsx` — no changes needed there.

---

## Shared Patterns

### Cookie-based Supabase browser client

**Source:** `src/components/owner-warning-banner.tsx` lines 5, 15–17 and `src/app/auth/error/page.tsx` lines 3, 8–11

**Apply to:** `src/lib/supabase/client.ts` (re-export), `src/components/schedule/realtime-provider.tsx` (caller update), `src/components/sign-in-button.tsx` (caller update)

```typescript
import { createBrowserClient } from "@supabase/ssr"

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)
```

**Why this matters for RLS:** `createBrowserClient` from `@supabase/ssr` reads the session from cookies. Without this, the Realtime WebSocket connects as `anon` and receives no events after RLS SELECT policies are enabled.

### Supabase server client (authenticated, cookie-wired)

**Source:** `src/lib/supabase/server.ts` lines 1–28 and `src/app/auth/callback/route.ts` lines 3, 20–36

**Apply to:** `src/app/auth/callback/route.ts` (the `supabase` variable is already in scope — no new client needed)

```typescript
// Already established in callback/route.ts — the supabase client after
// exchangeCodeForSession carries the authenticated session.
// Use supabase.from('table').upsert() to trigger RLS policy evaluation.
const { data, error } = await supabase.auth.exchangeCodeForSession(code)
// supabase is now authenticated — use it for the token upsert
```

### Error redirect pattern

**Source:** `src/app/auth/callback/route.ts` lines 40–42, 53–56

**Apply to:** token upsert replacement in `src/app/auth/callback/route.ts`

```typescript
if (upsertError) {
  console.error("[auth/callback] token upsert failed:", upsertError)
  return NextResponse.redirect(new URL("/auth/error", request.url))
}
```

### Console log tagging

**Source:** `src/app/auth/callback/route.ts` lines 51, 73, 75

All log statements in this file are prefixed with `[auth/callback]` — maintain this pattern in the replacement upsert block.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `supabase/policies.sql` | config (DDL) | — | No SQL DDL files exist in this codebase; `supabase/` directory does not yet exist. Use RESEARCH.md Code Examples (lines 322–435) as the authoritative template. |

---

## Metadata

**Analog search scope:** `src/lib/supabase/`, `src/app/auth/`, `src/components/`, `src/db/schema/`
**Files scanned:** 7 source files read in full
**Pattern extraction date:** 2026-05-13
