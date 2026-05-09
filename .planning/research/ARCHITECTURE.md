# Architecture Patterns: Supabase Auth + RLS Migration (v1.2)

**Domain:** Real-time collaborative scheduling app with Google Calendar integration
**Researched (original):** 2026-04-04
**Updated:** 2026-05-09 — v1.2 milestone: Supabase Auth migration, user_google_tokens, RLS
**Confidence:** HIGH (Supabase Auth token patterns and Drizzle RLS mechanics verified from official docs and reference implementations)

---

## v1.2 Architecture Questions

The sections below answer five specific questions for the v1.2 milestone. The original architecture
research (system overview, patterns, anti-patterns) is preserved at the bottom of this file.

---

## Q1: user_google_tokens table structure

### Recommendation: FK to auth.users.id, unique index on email for fast lookup

The existing `buildGCalClient(parentEmail)` looks up `refresh_token` by email. After migration,
`app.ts` gains `ownerEmail` per calendar entry and the call site stays
`buildGCalClient(config.parents[n].email)`. The token lookup remains email-based, but the foreign key
must anchor to `auth.users.id` — the stable, non-mutable identity in Supabase Auth. Email is
denormalized for lookup without a join.

```sql
-- Run as a raw SQL migration (not Drizzle-generated)
-- Drizzle cannot express a FK to auth.users because it lives in the auth schema
CREATE TABLE public.user_google_tokens (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email         text        NOT NULL,
  refresh_token text        NOT NULL,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX user_google_tokens_user_id_idx ON public.user_google_tokens(user_id);
CREATE UNIQUE INDEX user_google_tokens_email_idx   ON public.user_google_tokens(email);
```

Drizzle schema counterpart — for type-safe server queries. The FK to `auth.users` is enforced in raw
SQL above, not in Drizzle schema (cross-schema references are not supported by Drizzle):

```typescript
// src/db/schema/tokens.ts
import { pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const userGoogleTokens = pgTable("user_google_tokens", {
  id:           text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId:       text("user_id").notNull().unique(),   // auth.users.id — FK in raw SQL only
  email:        text("email").notNull().unique(),
  refreshToken: text("refresh_token").notNull(),
  updatedAt:    timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
})
```

### Updated buildGCalClient

```typescript
// src/lib/gcal/client.ts  (after Auth.js removal)
import { db } from "@/db"                           // admin db — bypasses RLS intentionally
import { userGoogleTokens } from "@/db/schema/tokens"
import { eq } from "drizzle-orm"
import { google } from "googleapis"
import type { calendar_v3 } from "googleapis"

export async function buildGCalClient(ownerEmail: string): Promise<calendar_v3.Calendar> {
  const [row] = await db
    .select({ refreshToken: userGoogleTokens.refreshToken })
    .from(userGoogleTokens)
    .where(eq(userGoogleTokens.email, ownerEmail))
    .limit(1)

  if (!row?.refreshToken) {
    throw new Error("Calendar authentication required. Please sign in with Google again.")
  }

  // Exchange refresh_token for a fresh access_token (same pattern as before)
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type:    "refresh_token",
      refresh_token: row.refreshToken,
    }),
  })

  if (!tokenResponse.ok) {
    throw new Error("Calendar authentication failed. Please sign in with Google again.")
  }

  const { access_token, expires_in } = await tokenResponse.json() as {
    access_token: string
    expires_in:   number
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  )
  oauth2Client.setCredentials({
    access_token,
    expiry_date: Date.now() + (expires_in - 60) * 1000,
  })

  return google.calendar({ version: "v3", auth: oauth2Client })
}
```

### Offline owner scenario

`buildGCalClient` is called with `ownerEmail` from `app.ts` — always the calendar owner's email, not
the currently-signed-in user's email. This is the calendar owner model: only the owner's credentials
are needed for GCal sync. If the owner has never signed in on this deployment (token row absent),
sync throws and shows a warning toast. Either parent can trigger publish; sync uses the owner's token.

---

## Q2: Populating user_google_tokens on sign-in

### Key constraint: provider_refresh_token is only available in the OAuth callback route

Supabase Auth deliberately does not store Google's `provider_refresh_token` in `auth.users` or any
system table. It is available exactly once: in the session object returned by
`supabase.auth.exchangeCodeForSession(code)` inside the `/auth/callback` route handler. After the
callback completes and redirects, the token is no longer retrievable from the session — subsequent
`getSession()` calls do not include it.

