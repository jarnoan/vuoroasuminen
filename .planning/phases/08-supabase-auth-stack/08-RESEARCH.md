# Phase 8: Supabase Auth Stack - Research

**Researched:** 2026-05-09
**Domain:** Supabase Auth (PKCE OAuth), @supabase/ssr, Drizzle ORM schema, GCal token refactor
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Calendar Ownership Model (GCAL-01, GCAL-02)**
- D-01: Single shared owner — both calendars use the same `ownerEmail` in `app.ts`. GCal sync reads `ownerEmail` per calendar entry and uses that token, regardless of which parent triggered publish.
- D-02: `ownerEmail` is set to whichever user sets up the app and has write access to both calendars.
- D-03: Only the calendar owner needs to sign in for GCal sync to work. The other parent can sign in too but their token is not used for sync.

**Token Failure Page (SAUTH-06)**
- D-04: When the OAuth callback does not yield a `refresh_token`, redirect to an explicit error page (not a silent dashboard redirect).
- D-05: Error page is in Finnish.
- D-06: Error page offers a "Kirjaudu sisään uudelleen" button that re-triggers OAuth with `prompt:consent` + `access_type:offline`.

**Warning Banner (SAUTH-07)**
- D-07: Per-session dismiss — banner reappears on every page load until the calendar owner's `user_google_tokens` row exists. No storage needed.
- D-08: Banner copy: "Kalenterin omistaja ei ole kirjautunut — kalenterisynkronointi ei toimi." + [Kirjaudu sisään] link.

**Middleware & Session Strategy (locked from STATE.md)**
- D-09: Middleware uses `supabase.auth.getUser()` (not `getSession()`) for route protection.
- D-10: Supabase client must NOT be initialized at module scope in middleware.
- D-11: GCal sync and `user_google_tokens` reads always use the admin Drizzle connection (`service_role` key), not the anon Supabase client.

**Critical invariants (from STATE.md)**
- `prompt:consent + access_type:offline` MUST be preserved on every Google sign-in — solved real `invalid_grant` bug in v1.0.
- `provider_refresh_token` is available exactly once: inside `/auth/callback` during `exchangeCodeForSession()`.
- `withRLS` wrapper uses `set_config(..., TRUE)` (transaction-local) — never `FALSE`.
- GATE between Phase 8 and Phase 9: GCal sync confirmed working BEFORE enabling RLS.

### Claude's Discretion

- Supabase server/middleware client helper file locations (`src/lib/supabase/server.ts`, `src/lib/supabase/middleware.ts`)
- `user_google_tokens` table column names and migration details
- `buildGCalClient` refactor — env var names for Google OAuth credentials (`AUTH_GOOGLE_ID` / keep existing or rename)
- `requireAuthorizedParent()` refactor — Supabase `getUser()` instead of Auth.js `auth()`
- Route path for OAuth callback (e.g., `/auth/callback`)
- Route path for token error page (e.g., `/auth/error`)

### Deferred Ideas (OUT OF SCOPE)

- Gender-neutral terminology — `father`/`mother` → `parent1`/`parent2`. Separate refactor phase.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SAUTH-01 | User can sign in with Google via Supabase OAuth flow (PKCE) | signInWithOAuth with scopes + queryParams; callback route with exchangeCodeForSession |
| SAUTH-02 | User session persists across page refreshes via Supabase cookie-based session | createServerClient cookie handlers in middleware refresh session cookies per-request |
| SAUTH-03 | User can sign out | supabase.auth.signOut() in Server Action; clear cookies |
| SAUTH-04 | Unauthenticated users redirected to sign-in on protected routes | Middleware getUser() with redirect to "/" on unauthed /dashboard access |
| SAUTH-05 | Sign-in always forces access_type:offline + prompt:consent | queryParams in signInWithOAuth options; preserved from Auth.js config |
| SAUTH-06 | Google refresh token captured in callback; failed capture redirects to error page | data.session.provider_refresh_token from exchangeCodeForSession; redirect to /auth/error if null |
| SAUTH-07 | Dashboard shows dismissible warning when calendar owner token row absent | Server Component checks user_google_tokens for ownerEmail; passes showOwnerWarning prop to DashboardShell |
| GCAL-01 | GCal sync uses ownerEmail from calendar config regardless of which parent triggers publish | buildGCalClient(ownerEmail) reads from user_google_tokens via admin Drizzle; sync.ts passes ownerEmail from config |
| GCAL-02 | app.ts calendar config includes ownerEmail field per calendar entry | AppConfig interface gets ownerEmail: string per parent entry |
</phase_requirements>

