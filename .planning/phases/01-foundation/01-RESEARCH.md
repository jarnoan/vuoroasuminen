# Phase 1: Foundation - Research

**Researched:** 2026-04-04
**Domain:** Next.js 15 App Router, Auth.js v5 Google OAuth, Drizzle ORM + Supabase PostgreSQL, DB schema
**Confidence:** HIGH

## Summary

Phase 1 is a greenfield Next.js 15 project bootstrap with Google OAuth (Auth.js v5), a Drizzle-managed PostgreSQL schema on Supabase, and a minimal shell UI. All technology decisions are locked in CLAUDE.md and CONTEXT.md; research validates exact implementation patterns against current library APIs.

The most important architectural insight for this phase is the **edge-compatibility split**: Auth.js v5 with a database adapter (Drizzle) cannot run directly in Next.js middleware (edge runtime). The standard solution is a "split config" pattern — `auth.config.ts` (no adapter, used in middleware) and `auth.ts` (full config with Drizzle adapter, used in Server Components and Server Actions). The Drizzle adapter stores OAuth tokens in the `accounts` table regardless of session strategy, so `session: { strategy: "jwt" }` in the full config is correct — it gives edge-safe middleware while still persisting `refresh_token` to PostgreSQL for Phase 4 Calendar sync.

The second key insight is that `pgEnum` in Drizzle **must be exported** from the schema file or `drizzle-kit generate` silently omits the enum from the migration SQL.

**Primary recommendation:** Bootstrap with `create-next-app` (Tailwind v4, TypeScript, App Router, src dir), install Auth.js v5 + Drizzle adapter, implement split config for middleware, and run schema migration against Supabase direct connection (port 5432) before running the dev server.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Hybrid config model — `config/app.ts` holds non-secret structured data (parent names, children list, schedule start date, firstParent); `.env.local` holds private data (parent emails, calendar IDs, Google OAuth client ID/secret, Supabase URL/key)
- **D-02:** `config/app.ts` shape: `{ parents: [{ id, name }], children: string[], startDate: string, firstParent: string }` — typed TypeScript, version-controlled
- **D-03:** Parent emails and calendar IDs go in `.env.local` (not in config file) — keep them private even in a private repo
- **D-04:** After sign-in, render a nav shell with a header-only layout: app logo/name, signed-in user's Google profile picture, and a sign-out button
- **D-05:** Body shows a "Schedule coming soon" placeholder — no nav tabs or section links in Phase 1; full layout freedom deferred to Phase 2
- **D-06:** Implement full refresh token rotation in Phase 1 — Auth.js `jwt` callback exchanges expired access tokens using the stored refresh token; do not defer to Phase 4
- **D-07:** Store `refresh_token` and `access_token` (with expiry) in the Auth.js `accounts` table via the Drizzle adapter — required for server-side Calendar API calls in Phase 4
- **D-08:** Full domain schema created in Phase 1: Auth.js tables (`users`, `accounts`, `sessions`, `verification_tokens`) + all domain tables (`children`, `schedules`, `schedule_entries`, `gcal_events`)
- **D-09:** Use `DATE` column type (not `TIMESTAMP`) for custody day columns — timezone-safe, matches GCAL-05
- **D-10:** Use a `status` enum (draft/published) — not a boolean flag — on `schedule_entries`
- **D-11:** Include `gcal_events` mirror table from day one so Phase 4 has a clean idempotency surface
- **D-12:** Phase 1 targets local development only (`next dev`); Vercel deployment, CI/CD, and env var management in the Vercel dashboard are deferred to Phase 2 or later

### Claude's Discretion