**Auth Hooks cannot solve this.** The custom access token hook fires before JWT issuance and only
receives JWT claims — it never sees the Google provider tokens. There is no Supabase Auth Hook that
exposes `provider_refresh_token`.

### Recommended approach: capture and upsert in /auth/callback/route.ts

```typescript
// app/auth/callback/route.ts
import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"    // cookie-based SSR client
import { db } from "@/db"                                  // admin Drizzle — bypasses RLS
import { userGoogleTokens } from "@/db/schema/tokens"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code  = searchParams.get("code")
  const next  = searchParams.get("next") ?? "/"

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
  }

  const supabase = await createClient()

  // exchangeCodeForSession returns provider_token and provider_refresh_token
  // ONLY on this initial exchange — they are NOT available in subsequent getSession() calls
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.session) {
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
  }

  const { user, provider_refresh_token } = data.session

  // Store the Google refresh token for server-side GCal sync
  // Only attempt if we received a token (Google requires prompt:consent for re-issue)
  if (provider_refresh_token && user.email) {
    await db
      .insert(userGoogleTokens)
      .values({
        userId:       user.id,
        email:        user.email,
        refreshToken: provider_refresh_token,
        updatedAt:    new Date(),
      })
      .onConflictDoUpdate({
        target: userGoogleTokens.userId,
        set: {
          refreshToken: provider_refresh_token,
          email:        user.email,        // update if email ever changes
          updatedAt:    new Date(),
        },
      })
  }

  const forwardedHost = request.headers.get("x-forwarded-host")
  const isLocal = process.env.NODE_ENV === "development"
  const base = isLocal ? origin : forwardedHost ? `https://${forwardedHost}` : origin
  return NextResponse.redirect(`${base}${next}`)
}
```

### Require prompt:consent on every sign-in

Google only returns `provider_refresh_token` when `access_type: 'offline'` and `prompt: 'consent'`
are set. Without these, subsequent logins return no refresh token and the upsert silently skips.
Mirror the prior Auth.js behavior:

```typescript
// In the sign-in Server Action or page
const supabase = createClient()
await supabase.auth.signInWithOAuth({
  provider: "google",
  options: {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    queryParams: {
      access_type: "offline",
      prompt:      "consent",    // Forces Google to re-issue refresh_token on every login
    },
    scopes: "https://www.googleapis.com/auth/calendar",
  },
})
```

### What if the non-owner parent signs in first?

No problem. Both parents' tokens are stored on their respective sign-ins. GCal sync only uses the
owner's token. The non-owner's token is captured but never read by `buildGCalClient` unless the
ownership configuration in `app.ts` points to that parent's email as `ownerEmail`.

---

## Q3: RLS policies for domain tables

### Access model: any authenticated user reads and writes all rows

This is a two-parent app with full collaborative access. No per-user row ownership. The only
requirement: unauthenticated (anonymous) requests must be blocked.

### Policy: FOR ALL TO authenticated USING (true) WITH CHECK (true)

Apply identically to all four domain tables. This is the simplest correct policy.

```sql
-- Enable RLS on all domain tables
ALTER TABLE public.children         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gcal_events      ENABLE ROW LEVEL SECURITY;

-- children: any authenticated user can read and write
CREATE POLICY "authenticated_all" ON public.children
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- schedules
CREATE POLICY "authenticated_all" ON public.schedules
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- schedule_entries
CREATE POLICY "authenticated_all" ON public.schedule_entries
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- gcal_events (server-side GCal sync writes via admin connection which bypasses RLS)
-- Policy still needed so RLS-mode clients can read the table if required
CREATE POLICY "authenticated_all" ON public.gcal_events
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
```

### user_google_tokens: owner-scoped policy

Token rows must not be visible to the other parent via any RLS-respecting client. GCal sync reads
them via admin connection, which bypasses RLS — this policy does not affect sync.

```sql
ALTER TABLE public.user_google_tokens ENABLE ROW LEVEL SECURITY;

-- Each user can only see and manage their own token row
CREATE POLICY "owner_only" ON public.user_google_tokens
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id::uuid)
  WITH CHECK ((select auth.uid()) = user_id::uuid);
```

### Drizzle pgPolicy declarations (schema-as-source-of-truth)

Declare policies inline in the Drizzle schema so `drizzle-kit generate` includes them in migrations.
The SQL above can also be applied directly as a custom migration — either approach works.

```typescript
// src/db/schema/domain.ts  (add pgPolicy to each table)
import {
  pgTable, pgEnum, pgPolicy, text, date, timestamp, uniqueIndex
} from "drizzle-orm/pg-core"
import { authenticatedRole } from "drizzle-orm/supabase"
import { sql } from "drizzle-orm"

