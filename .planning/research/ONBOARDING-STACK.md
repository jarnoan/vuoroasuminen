# Onboarding Stack

**Project:** vuoroasuminen v1.3
**Researched:** 2026-05-15
**Confidence:** HIGH — based on direct codebase analysis, no speculative claims

---

## New DB Tables/Columns

### Table: `family_config`

Single-row table. Exactly one row ever exists (enforced by `CHECK (id = 1)`).
Stores everything currently in `src/config/app.ts` that belongs to the family unit, not infrastructure.

```
family_config
─────────────────────────────────────────────────────
id                   integer PRIMARY KEY DEFAULT 1
                     CHECK (id = 1)          ← enforces single-row
parent1_id           text NOT NULL           ← 'father' or 'mother' (matches ParentId enum)
parent1_name         text NOT NULL
parent1_email        text NOT NULL           ← Google account email
parent1_calendar_id  text NOT NULL           ← Google Calendar ID
parent2_id           text NOT NULL
parent2_name         text NOT NULL
parent2_email        text NOT NULL
parent2_calendar_id  text NOT NULL
children             text[] NOT NULL         ← ordered array of child names
start_date           date NOT NULL           ← ISO date, first Monday of alternating pattern
first_parent         text NOT NULL DEFAULT 'father'
                                            ← which parent gets week 1
created_at           timestamp NOT NULL DEFAULT now()
updated_at           timestamp NOT NULL DEFAULT now()
```

**Why single-row with `CHECK (id = 1)` rather than a key-value store:** The existing
`AppConfig` interface in `src/config/app.ts` is already strongly typed with a known
fixed shape. Keeping that shape as typed columns preserves the TypeScript end-to-end
safety that Drizzle provides. A key-value `(key, value text)` table would require
manual casting everywhere the config is read, losing the main benefit of Drizzle.

**Why `text[]` for children rather than a separate join table:** The existing
`children` table already stores the canonical child records with UUIDs. The
`family_config.children` column stores only the ordered display names for seeding
the default schedule pattern and column ordering — it mirrors the existing
`config.children` usage in `generate-default.ts` and `queries.ts`. The `children`
table remains the FK target for `schedule_entries.child_id`. No schema change needed
to the `children` table itself.

**Drizzle schema addition** (to `src/db/schema/domain.ts`):

```typescript
import { integer, text, date } from "drizzle-orm/pg-core"

export const familyConfig = pgTable("family_config", {
  id: integer("id").primaryKey().default(1),
  parent1Id: text("parent1_id").notNull(),
  parent1Name: text("parent1_name").notNull(),
  parent1Email: text("parent1_email").notNull(),
  parent1CalendarId: text("parent1_calendar_id").notNull(),
  parent2Id: text("parent2_id").notNull(),
  parent2Name: text("parent2_name").notNull(),
  parent2Email: text("parent2_email").notNull(),
  parent2CalendarId: text("parent2_calendar_id").notNull(),
  children: text("children").array().notNull(),
  startDate: date("start_date", { mode: "string" }).notNull(),
  firstParent: text("first_parent").notNull().default("father"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
})
```

A `CHECK (id = 1)` constraint must be added via a raw SQL migration (Drizzle Kit does
not generate check constraints from schema — add manually after `db:push`):

```sql
ALTER TABLE public.family_config
  ADD CONSTRAINT family_config_single_row CHECK (id = 1);
```

### Table: `invite_tokens`

Stores pending invite links. One row per outstanding invite.

```
invite_tokens
─────────────────────────────────────────────────────
id         text PRIMARY KEY (UUID)
token      text NOT NULL UNIQUE       ← URL-safe random string (32 bytes → 43 chars base64url)
created_by text NOT NULL              ← email of the parent who generated it
expires_at timestamp NOT NULL
used_at    timestamp                  ← NULL until redeemed; set on redemption
used_by    text                       ← email of redeemer; set on redemption
created_at timestamp NOT NULL DEFAULT now()
```

**Drizzle schema addition** (new file `src/db/schema/invite.ts` or append to `domain.ts`):