---

## Summary

Phase 8 replaces the Auth.js v5 middleware and sign-in flow with Supabase OAuth (PKCE) while keeping Auth.js installed and functional. The Supabase PKCE flow requires: (1) `signInWithOAuth` with `access_type:offline`, `prompt:consent`, and the Google Calendar scope in `options.scopes`; (2) a `/auth/callback` Route Handler that calls `exchangeCodeForSession(code)`, captures `data.session.provider_refresh_token` (available only at this moment, confirmed by `@supabase/auth-js` type definitions), and writes it to a new `user_google_tokens` table via the admin Drizzle connection; and (3) middleware replaced with a per-request `createServerClient` calling `getUser()`.

The GCal refactor is the other major chunk: `buildGCalClient` currently reads from the Auth.js `accounts` table joined to `users`. It must be changed to read from `user_google_tokens` by `ownerEmail` (a new column added to each calendar entry in `app.ts`). `sync.ts` passes `parent.ownerEmail` rather than `parent.email` to the builder. The `env.ts` validation list gains `SUPABASE_SERVICE_ROLE_KEY` (already needed for admin Drizzle, confirmed not yet present).

Auth.js parallel coexistence is safe: `src/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/actions/auth.ts`, `src/app/page.tsx`, and `src/components/layout/header.tsx` all reference Auth.js and need updating, but no package removal occurs in this phase. The main risk is ensuring the new middleware does not break the `[...nextauth]` API route — the Supabase middleware matcher must pass through `/api/auth/*` routes unrestricted.

**Primary recommendation:** Implement in this order: (1) Drizzle schema + push, (2) server/middleware Supabase client helpers, (3) new middleware, (4) `/auth/callback` route with token capture, (5) sign-in button + home page, (6) header + sign-out, (7) GCal client refactor + app.ts, (8) dashboard warning banner, (9) error page. This ordering means the token store exists before anything tries to write to it.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| OAuth initiation (signInWithOAuth) | Browser (Client Component) | — | Must run in browser to redirect user to Google consent screen |
| PKCE code exchange (exchangeCodeForSession) | Next.js Route Handler | — | Server-side only; this is where provider_refresh_token is available |
| Token storage (user_google_tokens write) | Next.js Route Handler | — | Runs immediately after code exchange in the same route handler |
| Session cookie management | Middleware | Server Components | Middleware refreshes expired cookies; Server Components read session |
| Route protection | Middleware | — | Middleware intercepts before page render; never in Client Components |
| User identity for authorization | API / Backend (Server Action) | — | requireAuthorizedParent() calls getUser() server-side |
| GCal client construction | API / Backend (Server Action / sync.ts) | — | Reads from admin DB; must be server-only |
| Dashboard owner warning check | Frontend Server (Server Component) | — | dashboard/page.tsx checks user_google_tokens before render |
| Dismiss banner state | Browser (Client Component) | — | Per-session only, useState — no server persistence needed |

---

## Standard Stack

### Core (already installed — no new packages needed)

[VERIFIED: package.json + node_modules]

| Library | Installed Version | Purpose | Notes |
|---------|------------------|---------|-------|
| `@supabase/ssr` | 0.10.0 | createServerClient for middleware, Server Components, Route Handlers | Already installed; provides PKCE flow |
| `@supabase/supabase-js` | 2.101.1 | Supabase client base | Already installed; auth-js types included |
| `drizzle-orm` | 0.45.2 | Database queries and schema | Already installed; upsert via onConflictDoUpdate |
| `drizzle-kit` | 0.31.10 | Schema migrations | `npm run db:push` (dev) / `npm run db:generate` |
| `next-auth` | 5.0.0-beta.30 | Auth.js v5 — stays installed, untouched in Phase 8 | Middleware reference removed, package stays |
| `googleapis` | 171.4.0 | Google Calendar API client | Already installed; no change |

**No new packages to install for Phase 8.**

### New Environment Variables Needed