export const children = pgTable("children", {
  id:   text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
}, () => [
  pgPolicy("authenticated_all", {
    for:       "all",
    to:        authenticatedRole,
    using:     sql`true`,
    withCheck: sql`true`,
  }),
])

// schedules, scheduleEntries, gcalEvents: same pgPolicy block
```

---

## Q4: Drizzle ORM + RLS interaction

### The core problem: Drizzle uses the postgres superuser role by default

Drizzle connects via `DATABASE_URL`, which uses the Supabase `postgres` role (or an equivalent
superuser). PostgreSQL superusers bypass RLS entirely — enabling RLS on tables has zero effect on
Drizzle queries unless you explicitly switch roles.

Supabase's PostgREST (the auto-generated REST API) automatically switches to the `authenticated` role
when it receives a valid JWT in the `Authorization` header. Drizzle does not do this automatically.
Neither does any other direct Postgres ORM.

**Conclusion:** Without additional setup, enabling RLS protects against PostgREST and Supabase JS
client access (correct) but does NOT protect against Drizzle queries (they bypass RLS). The two-client
pattern below is required.

### Two-connection pattern: admin db vs RLS db

```typescript
// src/db/index.ts
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

// Admin connection — uses postgres superuser, bypasses RLS
// Use for: GCal sync, token reads, system operations not acting on behalf of a specific user
const adminPg = postgres(process.env.DATABASE_URL!, { prepare: false })
export const db = drizzle(adminPg, { schema })

// RLS connection — same URL, but queries must be wrapped in withRLS() (see src/db/rls.ts)
// Use for: Server Actions and Route Handlers acting on behalf of an authenticated user
const rlsPg = postgres(process.env.DATABASE_URL!, { prepare: false })
export const rlsDb = drizzle(rlsPg, { schema })
```

`prepare: false` is required when using Supabase's Transaction Mode connection pooler (Supavisor).
Without it, you get "prepared statement already exists" errors in production.

### The withRLS transaction wrapper

All user-context queries must run inside a transaction that (a) injects JWT claims into PostgreSQL's
`request.jwt.claims` config variable, (b) sets `request.jwt.claim.sub` for `auth.uid()`, and (c)
switches the session role to `authenticated`:

```typescript
// src/db/rls.ts
import { rlsDb } from "./index"
import { sql } from "drizzle-orm"
import type { Session } from "@supabase/supabase-js"

type RlsTx = Parameters<Parameters<typeof rlsDb.transaction>[0]>[0]

/**
 * Run a Drizzle query block respecting Supabase RLS.
 *
 * Injects the user's JWT into set_config so auth.uid() and auth.jwt()
 * evaluate correctly for RLS policy checks. The role switches from
 * postgres (superuser, bypasses RLS) to authenticated (respects RLS).
 *
 * MUST run all queries inside the returned tx, not the module-level db.
 *
 * Usage:
 *   const rows = await withRLS(session, (tx) =>
 *     tx.select().from(children)
 *   )
 */