```typescript
export const inviteTokens = pgTable("invite_tokens", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  token: text("token").notNull().unique(),
  createdBy: text("created_by").notNull(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  usedAt: timestamp("used_at", { mode: "date" }),
  usedBy: text("used_by"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
})
```

### RLS additions for new tables

Both tables use the service role for all server-side operations (same pattern as
all existing tables). Add to `supabase/policies.sql`:

```sql
-- family_config: authenticated users can read; only service role writes
ALTER TABLE public.family_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can select family_config"
  ON public.family_config FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

-- No INSERT/UPDATE policy for authenticated role.
-- Onboarding wizard uses service role (admin Drizzle connection) to write config.
-- This prevents either parent from directly mutating config via the Supabase client.

-- invite_tokens: authenticated users can read only their own rows; service role handles everything
ALTER TABLE public.invite_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user can select own invite tokens"
  ON public.invite_tokens FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'email') = created_by);
```

---

## Invite Token Design

### Token generation

Use `crypto.randomBytes(32).toString('base64url')` (Node built-in, no package needed).
This produces a 43-character URL-safe string. Stored in `invite_tokens.token` (UNIQUE).

The invite URL is: `https://<domain>/invite/<token>`

Expiry: **72 hours** from creation. Generous enough that the first parent can send the
link over messaging apps without urgency; short enough to limit exposure if the URL
leaks.

Only one outstanding (non-expired, non-used) invite token should exist at a time.
The Server Action that generates a token should first soft-delete (or hard-delete)
any prior unused tokens for the same creator before inserting the new one.

### Validation flow

This integrates with the **existing** `/auth/callback` route. No separate callback
endpoint is needed.

1. Second parent opens `/invite/<token>` in browser.
2. That page Server-renders: validates the token exists, is not expired, is not used.
   If invalid → show error. If valid → stores the token in a short-lived cookie
   (`invite_token=<value>; Max-Age=600; HttpOnly; Secure; SameSite=Lax`) and
   redirects to Google OAuth sign-in (same `signInWithOAuth` call as the normal
   sign-in button, but with `redirectTo` pointing to `/auth/callback`).
3. After Google OAuth, Supabase redirects to `/auth/callback?code=...` (existing
   route handler).
4. `/auth/callback` already handles the PKCE exchange and token upsert. Add a step
   after line 71 (after `user_google_tokens` upsert):
   - Read `invite_token` cookie from the request.
   - If present: look up the row — confirm it is still valid (not expired, not used).
   - If valid: write `used_at = now()` and `used_by = userEmail`, then delete the
     cookie. The authenticated user is now recognised as the second parent (their
     email now matches `family_config.parent2_email`).
   - If absent or invalid: proceed normally (this is a regular sign-in).
5. Middleware updated to check for onboarding state (see Gating section below).

**Why a cookie rather than a query param through the OAuth roundtrip:** Google OAuth
does not guarantee that extra query params on the redirect URI survive the roundtrip.
Supabase's PKCE flow encodes the `code_verifier` in a cookie for the same reason.
A short-lived HttpOnly cookie is the standard pattern.

**Why not embed the token in the `redirectTo` URL as a path segment:** Supabase Auth
validates `redirectTo` against an allowlist of redirect URI origins configured in the
Dashboard. A dynamic path like `/auth/callback?invite=<token>` would require
wildcard allowlisting, which is a security risk. The cookie approach requires no
Dashboard configuration changes.

**Why `used_at` stamp rather than deleting the row on use:** Keeping the row with a
timestamp provides an audit trail. The `invite_tokens` table is small and the row
count will never be significant for a two-user app.

### Onboarding gate: who is "the first parent"?

At app startup (onboarding wizard), the first parent who signs in submits the family
config. Their email is stored in `family_config.parent1_email` (or `parent2_email`,
the role labels are just labels). The second parent arrives via invite link, their
email is matched against the other `parent_email` column.

The app does **not** need to track which Supabase `auth.users` UUID maps to which
parent role — the email match against `family_config` is sufficient, and emails are
already the natural key in this app (`user_google_tokens` PKs on email,
`buildGCalClient` looks up by email).