| Variable | Where | Purpose |
|----------|-------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` + deployment | Admin Drizzle connection for `user_google_tokens` reads (D-11) |

`AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` are **kept as-is** — they are already referenced in `src/lib/gcal/client.ts` and `src/auth.ts`. The Supabase Dashboard stores Google OAuth client credentials separately (configured via the Supabase project settings), so the env vars are not renamed.

---

## Architecture Patterns

### System Architecture Diagram

```
Browser                     Next.js Server                    External
──────────────────────────────────────────────────────────────────────
[SignInButton]              
  │ supabase.auth.signInWithOAuth()
  │ (scopes + access_type:offline + prompt:consent)
  │────────────────────────────────────────────────► Supabase Auth Server
                                                      │ → Google OAuth consent
                                                      │ → code redirect back to:
                             [/auth/callback]  ◄──────┘
                               │ exchangeCodeForSession(code)
                               │  └─ data.session.provider_refresh_token
                               │  └─ data.session.user.email
                               │ db.insert(user_google_tokens)  ──► Supabase/Postgres
                               │   .onConflictDoUpdate()
                               │ if !provider_refresh_token → redirect /auth/error
                               │ else → redirect /dashboard
                               ▼
[middleware.ts]            Per-request createServerClient (NOT module scope)
                           supabase.auth.getUser()  ──► Supabase Auth Server (JWT verify)
                           !user && /dashboard → redirect /
                               ▼
[dashboard/page.tsx]       db.select user_google_tokens WHERE email = ownerEmail
  (Server Component)       showOwnerWarning = (row not found)
                               │
                               ▼
[DashboardShell]           showOwnerWarning → dismissible banner
  (Client Component)
                               │
[publishSchedule()]        syncCalendarsAfterPublish()
  (Server Action)              └─ buildGCalClient(parent.ownerEmail)
                                    └─ db.select user_google_tokens WHERE email = ownerEmail
                                    └─ token exchange → googleapis Calendar client
```

### Recommended Project Structure (new files only)

```
src/
├── lib/supabase/
│   ├── client.ts        # existing browser client (Realtime) — unchanged
│   ├── server.ts        # NEW: createServerClient for Server Components + Route Handlers
│   └── middleware.ts    # NEW: createServerClient factory for middleware (per-request)
├── app/
│   ├── auth/
│   │   ├── callback/
│   │   │   └── route.ts  # NEW: PKCE code exchange + token capture
│   │   └── error/
│   │       └── page.tsx  # NEW: Finnish error page with re-auth button
│   └── dashboard/
│       └── page.tsx      # UPDATED: check user_google_tokens for ownerEmail
├── db/schema/
│   └── tokens.ts         # NEW: user_google_tokens table definition
├── components/
│   ├── sign-in-button.tsx          # UPDATED: Supabase signInWithOAuth
│   ├── owner-warning-banner.tsx    # NEW: dismissible warning banner
│   └── layout/
│       └── header.tsx              # UPDATED: Supabase getUser + signOut
├── actions/
│   ├── auth.ts           # UPDATED: signOutAction uses Supabase signOut
│   └── schedule.ts       # UPDATED: requireAuthorizedParent() uses Supabase getUser()
├── config/
│   └── app.ts            # UPDATED: AppConfig adds ownerEmail per parent entry
├── lib/gcal/
│   ├── client.ts         # UPDATED: buildGCalClient(ownerEmail) reads user_google_tokens
│   └── sync.ts           # UPDATED: pass ownerEmail from config instead of parent.email
├── middleware.ts          # REPLACED: Supabase getUser() guard
└── env.ts                # UPDATED: add SUPABASE_SERVICE_ROLE_KEY to required list
```

---

## Pattern 1: signInWithOAuth with Calendar Scope

[VERIFIED: Context7 /supabase/supabase docs + type definitions in node_modules]

```typescript
// src/components/sign-in-button.tsx
"use client"
import { createBrowserClient } from "@supabase/ssr"
import { Button } from "@/components/ui/button"