export async function withRLS<T>(
  session: Session,
  fn: (tx: RlsTx) => Promise<T>
): Promise<T> {
  const claims = JSON.stringify({
    sub:   session.user.id,
    email: session.user.email,
    role:  "authenticated",
    aud:   "authenticated",
    iat:   Math.floor(Date.now() / 1000),
    exp:   session.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
  })

  return rlsDb.transaction(async (tx) => {
    // set_config with last arg TRUE = transaction-local (resets when transaction ends)
    await tx.execute(
      sql.raw(`SELECT set_config('request.jwt.claims', '${claims}', TRUE)`)
    )
    await tx.execute(
      sql.raw(`SELECT set_config('request.jwt.claim.sub', '${session.user.id}', TRUE)`)
    )
    await tx.execute(sql.raw(`SET LOCAL ROLE authenticated`))

    try {
      return await fn(tx)
    } finally {
      // Explicit cleanup — belt and suspenders (TRUE above already handles it)
      await tx.execute(sql`SELECT set_config('request.jwt.claims', NULL, TRUE)`)
      await tx.execute(sql`SELECT set_config('request.jwt.claim.sub', NULL, TRUE)`)
      await tx.execute(sql`RESET ROLE`)
    }
  })
}
```

**Critical:** `set_config(..., TRUE)` means transaction-local. The configuration is automatically
reset when the transaction ends. Do not use `set_config(..., FALSE)` — that persists for the entire
connection session, which in a connection pool leaks auth context between requests.

### When to use admin db vs withRLS

| Use Case | Connection | Rationale |
|----------|------------|-----------|
| `buildGCalClient` (token read) | `db` (admin) | Server-initiated, reads owner's token; not per-user |
| GCal sync writes to `gcal_events` | `db` (admin) | Server-initiated; no user context needed |
| Write to `user_google_tokens` (callback) | `db` (admin) | System operation during auth flow |
| Schedule cell mutations (Server Actions) | `withRLS(session, tx => ...)` | User-initiated; RLS confirms authenticated |
| Read schedule data (Server Components) | `withRLS(session, tx => ...)` | Enforces auth boundary |
| Statistics computation | `withRLS(session, tx => ...)` | User-initiated read |

### For v1.2: pragmatic note

The v1.2 RLS policies use `USING (true)` — they check only that the caller has the `authenticated`
role, not which specific user they are. This means the admin db also satisfies the policy if you
switch its role. However, establishing the `withRLS` pattern now means that when future milestones
add row-ownership policies (e.g., per-cell change history in AUDT-01), no structural change is
needed — only the policy expression changes.

---

## Q5: Migration strategy — dropping Auth.js tables

### FK dependency order

Auth.js tables have these constraints:

```
accounts.userId       → users.id  (ON DELETE CASCADE)
sessions.userId       → users.id  (ON DELETE CASCADE)
verificationTokens    — no FK
```

Safe drop order (child tables before parent):

```
1. accounts
2. sessions
3. verificationTokens
4. users
```

### Step-by-step migration

**Step 1:** Ensure `user_google_tokens` is created and the calendar owner has signed in at least once
(token row exists). Verify `buildGCalClient` reads from `user_google_tokens`, not `accounts`.

**Step 2:** Remove the four Auth.js tables from Drizzle schema:
- Delete (or clear) `src/db/schema/auth.ts`
- Remove its exports from `src/db/schema/index.ts`

**Step 3:** Run `drizzle-kit generate` to produce the migration:

```bash
npx drizzle-kit generate
```

Review the generated SQL. Drizzle may not order drops correctly for FK constraints. Write a custom
migration if needed:

```sql
-- drizzle/migrations/XXXX_drop_authjs_tables.sql
-- Drop child tables first to satisfy FK constraints
DROP TABLE IF EXISTS "accounts";
DROP TABLE IF EXISTS "sessions";
DROP TABLE IF EXISTS "verificationTokens";
DROP TABLE IF EXISTS "users";
```

If you prefer a single statement that handles the FK chain automatically:

```sql
-- CASCADE drops FK constraints declared on other tables referencing these tables
-- It does NOT drop the referencing tables themselves (only the FK constraints)
DROP TABLE IF EXISTS "accounts"           CASCADE;
DROP TABLE IF EXISTS "sessions"           CASCADE;
DROP TABLE IF EXISTS "verificationTokens" CASCADE;
DROP TABLE IF EXISTS "users"              CASCADE;
```

**Step 4:** Fix all import sites. Grep for Auth.js schema references:

```bash
grep -r "from.*schema/auth" src/
grep -r "from.*@auth/" src/
grep -r "DrizzleAdapter" src/
grep -r "NEXTAUTH_" .env*
```

Key files to update:
- `src/lib/gcal/client.ts` — remove `accounts`, `users` imports; use `userGoogleTokens`
- `src/db/schema/index.ts` — remove auth.ts exports
- Any middleware referencing `auth()` from next-auth

**Step 5:** Remove Auth.js packages:

```bash
npm uninstall next-auth @auth/drizzle-adapter
```

### Pre-migration checklist

- [ ] `user_google_tokens` table created in database
- [ ] Calendar owner has signed in at least once (token row exists for ownerEmail)
- [ ] `buildGCalClient` updated to read from `user_google_tokens`
- [ ] Supabase Auth environment variables set (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set for admin db operations if needed
- [ ] No remaining imports of `accounts`, `sessions`, `users`, `verificationTokens` from Drizzle schema
- [ ] `NEXTAUTH_SECRET`, `NEXTAUTH_URL` env vars removed
- [ ] Auth.js npm packages uninstalled

---

## System Overview (from v1.0 research, updated for v1.2)

```
Supabase Auth (auth.users)
  Google OAuth callback
         │
         │ FK (user_id), written by /auth/callback route
         ▼