---

## New Packages (if any)

**No new packages are required.**

All needed capabilities already exist in the stack:

| Need | Already Available |
|------|------------------|
| Cryptographically random token | `crypto.randomBytes` — Node built-in (Node 20+, already required) |
| Token expiry comparison | `date-fns` — already installed |
| Cookie read/write in Route Handler | `@supabase/ssr` cookie API — already installed and used in `/auth/callback` |
| DB operations | Drizzle ORM — already installed |
| Input validation for wizard form | `zod` — already installed |
| Server Actions for wizard steps | `next-safe-action` — already installed |

`crypto.randomBytes` is synchronous and available in Node 20 without import. The only
question is whether it is available in Edge Runtime — it is not needed there; the
token generation Server Action runs in the Node.js runtime (Server Action, not
Middleware), so this is not a concern.

---

## Migration Path

The goal is to cut over from env-var config to DB config **without breaking the
running app for the existing two users**.

### Step 1: Add DB tables (non-breaking)

Run `drizzle-kit push` after adding `familyConfig` and `inviteTokens` to the schema.
No existing tables are modified. The app continues to boot from `src/config/app.ts`
env vars as before.

### Step 2: Seed `family_config` from env vars (non-breaking)

Before deploying any code that reads config from DB, insert the current env-var
values into the new table via a one-time seed script:

```typescript
// scripts/seed-family-config.ts (run once via: npx tsx scripts/seed-family-config.ts)
import { db } from "@/db"
import { familyConfig } from "@/db/schema/domain"

await db.insert(familyConfig).values({
  id: 1,
  parent1Id: process.env.APP_FIRST_PARENT ?? "father",
  parent1Name: process.env.PARENT_FATHER_NAME ?? "Father",
  parent1Email: process.env.PARENT_FATHER_EMAIL!,
  parent1CalendarId: process.env.PARENT_FATHER_CALENDAR_ID!,
  parent2Id: "mother",
  parent2Name: process.env.PARENT_MOTHER_NAME ?? "Mother",
  parent2Email: process.env.PARENT_MOTHER_EMAIL!,
  parent2CalendarId: process.env.PARENT_MOTHER_CALENDAR_ID!,
  children: (process.env.APP_CHILDREN ?? "").split(",").map(s => s.trim()).filter(Boolean),
  startDate: process.env.APP_START_DATE!,
  firstParent: process.env.APP_FIRST_PARENT ?? "father",
}).onConflictDoNothing()  // idempotent — safe to run multiple times
```

### Step 3: Replace `src/config/app.ts` with a DB reader

Replace the synchronous env-var reader with an async function that reads from
`family_config`. Keep the `AppConfig` interface identical so all call sites compile
without changes initially:

```typescript
// src/config/app.ts — new version
export async function getAppConfig(): Promise<AppConfig> {
  const [row] = await db.select().from(familyConfig).where(eq(familyConfig.id, 1))
  if (!row) throw new Error("Family config not found — onboarding not complete")
  return {
    parents: [
      { id: row.parent1Id as ParentId, name: row.parent1Name,
        email: row.parent1Email, calendarId: row.parent1CalendarId,
        ownerEmail: row.parent1Email },
      { id: row.parent2Id as ParentId, name: row.parent2Name,
        email: row.parent2Email, calendarId: row.parent2CalendarId,
        ownerEmail: row.parent2Email },
    ],
    children: row.children,
    startDate: row.startDate,
    firstParent: row.firstParent as ParentId,
  }
}
```

All existing call sites (`gcal/sync.ts`, `schedule/queries.ts`,
`schedule/generate-default.ts`, `app/dashboard/page.tsx`) use `config.parents`,
`config.children`, etc. They must be updated to `await getAppConfig()` — this is
the main mechanical refactor. The `AppConfig` type shape stays identical, so the
changes are syntactic (`const config = await getAppConfig()`) not semantic.

### Step 4: Remove env-var config entries from `src/env.ts`