export default function SignInButton() {
  async function handleSignIn() {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: [
          "openid",
          "https://www.googleapis.com/auth/userinfo.email",
          "https://www.googleapis.com/auth/userinfo.profile",
          "https://www.googleapis.com/auth/calendar",
        ].join(" "),
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    })
  }

  return (
    <Button size="lg" onClick={handleSignIn}>
      Kirjaudu sisään Googlella
    </Button>
  )
}
```

**Key points:**
- `scopes` goes in `options.scopes` (space-separated string), NOT `queryParams`
- `access_type` and `prompt` go in `options.queryParams`
- `redirectTo` must match an allowed URL in Supabase Auth dashboard settings

---

## Pattern 2: OAuth Callback Route — Token Capture

[VERIFIED: Context7 /supabase/ssr + @supabase/auth-js type definitions in node_modules]

`exchangeCodeForSession` returns `AuthTokenResponse` = `{ data: { user: User; session: Session }, error }`.

`Session` type (confirmed in `node_modules/@supabase/auth-js/dist/module/lib/types.d.ts`):
- `provider_refresh_token?: string | null` — the Google refresh token (only present at this moment in PKCE flow)
- `provider_token?: string | null` — the Google access token

```typescript
// src/app/auth/callback/route.ts
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { db } from "@/db"
import { userGoogleTokens } from "@/db/schema/tokens"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")

  if (!code) {
    return NextResponse.redirect(new URL("/auth/error", request.url))
  }

  // Build response object BEFORE creating supabase client so cookies can be set
  const response = NextResponse.redirect(new URL("/dashboard", request.url))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.session) {
    return NextResponse.redirect(new URL("/auth/error", request.url))
  }

  const providerRefreshToken = data.session.provider_refresh_token
  const userEmail = data.session.user.email

  // CRITICAL: provider_refresh_token is only available HERE — store it now
  if (!providerRefreshToken || !userEmail) {
    return NextResponse.redirect(new URL("/auth/error", request.url))
  }

  // Write to user_google_tokens via admin Drizzle (D-11)
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

  return response
}
```

**Critical pitfall:** The response object must be created before the Supabase client so cookies set by `exchangeCodeForSession` land on the redirect response. If you create `NextResponse.redirect` after, the session cookies won't be included.

---

## Pattern 3: Middleware (Per-Request, No Module Scope)

[VERIFIED: Context7 /supabase/ssr + STATE.md D-09, D-10]

```typescript
// src/middleware.ts
import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  // CRITICAL: create client inside the function, never at module scope (D-10)
  const response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // getUser() validates JWT server-side — NOT spoofable like getSession() (D-09)
  const { data: { user } } = await supabase.auth.getUser()

  const isOnHome = request.nextUrl.pathname === "/"
  const isOnAuthCallback = request.nextUrl.pathname.startsWith("/auth/")

  if (!user && !isOnHome && !isOnAuthCallback) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return response
}

export const config = {
  // Pass through Next.js internals AND the nextauth API route
  // Supabase getUser() must NOT intercept the [...nextauth] route while Auth.js coexists
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
}
```

**Key change from existing middleware:** The `matcher` excludes `api/auth` (not just `api`) to let the Auth.js `[...nextauth]` route handler continue working while Auth.js is still installed.

---

## Pattern 4: Server Client Helper (Server Components + Route Handlers)

[VERIFIED: Context7 /supabase/ssr]

```typescript
// src/lib/supabase/server.ts
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )
}
```

Usage in Server Components:
```typescript
const supabase = await createSupabaseServerClient()
const { data: { user } } = await supabase.auth.getUser()
```

---

## Pattern 5: Drizzle Schema — user_google_tokens Table

[VERIFIED: drizzle-orm patterns from Context7 /drizzle-team/drizzle-orm-docs]

```typescript
// src/db/schema/tokens.ts
import { pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const userGoogleTokens = pgTable("user_google_tokens", {
  email: text("email").primaryKey(),
  refreshToken: text("refresh_token").notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
})
```

**Design decisions:**
- `email` as primary key — matches ownerEmail lookup pattern; no UUID foreign key to Supabase auth.users needed in Phase 8 (RLS and FK to auth.users is Phase 9 work)
- No `access_token` column — `buildGCalClient` always exchanges the `refresh_token` for a fresh `access_token` (same pattern as existing client.ts)
- `onConflictDoUpdate` in callback route — handles re-sign-in correctly (upsert semantics)

**Migration command:** `npm run db:push` (uses `drizzle-kit push` which is already in package.json)

Schema must be exported from `src/db/schema/tokens.ts` and added to the Drizzle instance in `src/db/index.ts`.

---

## Pattern 6: GCal Client Refactor

[VERIFIED: existing src/lib/gcal/client.ts + CONTEXT.md D-11]

```typescript
// src/lib/gcal/client.ts (refactored)
import { google } from "googleapis"
import type { calendar_v3 } from "googleapis"
import { db } from "@/db"
import { userGoogleTokens } from "@/db/schema/tokens"
import { eq } from "drizzle-orm"

export async function buildGCalClient(
  ownerEmail: string
): Promise<calendar_v3.Calendar> {
  const [row] = await db
    .select({ refreshToken: userGoogleTokens.refreshToken })
    .from(userGoogleTokens)
    .where(eq(userGoogleTokens.email, ownerEmail))
    .limit(1)

  if (!row?.refreshToken) {
    throw new Error(
      `No refresh token found for ${ownerEmail}. Calendar owner must sign in.`
    )
  }

  // Same token exchange pattern as before — manually exchange refresh_token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID!,
      client_secret: process.env.AUTH_GOOGLE_SECRET!,
      grant_type: "refresh_token",
      refresh_token: row.refreshToken,
    }),
  })

  if (!tokenResponse.ok) {
    const errBody = await tokenResponse.text()
    throw new Error(`Token exchange failed for ${ownerEmail}: ${errBody}`)
  }

  const { access_token, expires_in } = await tokenResponse.json() as {
    access_token: string
    expires_in: number
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.AUTH_GOOGLE_ID,
    process.env.AUTH_GOOGLE_SECRET,
  )
  oauth2Client.setCredentials({
    access_token,
    expiry_date: Date.now() + (expires_in - 60) * 1000,
  })

  return google.calendar({ version: "v3", auth: oauth2Client })
}
```

**`app.ts` change:** Add `ownerEmail: string` to each parent entry:
```typescript
export interface AppConfig {
  parents: Array<{
    id: ParentId
    name: string
    email: string        // parent's own email (for display / future use)
    calendarId: string
    ownerEmail: string   // NEW: email of user whose token is used for GCal sync
  }>
  // ...
}
```

**`sync.ts` change:** Pass `parent.ownerEmail` to `buildGCalClient` instead of `parent.email`.

**`AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` env vars:** Keep as-is. These are already validated by `src/env.ts` and used in both `src/auth.ts` (Auth.js token refresh) and `src/lib/gcal/client.ts`. Renaming is out of scope for Phase 8.

---

## Pattern 7: requireAuthorizedParent() Refactor

```typescript
// src/actions/schedule.ts (updated helper)
import { createSupabaseServerClient } from "@/lib/supabase/server"