- Auth.js session strategy details (database sessions are required; implementation specifics are at Claude's discretion)
- Drizzle schema file organization (single schema file vs split by domain)
- Supabase connection: direct vs pooled (Supavisor) — choose appropriate for local dev
- Tailwind/shadcn setup details during project bootstrap

### Deferred Ideas (OUT OF SCOPE)

- Vercel deployment and CI/CD setup — deferred to Phase 2 or later
- Nav tabs for Schedule, Statistics sections — deferred to Phase 2 when sections are built
- Full-skeleton layout (sidebar, grid structure) — deferred to Phase 2

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User can sign in with their Google account via OAuth | Auth.js v5 Google provider pattern verified; split config required for middleware edge compat |
| AUTH-02 | User session persists across browser refresh | Auth.js database adapter stores sessions; JWT strategy cookie is httpOnly, survives refresh |
| AUTH-03 | User can sign out from any page | Auth.js `signOut()` Server Action + `<form>` pattern from any layout |
| AUTH-04 | App requests Google Calendar API scope at sign-in so calendar sync works without re-auth | Google provider `authorization.params.scope` with `https://www.googleapis.com/auth/calendar` + `access_type: "offline"` + `prompt: "consent"` |
| SETP-01 | Config file defines two parents, children, start date, first parent | `config/app.ts` typed TypeScript; `.env.local` for secrets; D-01 through D-03 constrain shape exactly |

</phase_requirements>

---

## Standard Stack

### Core (Phase 1 Relevant)

| Library | Version (verified) | Purpose | Why Standard |
|---------|-------------------|---------|--------------|
| Next.js | 16.2.2 | Full-stack React framework | Locked in CLAUDE.md; App Router + Server Actions |
| TypeScript | 5.x (bundled) | Type safety | Non-negotiable per CLAUDE.md |
| next-auth (Auth.js v5) | 5.0.0-beta.30 | Google OAuth; stores tokens | Locked in CLAUDE.md; v5 required for App Router compat |
| @auth/drizzle-adapter | 1.11.1 | Auth.js adapter for PostgreSQL | Stores `refresh_token` in DB for Phase 4 |
| drizzle-orm | 0.45.2 | Type-safe PostgreSQL ORM | Locked in CLAUDE.md |
| drizzle-kit | 0.31.10 | Schema migrations | Required for `drizzle-kit generate` + `push` |
| pg | 8.20.0 | PostgreSQL driver | Required by Drizzle with Supabase direct connection |
| @supabase/supabase-js | 2.101.1 | Supabase client (needed for Phase 2 Realtime; install now) | Locked in CLAUDE.md |
| @supabase/ssr | 0.10.0 | Supabase Next.js App Router cookie helpers | Install alongside supabase-js |
| tailwindcss | 4.2.2 | Utility-first styling | Locked in CLAUDE.md v4 |
| shadcn/ui | latest (via `shadcn@latest`) | UI primitives | Locked in CLAUDE.md; `shadcn@latest` now supports Tailwind v4 natively |
| zod | 4.3.6 | Runtime validation | Locked in CLAUDE.md |
| date-fns | 4.1.0 | Date arithmetic | Locked in CLAUDE.md |

### Phase 1 Dev Tools

| Tool | Version | Purpose |
|------|---------|---------|
| drizzle-kit | 0.31.10 | Drizzle migrations (`generate`, `push`, `migrate`) |
| ESLint | bundled with Next.js | `next lint` |

### Installation (Phase 1 scope)

```bash
npx create-next-app@latest vuoroasuminen \
  --typescript --tailwind --eslint --app --src-dir \
  --import-alias "@/*"

cd vuoroasuminen

npm install next-auth@beta @auth/drizzle-adapter
npm install drizzle-orm pg
npm install @supabase/supabase-js @supabase/ssr
npm install zod date-fns
npm install -D drizzle-kit @types/pg

npx shadcn@latest init
```

---

## Architecture Patterns

### Recommended Project Structure (Phase 1)

```
src/
├── app/
│   ├── api/
│   │   └── auth/
│   │       └── [...nextauth]/
│   │           └── route.ts        # Auth.js route handler
│   ├── layout.tsx                  # Root layout (SessionProvider if needed)
│   └── page.tsx                    # Home — nav shell or sign-in redirect
├── auth.config.ts                  # Edge-safe config (NO adapter) — used in middleware
├── auth.ts                         # Full auth config (with Drizzle adapter)
├── middleware.ts                   # Route protection using auth.config only
├── db/
│   ├── index.ts                    # Drizzle client export (pg Pool)
│   └── schema/
│       ├── auth.ts                 # Auth.js tables (users, accounts, sessions, verification_tokens)
│       └── domain.ts               # children, schedules, schedule_entries, gcal_events
├── config/
│   └── app.ts                      # Non-secret config: parents, children, startDate, firstParent
└── components/
    └── layout/
        └── header.tsx              # Nav shell: logo, user avatar, sign-out button
```

**Note on schema file organization:** Two files (`auth.ts` + `domain.ts`) is the recommended approach for Phase 1. Auth.js tables are infrastructure; domain tables are app logic. Both are imported by `drizzle.config.ts` via glob `src/db/schema/*.ts`.

### Pattern 1: Auth.js Split Config (Edge Compatibility)

**What:** Two separate Auth.js instantiation points to avoid edge runtime crash in middleware.
**When to use:** Any Next.js project using Auth.js v5 with a database adapter.

```typescript
// src/auth.config.ts — NO adapter, NO database imports
import type { NextAuthConfig } from "next-auth"
import Google from "next-auth/providers/google"

export default {
  providers: [
    Google({
      authorization: {
        params: {
          scope: [
            "openid",
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/userinfo.profile",
            "https://www.googleapis.com/auth/calendar",
          ].join(" "),
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  ],
} satisfies NextAuthConfig
```

```typescript
// src/auth.ts — Full config with Drizzle adapter
import NextAuth from "next-auth"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import authConfig from "./auth.config"
import { db } from "@/db"
import { accounts, sessions, users, verificationTokens } from "@/db/schema/auth"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" },  // JWT in cookie; OAuth tokens STILL go to accounts table via adapter
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        return {
          ...token,
          access_token: account.access_token,
          expires_at: account.expires_at,
          refresh_token: account.refresh_token,
        }
      } else if (Date.now() < (token.expires_at as number) * 1000) {
        return token
      } else {
        // Refresh expired access token
        try {
          const response = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            body: new URLSearchParams({
              client_id: process.env.AUTH_GOOGLE_ID!,
              client_secret: process.env.AUTH_GOOGLE_SECRET!,
              grant_type: "refresh_token",
              refresh_token: token.refresh_token as string,
            }),
          })
          const newTokens = await response.json()
          return {
            ...token,
            access_token: newTokens.access_token,
            expires_at: Math.floor(Date.now() / 1000 + newTokens.expires_in),
            refresh_token: newTokens.refresh_token ?? token.refresh_token,
          }
        } catch {
          return { ...token, error: "RefreshTokenError" }
        }
      }
    },
    async session({ session, token }) {
      session.error = (token.error as string) ?? null
      return session
    },
  },
  ...authConfig,
})
```

```typescript
// src/middleware.ts — uses auth.config, NOT full auth.ts
import NextAuth from "next-auth"
import authConfig from "./auth.config"

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const isLoggedIn = !!req.auth
  if (!isLoggedIn && req.nextUrl.pathname !== "/") {
    return Response.redirect(new URL("/", req.url))
  }
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
```

### Pattern 2: Drizzle Schema with pgEnum and DATE Columns

```typescript
// src/db/schema/domain.ts
import { pgTable, pgEnum, text, date, timestamp, primaryKey } from "drizzle-orm/pg-core"
import { users } from "./auth"

// CRITICAL: Export the enum or drizzle-kit generate silently omits it from migration SQL
export const scheduleStatusEnum = pgEnum("schedule_status", ["draft", "published"])

export const children = pgTable("children", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
})

export const schedules = pgTable("schedules", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
})

export const scheduleEntries = pgTable("schedule_entries", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  scheduleId: text("schedule_id").notNull().references(() => schedules.id, { onDelete: "cascade" }),
  childId: text("child_id").notNull().references(() => children.id),
  day: date("day", { mode: "string" }).notNull(),   // DATE, not TIMESTAMP — timezone-safe
  parentId: text("parent_id").notNull(),             // 'father' | 'mother' (from config)
  status: scheduleStatusEnum("status").notNull().default("draft"),
  notes: text("notes"),
})

export const gcalEvents = pgTable("gcal_events", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  scheduleEntryId: text("schedule_entry_id").notNull().references(() => scheduleEntries.id, { onDelete: "cascade" }),
  googleEventId: text("google_event_id").notNull(),
  calendarId: text("calendar_id").notNull(),
  syncedAt: timestamp("synced_at", { mode: "date" }).notNull().defaultNow(),
})
```

### Pattern 3: Drizzle Database Client

```typescript
// src/db/index.ts
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as authSchema from "./schema/auth"
import * as domainSchema from "./schema/domain"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,   // Direct connection (port 5432) for local dev
})

export const db = drizzle(pool, {
  schema: { ...authSchema, ...domainSchema },
})
```

### Pattern 4: App Config File

```typescript
// src/config/app.ts
export type ParentId = "father" | "mother"

export interface AppConfig {
  parents: Array<{ id: ParentId; name: string }>
  children: string[]
  startDate: string      // ISO date string: first Monday of the alternating pattern
  firstParent: ParentId  // which parent starts week 1
}

const config: AppConfig = {
  parents: [
    { id: "father", name: "Isä" },
    { id: "mother", name: "Äiti" },
  ],
  children: ["Emma", "Olivia"],
  startDate: "2026-01-05",   // adjust to actual start Monday
  firstParent: "father",
}

export default config
```

### Pattern 5: Sign-In / Sign-Out Server Actions

```typescript
// In a Server Component or separate actions file
import { signIn, signOut } from "@/auth"

// Sign-in button (Server Component with form)
<form action={async () => { "use server"; await signIn("google") }}>
  <button type="submit">Sign in with Google</button>
</form>

// Sign-out button
<form action={async () => { "use server"; await signOut() }}>
  <button type="submit">Sign out</button>
</form>
```

### Pattern 6: Auth.js Route Handler

```typescript
// src/app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/auth"
export const { GET, POST } = handlers
```

### Pattern 7: drizzle.config.ts

```typescript
// drizzle.config.ts (project root)
import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./src/db/schema/*.ts",           // glob picks up auth.ts + domain.ts
  out: "./drizzle",                          // migration output directory
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,          // direct connection (port 5432)
  },
})
```

**Migration commands:**
```bash
# Generate migration SQL (review before applying)
npx drizzle-kit generate

# Push directly to DB (dev only — use migrate for prod)
npx drizzle-kit push

# Apply generated migrations
npx drizzle-kit migrate
```

### Anti-Patterns to Avoid

- **Importing `auth.ts` (with Drizzle adapter) in `middleware.ts`:** Causes "Cannot find module" or edge runtime crash because `pg` uses TCP sockets. Always use `auth.config.ts` in middleware.
- **Using `TIMESTAMP` for custody day columns:** Timezone shifting corrupts "which day" semantics. Use `DATE` (Drizzle: `date({ mode: "string" })`).
- **Using a boolean `is_published` flag instead of `status` enum:** Booleans don't extend — enum is `draft | published` and future states (e.g., `archived`) require no schema change.
- **Leaving pgEnum unexported:** `drizzle-kit generate` silently drops the enum from the migration file, causing a runtime error on first query.
- **Hardcoding parent names in schema:** `parentId` stores `'father'` or `'mother'` (from config), not a foreign key to a users table — parents are identified by their config role, not their DB user record.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Google OAuth flow | Custom OAuth 2.0 client | Auth.js v5 Google provider | PKCE, state params, token exchange, CSRF are subtle and error-prone |
| Session cookie management | Custom signed cookies | Auth.js v5 (built-in) | Secure defaults: httpOnly, sameSite, rotation |
| Access token refresh | Manual fetch loop | Auth.js `jwt` callback + refresh token rotation guide | Race conditions, token revocation edge cases |
| DB migrations | Raw `CREATE TABLE` SQL | `drizzle-kit generate` + `drizzle-kit migrate` | Type drift between schema and DB; reproducible across environments |
| PostgreSQL connection pooling | Manual `pg.Pool` config | Supavisor (Supabase) for production | For local dev, a simple `pg.Pool` is fine; Supavisor handles prod pooling |

---

## Common Pitfalls

### Pitfall 1: Edge Runtime Crash from Database Adapter in Middleware

**What goes wrong:** Importing `auth` from `auth.ts` (which imports DrizzleAdapter → `pg` → TCP sockets) in `middleware.ts` causes a build-time or runtime error because Next.js middleware runs on the edge.
**Why it happens:** `pg` uses Node.js TCP sockets, which are unavailable in edge runtimes.
**How to avoid:** Use the split config pattern. `middleware.ts` imports from `auth.config.ts` only. The full `auth.ts` is used exclusively in Server Components, Server Actions, and Route Handlers.
**Warning signs:** Build error mentioning "node:net" or "crypto" in edge context.

### Pitfall 2: Google OAuth Returns No Refresh Token After First Login

**What goes wrong:** After the first successful sign-in, Google issues a `refresh_token`. On subsequent sign-ins, Google does NOT re-issue the refresh token unless you force it.
**Why it happens:** Google only sends `refresh_token` on the first authorization unless `prompt: "consent"` is included.
**How to avoid:** Always include `prompt: "consent"` and `access_type: "offline"` in the Google provider `authorization.params`. This forces Google to re-issue the refresh token every sign-in.
**Warning signs:** `account.refresh_token` is `null` in the `jwt` callback after first sign-in.

### Pitfall 3: pgEnum Not Exported Causes Silent Migration Gap

**What goes wrong:** `drizzle-kit generate` produces a migration file that creates tables but omits the `CREATE TYPE` for the enum. Queries referencing the enum column fail at runtime.
**Why it happens:** Drizzle Kit's schema introspection only exports types it finds in the module's exports.
**How to avoid:** `export const scheduleStatusEnum = pgEnum(...)` — always export enum definitions.
**Warning signs:** Migration runs without error but `INSERT` with a status column fails with "invalid input value for enum".

### Pitfall 4: Google OAuth App Not Verified Blocks Real Users

**What goes wrong:** The OAuth consent screen shows an "unverified app" warning, limiting sign-ins to test users added in Google Cloud Console.
**Why it happens:** Any app requesting sensitive scopes (Calendar API = sensitive) requires Google verification before general use.
**How to avoid:** Start the verification process during Phase 1. Add both parents as test users in Google Cloud Console for immediate development use. Verification takes 3-5 business days.
**Warning signs:** Sign-in shows red "Google hasn't verified this app" screen for non-test users.

### Pitfall 5: Supabase Direct Connection vs Pooler for Drizzle

**What goes wrong:** Using the transaction-mode pooler (port 6543) with Drizzle breaks prepared statements, causing query failures.
**Why it happens:** PgBouncer in transaction mode does not support named prepared statements.
**How to avoid:** For local dev, use the **direct connection** string (port 5432). For production on serverless (Vercel), use the session-mode pooler or configure Drizzle to avoid prepared statements.
**Warning signs:** Error "prepared statement does not exist" or "unknown prepared statement" in production.

### Pitfall 6: Auth.js JWT Session + Drizzle Adapter Token Storage Confusion

**What goes wrong:** Developer assumes `session: { strategy: "jwt" }` means tokens are NOT stored in the database, so they skip the Drizzle adapter. The JWT in the cookie expires and there is no refresh token available server-side.
**Why it happens:** "JWT session strategy" only describes how the *session cookie* works, not whether OAuth tokens go to the DB. The Drizzle adapter always persists OAuth tokens to the `accounts` table regardless of session strategy.
**How to avoid:** Use `session: { strategy: "jwt" }` WITH the Drizzle adapter. The adapter writes to `accounts` on every OAuth sign-in. The JWT strategy keeps middleware edge-compatible.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| NextAuth v4 with `pages/api/auth` | Auth.js v5 with App Router handlers | 2024 | v4 incompatible with Next.js 15 App Router in edge cases; v5 required |
| `tailwind.config.js` + `tailwind.config.ts` | CSS-native `@theme` in `globals.css` | Tailwind v4 (early 2025) | No config file needed; shadcn@latest handles this automatically |
| `shadcn@canary` for Tailwind v4 | `shadcn@latest` (Tailwind v4 now stable) | Mid 2025 | Canary was needed during Tailwind v4 beta; latest stable now works |
| `session: { strategy: "database" }` with PgAdapter | Split config JWT + DrizzleAdapter | Ongoing | Database strategy incompatible with edge middleware; JWT + adapter is the standard pattern |
| `pages/` router API routes | `app/api/auth/[...nextauth]/route.ts` | Next.js 13+ | App Router standard |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js runtime | ✓ | v25.3.0 | — |
| npx / npm | Package management | ✓ | create-next-app 16.2.2 | — |
| Supabase project | PostgreSQL + Realtime | Must be provisioned | — | Create free tier project at supabase.com |
| Google Cloud project | OAuth credentials | Must be provisioned | — | Create at console.cloud.google.com |
| psql CLI | DB inspection | ✗ | — | Drizzle Studio (`npx drizzle-kit studio`) |

**Missing dependencies with no fallback:**
- Supabase project (free tier) — must be created before running `drizzle-kit push`
- Google Cloud OAuth credentials (`AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`) — must be created before running the dev server with Google sign-in

**Missing dependencies with fallback:**
- `psql` — not installed, but `npx drizzle-kit studio` provides a web UI for DB inspection

---

## Open Questions

1. **Children seeding strategy**
   - What we know: `config/app.ts` defines `children: string[]`; `children` DB table must exist
   - What's unclear: Should Phase 1 include a seed script that inserts children from config into the DB, or is that Phase 2 (when the schedule grid first reads from the table)?
   - Recommendation: Include a lightweight seed step in Phase 1 migration/setup so the DB is consistent from the start. A one-time `INSERT` in a seed script is simpler than adding it later.

2. **Auth.js TypeScript session augmentation**
   - What we know: `session.error` is not on the default Auth.js `Session` type; TypeScript will complain
   - What's unclear: Whether to use module augmentation in Phase 1 or defer until it's needed
   - Recommendation: Add a minimal `types/next-auth.d.ts` augmenting the `Session` type with `error?: string | null` in Phase 1 to avoid TypeScript errors from the refresh token rotation callback.

---

## Sources

### Primary (HIGH confidence)
- Auth.js official docs — Edge Compatibility guide (split config pattern): https://authjs.dev/guides/edge-compatibility
- Auth.js official docs — Refresh Token Rotation: https://authjs.dev/guides/refresh-token-rotation
- Auth.js official docs — Google provider: https://authjs.dev/getting-started/providers/google
- Auth.js GitHub — @auth/drizzle-adapter PostgreSQL schema (pg.ts): https://github.com/nextauthjs/next-auth/blob/main/packages/adapter-drizzle/src/lib/pg.ts
- Drizzle ORM docs — PostgreSQL column types (date): https://orm.drizzle.team/docs/column-types/pg
- Drizzle ORM docs — Schema declaration: https://orm.drizzle.team/docs/sql-schema-declaration
- shadcn/ui docs — Tailwind v4 support: https://ui.shadcn.com/docs/tailwind-v4
- shadcn/ui docs — Next.js installation: https://ui.shadcn.com/docs/installation/next
- Google Developers — OAuth 2.0 Scopes (Calendar): https://developers.google.com/identity/protocols/oauth2/scopes#calendar
- Supabase docs — Connecting to PostgreSQL (direct vs pooler): https://supabase.com/docs/guides/database/connecting-to-postgres
- npm registry — Verified versions (2026-04-04): next@16.2.2, next-auth@beta 5.0.0-beta.30, drizzle-orm@0.45.2, @auth/drizzle-adapter@1.11.1, tailwindcss@4.2.2

### Secondary (MEDIUM confidence)
- Auth.js concepts — Session Strategies (jwt vs database): https://authjs.dev/concepts/session-strategies (verified against official docs)
- WebSearch — Google provider scope string with openid + calendar: cross-verified against Google OAuth scopes page

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified via `npm view` against npm registry on 2026-04-04
- Architecture patterns: HIGH — split config, refresh token rotation, and schema patterns sourced from official Auth.js docs and official Drizzle adapter source
- Pitfalls: HIGH — edge runtime crash is documented by Auth.js; Google refresh token behavior documented by Google; pgEnum export bug verified in Drizzle issue tracker

**Research date:** 2026-04-04
**Valid until:** 2026-05-04 (Auth.js v5 is still beta; check for breaking changes before executing)