After Step 3 is deployed and confirmed working, remove these entries from the
`REQUIRED_ENV_VARS` list in `src/env.ts`:
- `PARENT_FATHER_EMAIL`
- `PARENT_MOTHER_EMAIL`
- `APP_CHILDREN`
- `APP_START_DATE`

The calendar-specific vars (`PARENT_FATHER_CALENDAR_ID`, `PARENT_MOTHER_CALENDAR_ID`,
`PARENT_FATHER_NAME`, `PARENT_MOTHER_NAME`, `APP_FIRST_PARENT`) were not in the
required list to begin with (they had defaults or optional `!` assertions), so no
`env.ts` change is needed for those.

Also remove from Vercel environment variable settings and scrub git history per the
existing CR-01 note in PROJECT.md.

### Step 5: Add onboarding gate to middleware

Update `src/middleware.ts` to add a third state after "authenticated":

```typescript
// After confirming user is authenticated:
const isOnOnboarding = pathname.startsWith("/onboarding")

if (user && !isOnOnboarding) {
  // Check if family_config row exists — use a lightweight DB query via service role
  // IMPORTANT: Do NOT run a full DB query in middleware (Edge Runtime).
  // Use a Supabase RPC or a dedicated API route that the middleware calls,
  // OR check for a "onboarding_complete" value in the session metadata.
}
```

**Edge Runtime constraint for middleware:** The existing middleware runs in the Edge
Runtime (Next.js default for `middleware.ts`). Drizzle with `pg` driver is Node-only
and cannot run in Edge Runtime. Two viable approaches:

**Option A (recommended): Store onboarding state as a Supabase user metadata flag.**
When the first parent completes onboarding, set `app_metadata.onboarding_complete = true`
on the Supabase user via the service role admin client. The JWT that Supabase issues
will include this claim. Middleware can read it from the validated JWT without a DB
round-trip:

```typescript
const meta = user.app_metadata as { onboarding_complete?: boolean } | undefined
const onboardingComplete = meta?.onboarding_complete === true
if (user && !onboardingComplete && !isOnOnboarding) {
  return NextResponse.redirect(new URL("/onboarding", request.url))
}
```

Setting `app_metadata` requires the Supabase service role — done from the onboarding
completion Server Action via `supabase.auth.admin.updateUserById(userId, { app_metadata: { onboarding_complete: true } })`.

**Option B: API route check.** Middleware calls an internal `/api/onboarding-status`
route that reads from the DB. Adds latency on every request for unauthenticated
or un-onboarded users. Not recommended for this app's scale.

Option A is preferred: zero added latency on the hot path, no extra API route,
integrates cleanly with the existing `supabase.auth.getUser()` call that middleware
already makes.

### Transition safety

The migration is structured so that each step can be deployed independently:

- Steps 1–2 are purely additive; the running app is unaffected.
- Step 3 is the breaking change (config becomes async). Deploy atomically with the
  DB already seeded from Step 2.
- Steps 4–5 can follow at any time after Step 3 is stable.

The app cannot enter a state where config is missing, because Step 2 seeds the DB
before Step 3 changes the read path.

---

## Summary of Call Site Impact

Files that import `config` from `@/config/app` and will need `await getAppConfig()`:

| File | Current usage | Change needed |
|------|--------------|---------------|
| `src/lib/gcal/sync.ts` | `config.parents` in two places, `config.children` indirectly | `const config = await getAppConfig()` at top of `syncCalendarsAfterPublish` |
| `src/lib/schedule/queries.ts` | `config.children`, `config.firstParent` | `const config = await getAppConfig()` at top of `getScheduleWindow` |
| `src/lib/schedule/generate-default.ts` | `config.startDate`, `config.firstParent` | Pass config as parameter instead of reading module-scope singleton |
| `src/app/dashboard/page.tsx` | `config.parents[0].ownerEmail` | `const config = await getAppConfig()` at top of `Dashboard` |

`generate-default.ts` deserves special attention: it exports a pure function but
reads the module-scope `config` singleton. The cleanest refactor is to change the
signature to accept a `config` parameter, matching the existing pattern in
`queries.ts` that passes `config.children` as an argument. This is a single-file
change that makes the function unit-testable without mocking env vars.