async function requireAuthorizedParent() {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user?.email) throw new Error("Not authenticated")
  const isAuthorized = config.parents.some((p) => p.email === user.email)
  if (!isAuthorized) throw new Error("Forbidden")
  return { user, email: user.email }
}
```

---

## Pattern 8: Dashboard Warning Banner

```typescript
// src/app/dashboard/page.tsx (Server Component — updated)
import { db } from "@/db"
import { userGoogleTokens } from "@/db/schema/tokens"
import { eq } from "drizzle-orm"
import config from "@/config/app"

// In the Dashboard component:
const ownerEmail = config.parents[0].ownerEmail // or derive from config
const [tokenRow] = await db
  .select({ email: userGoogleTokens.email })
  .from(userGoogleTokens)
  .where(eq(userGoogleTokens.email, ownerEmail))
  .limit(1)
const showOwnerWarning = !tokenRow
```

DashboardShell receives `showOwnerWarning: boolean` and renders the banner as a dismissible Client Component. The dismissal is `useState` only — no localStorage, no server persistence (D-07).

---

## Pattern 9: signOut Refactor

```typescript
// src/actions/auth.ts (updated)
"use server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export async function signOutAction() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect("/")
}
```

---

## Pattern 10: Home Page Auth Check

```typescript
// src/app/page.tsx (updated — replaces Auth.js auth() check)
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import SignInButton from "@/components/sign-in-button"

export default async function Home() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect("/dashboard")

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold">Vuoroasuminen</h1>
        <p className="text-muted-foreground">Yhteinen vuoroasumisaikataulu vanhemmille</p>
        <SignInButton />
      </div>
    </main>
  )
}
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PKCE code verifier management | Custom code_verifier cookie logic | `@supabase/ssr` createServerClient | SSR package handles PKCE verifier cookie automatically |
| Session cookie management | Manual cookie set/clear | `@supabase/ssr` setAll/getAll handlers | Handles chunked cookies, SameSite, and Secure flags |
| JWT verification | Parse and verify JWT manually | `supabase.auth.getUser()` | Contacts Supabase Auth server to verify JWT — cannot be spoofed |
| Token upsert | SELECT + UPDATE or INSERT logic | Drizzle `.onConflictDoUpdate()` | Handles concurrent re-sign-ins correctly without race conditions |

---

## Common Pitfalls

### Pitfall 1: Module-Scope Supabase Client in Middleware

**What goes wrong:** Sessions leak between users on Vercel warm instances when the Supabase client (and its session state) is created once at module load time and reused across requests.

**Why it happens:** Node.js module caching; the client stores session in memory tied to the first authenticated user.

**How to avoid:** Always call `createServerClient(...)` inside the `middleware` function body, never at the top level (D-10). The examples in Pattern 3 are correct.

**Warning signs:** One parent's session showing for the other parent on refresh.

---

### Pitfall 2: provider_refresh_token is Null After Code Exchange