user_google_tokens                    ← admin db write (callback route)
  email (unique index)                ← admin db read (buildGCalClient)
  refresh_token

Domain tables                         ← RLS: authenticated users only
  children
  schedules
  schedule_entries    ←── Supabase Realtime broadcasts to browsers
  gcal_events         ←── admin db write (GCal sync)

Server Actions / Route Handlers
  User-context mutations → withRLS(session, tx => ...)
  GCal sync              → db (admin)
  Token read/write       → db (admin)
```

---

## Original Architecture Research (v1.0/v1.1, still valid)

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| React UI | Render schedule table, handle cell edits, show draft/published state, stats panel | Next.js App Router + React Server Components for initial load, Client Components for realtime |
| Supabase Realtime client | Subscribe to `postgres_changes` on `schedule_entries`; merge incoming changes into local state | Supabase JS client `channel().on('postgres_changes')` |
| Auth layer | Google OAuth flow for both parents; cookie-based session management | Supabase Auth with `@supabase/ssr` |
| Server Actions | Validate and write cell edits; trigger publish action; serve stats | Next.js Server Actions |
| GCal Sync | After publish, compute diff between DB state and Google Calendar; apply minimal upsert/delete operations | Server-side function called synchronously after publish |
| Postgres (`schedule_entries`) | Single source of truth for schedule state (draft and published cells, notes) | Supabase Postgres table with RLS |
| Postgres (`gcal_events`) | Mirror of Google Calendar event IDs; enables idempotent upsert without re-querying GCal | Separate table keyed on `(schedule_entry_id, calendar_id)` |
| Postgres (`user_google_tokens`) | Google refresh tokens for server-side GCal sync | Custom table, written by /auth/callback, read by buildGCalClient |

### Pattern: Supabase Realtime for Two-User Sync

Both browser clients subscribe to `postgres_changes` on `schedule_entries`. Every successful DB write
is automatically broadcast to all subscribers. No custom WebSocket server needed.

```typescript
useEffect(() => {
  const channel = supabase
    .channel("schedule-entries")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "schedule_entries" },
      (payload) => {
        setEntries((prev) => upsertEntry(prev, payload.new as ScheduleEntry))
      }
    )
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}, [])
```

### Pattern: Write-Only Google Calendar Sync (App → GCal)

Google Calendar is treated as an output target, not a source of truth. After a publish action, the
sync worker computes which calendar events need to be created, updated, or deleted. Bidirectional sync
creates infinite webhook loops and is explicitly avoided.

### Anti-Patterns (still valid)

**Bidirectional GCal sync** — GCal webhook fires on your own sync writes, creating an infinite loop.
Use write-only sync.

**Polling instead of Realtime** — wasteful and adds latency. Use `postgres_changes` subscription.

**OAuth tokens client-side** — GCal API calls must be server-side. Tokens live in `user_google_tokens`
and are never exposed to the browser.

**One calendar event per day (all children combined)** — cannot represent split custody days.
Use one event per child per day.

---

## Sources

- Supabase — Login with Google, provider_refresh_token: https://supabase.com/docs/guides/auth/social-login/auth-google
- Supabase GitHub — How to store provider_refresh_token during OAuth flow: https://github.com/orgs/supabase/discussions/22653
- Supabase GitHub — How to update and store provider access/refresh token: https://github.com/orgs/supabase/discussions/22578
- Supabase — Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase — Auth Hooks: https://supabase.com/docs/guides/auth/auth-hooks
- Drizzle ORM — Row-Level Security documentation: https://orm.drizzle.team/docs/rls
- GitHub — drizzle-supabase-rls reference implementation: https://github.com/rphlmr/drizzle-supabase-rls
- Mortadha Ghanmi — Restore Supabase RLS with Drizzle using tRPC: https://mortadha.dev/blog/restore-supabase-rls-with-drizzle-using-trpc-middlewares/
- Drizzle ORM — Custom migrations: https://orm.drizzle.team/docs/kit-custom-migrations
- Google Calendar API sync guide: https://developers.google.com/workspace/calendar/api/guides/sync
- Auth.js Refresh Token Rotation (v1.0 reference): https://authjs.dev/guides/refresh-token-rotation
- Supabase Realtime with Next.js: https://supabase.com/docs/guides/realtime/realtime-with-nextjs