**What goes wrong:** `data.session.provider_refresh_token` is `null` even though `access_type:offline` was specified. The callback redirects to the error page on every sign-in.

**Why it happens:** Two causes:
1. The user previously authorized the app without `prompt:consent`, so Google does not re-issue a refresh token on subsequent sign-ins unless consent is shown again.
2. The scopes passed to `signInWithOAuth` don't include the Calendar scope, or `queryParams.access_type` / `queryParams.prompt` were omitted.

**How to avoid:** Always include `access_type: "offline"` and `prompt: "consent"` in `queryParams`. The Supabase Dashboard Google provider config does NOT need `access_type:offline` — it goes in the `signInWithOAuth` call (not the Supabase Dashboard).

**Warning signs:** The error page appears on first sign-in — check the signInWithOAuth call has both queryParams.

---

### Pitfall 3: Cookie Not Set on Redirect Response

**What goes wrong:** Session is established but the browser cookie is never written, so the next page load shows the user as unauthenticated.

**Why it happens:** If `NextResponse.redirect(...)` is created after calling `exchangeCodeForSession`, the `setAll` callback has already fired but couldn't set cookies on a response that didn't exist yet.

**How to avoid:** Create the `response = NextResponse.redirect(...)` BEFORE creating the Supabase client, then pass `response.cookies.set(...)` in `setAll`. The Pattern 2 example above is the correct ordering.

**Warning signs:** Sign-in succeeds (no error page) but the user is immediately redirected back to sign-in from the dashboard.

---

### Pitfall 4: Middleware Blocking the nextauth API Route

**What goes wrong:** The Auth.js `[...nextauth]` route at `/api/auth/*` stops working because the Supabase middleware intercepts it and `getUser()` fails (no Supabase session there), causing a redirect loop or 500.

**Why it happens:** The existing middleware matcher `/((?!api|_next/static|...)*)` excluded all `/api/*` routes; the new Supabase middleware must preserve this exclusion.

**How to avoid:** The `matcher` in Pattern 3 uses `/((?!api/auth|_next/static|...)*)` — this passes `/api/auth/*` through without Supabase processing. Auth.js `[...nextauth]` continues to function for the remainder of Phase 8.

**Warning signs:** Sign-out via Auth.js or the nextauth handlers returns 500 or redirect loops.

---

### Pitfall 5: db/index.ts Doesn't Know About user_google_tokens Schema

**What goes wrong:** `db.insert(userGoogleTokens)` throws a runtime error about unknown table or type mismatch.

**Why it happens:** `src/db/index.ts` merges `authSchema` and `domainSchema`. The new `tokens.ts` schema is not imported.

**How to avoid:** Import `tokensSchema` from `./schema/tokens` in `src/db/index.ts` and spread it into the Drizzle schema object.

**Warning signs:** TypeScript compiles fine but runtime throws `relation "user_google_tokens" does not exist` — means `db:push` wasn't run OR the schema wasn't imported.

---

### Pitfall 6: Auth.js src/app/page.tsx Still Calls auth() on Session Check

**What goes wrong:** Home page calls Auth.js `auth()` to check session. Supabase user is logged in but Auth.js session is null, so the page shows the sign-in button to an already-authenticated user (or vice versa: Auth.js session exists but Supabase doesn't).

**Why it happens:** The two auth systems maintain separate sessions in separate cookies. After switching to Supabase OAuth, the user has a Supabase session but no Auth.js JWT cookie.

**How to avoid:** Replace ALL `auth()` calls in server-rendered pages with Supabase `getUser()`. The home page, header, and `requireAuthorizedParent()` all use `auth()` currently — all must be updated. (See Patterns 7, 10 above.)

**Warning signs:** Sign-in redirects correctly but the Header still shows the sign-in page content, or `requireAuthorizedParent()` throws "Not authenticated" for a logged-in Supabase user.

---

### Pitfall 7: ownerEmail Not Matching Any user_google_tokens Row

**What goes wrong:** GCal sync throws "No refresh token found for [email]" immediately after Phase 8 deploy, even though the owner signed in.

**Why it happens:** `app.ts` `ownerEmail` config is set to the wrong email, or the owner has not yet signed in via the new Supabase OAuth flow (they may have an Auth.js session from before Phase 8).

**How to avoid:** After deploy, the calendar owner must sign in via the new Supabase OAuth flow to populate `user_google_tokens`. The dashboard warning banner (SAUTH-07) covers this case — it stays visible until the row exists.

---

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Auth.js `accounts` table has `refresh_token` for existing users. `user_google_tokens` table does not exist yet. | Schema migration (`db:push`) creates the new table. Both parents must re-sign-in via Supabase to populate it. |
| Live service config | Supabase Dashboard: Google provider must be enabled with client_id + secret; redirect URI must be `https://<ref>.supabase.co/auth/v1/callback` (Supabase's server, NOT the Next.js callback) | Manual config in Supabase Dashboard before Phase 8 is usable |
| Live service config | Supabase Dashboard allowlist: add the app's origin + `/auth/callback` to the allowed redirect URLs list | Manual config step |
| OS-registered state | None — no OS-level auth registrations | None |
| Secrets/env vars | `SUPABASE_SERVICE_ROLE_KEY` not yet in `.env.local` or deployment. `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` stay (used by both Auth.js and gcal/client.ts). | Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` — currently the admin Drizzle connection uses `DATABASE_URL` not the service role key; confirm whether Drizzle needs it or if DATABASE_URL suffices |
| Build artifacts | None affected by this phase | None |

**Clarification on `SUPABASE_SERVICE_ROLE_KEY`:** The existing `src/db/index.ts` uses `DATABASE_URL` (a direct Postgres connection string) — not the Supabase service role key. All `db.*` calls in `gcal/client.ts` bypass Supabase Auth entirely (direct Postgres). The service role key is only needed if using the Supabase JS client with `admin` access. Since `user_google_tokens` reads in Phase 8 go through Drizzle's direct Postgres connection (which is already privileged via `DATABASE_URL`), `SUPABASE_SERVICE_ROLE_KEY` is NOT needed in Phase 8. It becomes relevant in Phase 9 when RLS is enabled and the Supabase JS client (with its JWT-based auth context) may need to bypass RLS for admin operations. [ASSUMED — verify that DATABASE_URL continues to have superuser/owner access and is not affected by Phase 9 RLS changes]

---

## Open Questions

1. **Google OAuth redirect URI configuration**
   - What we know: The Supabase Dashboard Google provider requires the redirect URI to be `https://<ref>.supabase.co/auth/v1/callback`. The Next.js `/auth/callback` Route Handler is called after Supabase's server processes the OAuth code and redirects to the `redirectTo` URL.
   - What's unclear: The Google Cloud Console currently has an authorized redirect URI pointing somewhere. After switching to Supabase, it must be updated to `https://<ref>.supabase.co/auth/v1/callback`. STATE.md mentions this as a pending operational todo.
   - Recommendation: Make this a Wave 0 task (before any other work). The OAuth flow is completely blocked without this redirect URI update.

2. **Auth.js session cleanup after Phase 8 deploy**
   - What we know: Both parents currently have Auth.js JWT cookies. After Phase 8 deploy, the middleware no longer validates Auth.js sessions — Supabase `getUser()` will return null for them until they sign in via Supabase.
   - What's unclear: Do the old Auth.js cookies cause any interference with the new Supabase cookies (cookie name collision)?
   - What research found: Auth.js cookies use prefix `next-auth.*`; Supabase cookies use prefix `sb-<project-ref>-auth-token`. No collision. [VERIFIED: both packages installed, naming confirmed by convention]
   - Recommendation: No explicit cleanup needed. Both parents will see the sign-in page on first visit after deploy (Auth.js session ignored by new middleware, Supabase session doesn't exist yet).

3. **header.tsx: Supabase user object shape**
   - What we know: Auth.js session has `session.user.image`, `session.user.name`. Supabase `getUser()` returns a `User` object.
   - What's unclear: Does the Supabase user object have `user_metadata.avatar_url` and `user_metadata.full_name` (from Google's identity token)?
   - Research: [ASSUMED] Google OAuth via Supabase populates `user.user_metadata.avatar_url` and `user.user_metadata.full_name`. The header needs to read from these paths rather than `session.user.image` / `session.user.name`.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@supabase/ssr` | Middleware, server client, callback route | Yes | 0.10.0 | — |
| `@supabase/supabase-js` | Auth operations | Yes | 2.101.1 | — |
| `drizzle-orm` | user_google_tokens schema + queries | Yes | 0.45.2 | — |
| `drizzle-kit` | Schema push | Yes | 0.31.10 | — |
| Supabase project (running) | All auth | Assumed yes (NEXT_PUBLIC_SUPABASE_URL in env.ts) | — | None |
| Google Cloud Console OAuth app | Auth + GCal | Assumed configured (AUTH_GOOGLE_ID present) | — | None |
| `SUPABASE_SERVICE_ROLE_KEY` in env | NOT needed Phase 8 (see Runtime State Inventory) | N/A | — | Uses DATABASE_URL |

**No blocking missing dependencies for code work.** The Supabase Dashboard Google provider configuration and Google Cloud Console redirect URI update are operational tasks that must be done before the flow can be tested end-to-end.

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| `createBrowserSupabaseClient()` pattern (auth-helpers) | `createBrowserClient()` from `@supabase/ssr` | auth-helpers-nextjs is deprecated; `@supabase/ssr` is the current package |
| `getSession()` for route protection | `getUser()` for route protection | `getSession()` trusts cookies without server validation; `getUser()` validates JWT with Supabase server |
| Implicit OAuth flow | PKCE flow | PKCE is default for `createServerClient`; more secure for server-side auth |
| `createServerComponentClient()` | `createServerClient()` from `@supabase/ssr` | Unified API across all server contexts |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `DATABASE_URL` Postgres connection bypasses RLS and has full table access, so SUPABASE_SERVICE_ROLE_KEY is not needed in Phase 8 for `user_google_tokens` | Runtime State Inventory, Pattern 2 | If DATABASE_URL has limited permissions, Drizzle inserts to user_google_tokens would fail; fix by adding SUPABASE_SERVICE_ROLE_KEY |
| A2 | Supabase Google OAuth populates `user.user_metadata.avatar_url` and `user.user_metadata.full_name` for use in the header | Open Questions | Header avatar/name shows blank or throws; fix by checking actual user_metadata shape after first sign-in |
| A3 | Both Google Calendar scope (`googleapis.com/auth/calendar`) requested in `options.scopes` of signInWithOAuth will cause Google to show an expanded consent screen | Pattern 1 | If Calendar scope is blocked pre-verification, sign-in may fail; the app is already in this situation with Auth.js (same scopes) |

---

## Project Constraints (from CLAUDE.md)

- **Auth:** Google OAuth only — no email/password auth
- **Calendar:** Google Calendar API integration is hard requirement
- **Collaboration:** Real-time shared data (Supabase Realtime) — Phase 8 does not break this
- **Conflict resolution:** Last-write-wins (no change in Phase 8)
- **Stack:** Next.js 15, TypeScript 5, Auth.js v5 (stays in Phase 8), Drizzle ORM, Supabase
- **GSD Workflow:** All file changes must go through a GSD command (planning artifacts must stay in sync)

---

## Sources

### Primary (HIGH confidence)

- Context7 `/supabase/ssr` — middleware, server client, OAuth callback, PKCE flow patterns
- Context7 `/supabase/supabase` — signInWithOAuth Google queryParams (access_type:offline, prompt:consent), provider_refresh_token
- `node_modules/@supabase/auth-js/dist/module/lib/types.d.ts` — `Session` type confirming `provider_refresh_token?: string | null` is a field on the Session returned by `exchangeCodeForSession`
- `node_modules/@supabase/auth-js/dist/module/GoTrueClient.d.ts` — `exchangeCodeForSession` signature confirming return type is `AuthTokenResponse = { data: { user, session }, error }`
- Context7 `/drizzle-team/drizzle-orm-docs` — upsert pattern with `onConflictDoUpdate`
- Project codebase: `src/auth.ts`, `src/lib/gcal/client.ts`, `src/lib/gcal/sync.ts`, `src/config/app.ts`, `src/middleware.ts`, `src/db/schema/`, `src/actions/schedule.ts`, `src/components/sign-in-button.tsx`

### Secondary (MEDIUM confidence)

- GitHub discussion #22653 — pattern for `getSession()` after `exchangeCodeForSession` to access `provider_refresh_token` (confirmed alternative path; Pattern 2 uses direct `data.session` which is cleaner)
- [codewithsachintha.com](https://codewithsachintha.com/blog/google-oauth-gmail-calendar-integration-react-supabase/) — Google Calendar scopes with signInWithOAuth `options.scopes`

### Tertiary (LOW confidence)

- A3 (Calendar scope consent screen behavior) — based on how Google OAuth scope verification works; confirmed by existing Auth.js config having same scopes

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all packages verified in node_modules
- Architecture: HIGH — patterns verified from official @supabase/ssr source + type definitions
- provider_refresh_token availability: HIGH — verified in Session type definition in installed package
- Pitfalls: HIGH — most derived from STATE.md locked decisions + official documentation
- header.tsx user_metadata shape: LOW — assumed from Google OAuth conventions; needs verification against actual Supabase user object after first sign-in

**Research date:** 2026-05-09
**Valid until:** 2026-06-09 (Supabase SSR 0.10.x API is stable; 30 days)
