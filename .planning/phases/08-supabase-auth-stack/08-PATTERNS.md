# Phase 8: Supabase Auth Stack - Pattern Map

**Mapped:** 2026-05-09
**Files analyzed:** 14 new/modified files
**Analogs found:** 14 / 14

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/supabase/server.ts` | utility | request-response | `src/lib/supabase/client.ts` | role-match |
| `src/lib/supabase/middleware.ts` | utility | request-response | `src/lib/supabase/client.ts` | role-match |
| `src/middleware.ts` | middleware | request-response | `src/middleware.ts` (current) | exact-replace |
| `src/app/auth/callback/route.ts` | route | request-response | `src/app/api/auth/[...nextauth]/route.ts` | role-match |
| `src/app/auth/error/page.tsx` | component | request-response | `src/app/page.tsx` | role-match |
| `src/db/schema/tokens.ts` | model | CRUD | `src/db/schema/domain.ts` | role-match |
| `src/db/index.ts` | config | CRUD | `src/db/index.ts` (current) | exact-patch |
| `src/components/sign-in-button.tsx` | component | event-driven | `src/components/sign-in-button.tsx` (current) | exact-replace |
| `src/components/owner-warning-banner.tsx` | component | event-driven | `src/components/schedule/publish-button.tsx` | role-match |
| `src/components/layout/header.tsx` | component | request-response | `src/components/layout/header.tsx` (current) | exact-patch |
| `src/actions/auth.ts` | service | request-response | `src/actions/auth.ts` (current) | exact-replace |
| `src/actions/schedule.ts` | service | CRUD | `src/actions/schedule.ts` (current) | exact-patch |
| `src/app/dashboard/page.tsx` | component | CRUD | `src/app/dashboard/page.tsx` (current) | exact-patch |
| `src/config/app.ts` | config | — | `src/config/app.ts` (current) | exact-patch |
| `src/lib/gcal/client.ts` | service | request-response | `src/lib/gcal/client.ts` (current) | exact-replace |
| `src/lib/gcal/sync.ts` | service | CRUD | `src/lib/gcal/sync.ts` (current) | exact-patch |
| `src/env.ts` | config | — | `src/env.ts` (current) | exact-patch |
| `src/app/page.tsx` | component | request-response | `src/app/page.tsx` (current) | exact-patch |

---

## Pattern Assignments

### `src/lib/supabase/server.ts` (utility, request-response)

**Analog:** `src/lib/supabase/client.ts`

**Imports pattern** (client.ts lines 1-1):
```typescript
import { createClient } from "@supabase/supabase-js"
```

**Core pattern — new server helper:**
The existing `client.ts` uses `createClient` from `@supabase/supabase-js` with a module-scope singleton. The server helper uses `createServerClient` from `@supabase/ssr` instead, with `await cookies()` from `next/headers`. Must be `async` because `cookies()` is async in Next.js 15.

```typescript
// Copy cookie handler structure from RESEARCH.md Pattern 4
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

**Env var pattern** (client.ts lines 7-9):
```typescript
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
```
Use the same env var names — already validated by `src/env.ts`.

---

### `src/lib/supabase/middleware.ts` (utility, request-response)

**Analog:** `src/lib/supabase/client.ts`

**Core pattern:**
A thin factory that produces a `createServerClient` wired to a `NextRequest` + `NextResponse` pair. Distinct from `server.ts` because middleware cannot use `next/headers` cookies() — it must read from `request.cookies` and write to `response.cookies`.

```typescript
// This is the per-request factory (not a singleton — D-10)
import { createServerClient } from "@supabase/ssr"
import type { NextRequest, NextResponse } from "next/server"

export function createSupabaseMiddlewareClient(
  request: NextRequest,
  response: NextResponse
) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )
}
```

Note: The middleware may inline this factory instead of calling a helper, per RESEARCH.md Pattern 3. Either approach is valid; the helper avoids duplication with the callback route.

---

### `src/middleware.ts` (middleware, request-response) — REPLACE

**Analog:** `src/middleware.ts` (current — lines 1-17)

**Current file** (lines 1-17):
```typescript
import NextAuth from "next-auth"
import authConfig from "./auth.config"

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isOnHome = req.nextUrl.pathname === "/"

  if (!isLoggedIn && !isOnHome) {
    return Response.redirect(new URL("/", req.url))
  }
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
```

**Replacement pattern** — copy route-guard logic exactly, change only auth mechanism and matcher:
```typescript
import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  // CRITICAL: create client inside the function body — never at module scope (D-10)
  const response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
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
  const isOnAuthRoute = request.nextUrl.pathname.startsWith("/auth/")

  if (!user && !isOnHome && !isOnAuthRoute) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return response
}

export const config = {
  // Exclude api/auth (not just api) to let [...nextauth] route continue working (Pitfall 4)
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
}
```

---

### `src/app/auth/callback/route.ts` (route, request-response) — NEW

**Analog:** `src/app/api/auth/[...nextauth]/route.ts` (current — lines 1-3)

The existing route handler uses named export pattern:
```typescript
import { handlers } from "@/auth"
export const { GET, POST } = handlers
```

The new callback route follows the same named-export GET pattern but does real work. Key ordering constraint: create `response` before `supabase` client so cookie `setAll` has a response to write to (Pitfall 3).

**Core pattern** (from RESEARCH.md Pattern 2):
```typescript
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { db } from "@/db"
import { userGoogleTokens } from "@/db/schema/tokens"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")

  if (!code) {
    return NextResponse.redirect(new URL("/auth/error", request.url))
  }

  // CRITICAL: create response BEFORE supabase client (Pitfall 3)
  const response = NextResponse.redirect(new URL("/dashboard", request.url))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
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

  // CRITICAL: provider_refresh_token is only available HERE (SAUTH-06)
  if (!providerRefreshToken || !userEmail) {
    return NextResponse.redirect(new URL("/auth/error", request.url))
  }

  // Upsert — handles re-sign-in (D-11: admin Drizzle via DATABASE_URL)
  await db
    .insert(userGoogleTokens)
    .values({ email: userEmail, refreshToken: providerRefreshToken, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: userGoogleTokens.email,
      set: { refreshToken: providerRefreshToken, updatedAt: new Date() },
    })

  return response
}
```

**Drizzle upsert analog** — `src/actions/schedule.ts` line 175:
```typescript
await db.insert(scheduleEntries).values(insertValues).onConflictDoNothing()
```
The callback uses `.onConflictDoUpdate()` instead (same package, same import path).

---

### `src/app/auth/error/page.tsx` (component, request-response) — NEW

**Analog:** `src/app/page.tsx` (current — lines 1-18)

**Home page layout pattern** (lines 7-18):
```typescript
return (
  <main className="flex min-h-screen items-center justify-center">
    <div className="text-center space-y-6">
      <h1 className="text-4xl font-bold">Vuoroasuminen</h1>
      <p className="text-muted-foreground">Yhteinen vuoroasumisaikataulu vanhemmille</p>
      <SignInButton />
    </div>
  </main>
)
```

**Error page uses same centered layout** with Finnish copy (D-05, D-06). The CTA button triggers a new OAuth flow with `prompt:consent` — this must be a Client Component that calls `supabase.auth.signInWithOAuth`. Copy `Button` from `src/components/ui/button.tsx`.

```typescript
// src/app/auth/error/page.tsx — Finnish error page (D-05, D-06)
"use client"
import { Button } from "@/components/ui/button"
// ... signInWithOAuth with prompt:consent + access_type:offline
```

Finnish copy: "Tarvitsemme pääsyn kalenteriin. Kirjaudu sisään uudelleen ja myönnä tarvittavat oikeudet." + button "Kirjaudu sisään uudelleen"

---

### `src/db/schema/tokens.ts` (model, CRUD) — NEW

**Analog:** `src/db/schema/domain.ts` (lines 1-14) and `src/db/schema/auth.ts` (lines 1-17)

**Drizzle imports pattern** (domain.ts lines 1-1):
```typescript
import { pgTable, pgEnum, text, date, timestamp, uniqueIndex } from "drizzle-orm/pg-core"
```

**Simple table with text PK pattern** (auth.ts lines 9-17 — users table):
```typescript
export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique().notNull(),
  ...
})
```

**New tokens table — email as PK** (no UUID, per RESEARCH.md Pattern 5):
```typescript
import { pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const userGoogleTokens = pgTable("user_google_tokens", {
  email: text("email").primaryKey(),
  refreshToken: text("refresh_token").notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
})
```

**Timestamp pattern** (domain.ts lines 21-21):
```typescript
createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
```
Copy `{ mode: "date" }` option exactly.

---

### `src/db/index.ts` (config, CRUD) — PATCH

**Analog:** `src/db/index.ts` (current — lines 1-16)

**Current schema spread pattern** (lines 3-4, 11-13):
```typescript
import * as authSchema from "./schema/auth"
import * as domainSchema from "./schema/domain"

// ...
return drizzle(pool, {
  schema: { ...authSchema, ...domainSchema },
})
```

**Patch:** Add `import * as tokensSchema from "./schema/tokens"` and spread `...tokensSchema` into the schema object. Pitfall 5: without this, `db.insert(userGoogleTokens)` throws a runtime error even though TypeScript compiles.

---

### `src/components/sign-in-button.tsx` (component, event-driven) — REPLACE

**Analog:** `src/components/sign-in-button.tsx` (current — lines 1-12)

**Current pattern** (lines 1-12):
```typescript
"use client"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"

export default function SignInButton() {
  return (
    <Button size="lg" onClick={() => signIn("google", { redirectTo: "/dashboard" })}>
      Kirjaudu sisään Googlella
    </Button>
  )
}
```

**Replacement** — same `"use client"` directive, same `Button`, same Finnish label, same `size="lg"`. Only the onClick changes: `signIn("google")` → `supabase.auth.signInWithOAuth(...)`. Use `createBrowserClient` from `@supabase/ssr` (not the existing `createBrowserClient` from `src/lib/supabase/client.ts` which uses `@supabase/supabase-js` directly and is for Realtime).

```typescript
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
          "https://www.googleapis.com/auth/calendar",  // same scopes as auth.config.ts lines 9-15
        ].join(" "),
        queryParams: {
          access_type: "offline",  // same as auth.config.ts line 12
          prompt: "consent",       // same as auth.config.ts line 11 — preserved per STATE.md
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

---

### `src/components/owner-warning-banner.tsx` (component, event-driven) — NEW

**Analog:** `src/components/schedule/publish-button.tsx` (lines 1-6, 49-51)

**Client component with useState dismiss pattern** (publish-button.tsx lines 1-6, 50-52):
```typescript
"use client"

import { useState, useEffect } from "react"
// ...
export function PublishButton({ days, onPublished }: PublishButtonProps) {
  const [open, setOpen] = useState(false)
```

**Banner pattern** — `"use client"`, single `useState(false)` for dismissed, renders `null` when dismissed (D-07: no localStorage, no server persistence):
```typescript
"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"

interface OwnerWarningBannerProps {
  signInHref: string  // or onClick handler for supabase signInWithOAuth
}

export function OwnerWarningBanner({ signInHref }: OwnerWarningBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  return (
    <div className="...">
      <p>Kalenterin omistaja ei ole kirjautunut — kalenterisynkronointi ei toimi.</p>
      <a href={signInHref}>Kirjaudu sisään</a>
      <button onClick={() => setDismissed(true)}>✕</button>
    </div>
  )
}
```

Use Tailwind utility classes matching the existing project style (amber/yellow background for warning state, similar to how muted/border classes are used throughout).

---

### `src/components/layout/header.tsx` (component, request-response) — PATCH

**Analog:** `src/components/layout/header.tsx` (current — lines 1-36)

**Current auth pattern** (lines 1-9):
```typescript
import { auth } from "@/auth"
// ...
export default async function Header({ children }: { children?: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) return null
```

**Patch:** Replace `auth()` with `createSupabaseServerClient()` + `getUser()`. Change `session.user.image` to `user.user_metadata?.avatar_url` and `session.user.name` to `user.user_metadata?.full_name` (Open Question A2 — verify shape after first sign-in).

```typescript
import { createSupabaseServerClient } from "@/lib/supabase/server"
// ...
const supabase = await createSupabaseServerClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return null
// user.user_metadata?.avatar_url replaces session.user.image
// user.user_metadata?.full_name replaces session.user.name
```

Sign-out form (lines 28-30) stays the same — `signOutAction` form submission pattern is preserved.

---

### `src/actions/auth.ts` (service, request-response) — REPLACE

**Analog:** `src/actions/auth.ts` (current — lines 1-7)

**Current pattern** (lines 1-7):
```typescript
"use server"

import { signOut } from "@/auth"

export async function signOutAction() {
  await signOut()
}
```

**Replacement** — same `"use server"` directive, same function name (header.tsx calls this via form action):
```typescript
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

### `src/actions/schedule.ts` (service, CRUD) — PATCH

**Analog:** `src/actions/schedule.ts` (current — lines 1-23)

**Current auth guard pattern** (lines 6-10, 16-23):
```typescript
import { auth } from "@/auth"
// ...
async function requireAuthorizedParent() {
  const session = await auth()
  const email = session?.user?.email
  if (!email) throw new Error("Not authenticated")
  const isAuthorized = config.parents.some((p) => p.email === email)
  if (!isAuthorized) throw new Error("Forbidden")
  return { session, email }
}
```

**Patch `requireAuthorizedParent` only** — all other exports (`toggleCell`, `saveNotes`, `publishSchedule`, etc.) are unchanged:
```typescript
import { createSupabaseServerClient } from "@/lib/supabase/server"
// ...
async function requireAuthorizedParent() {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user?.email) throw new Error("Not authenticated")
  const isAuthorized = config.parents.some((p) => p.email === user.email)
  if (!isAuthorized) throw new Error("Forbidden")
  return { user, email: user.email }
}
```

Remove `import { auth } from "@/auth"` from imports (line 6). Add `import { createSupabaseServerClient } from "@/lib/supabase/server"`.

---

### `src/app/dashboard/page.tsx` (component, CRUD) — PATCH

**Analog:** `src/app/dashboard/page.tsx` (current — lines 1-36)

**Current Server Component pattern** (lines 1-5, 14-36):
```typescript
import { parseISO, isValid, startOfWeek, format } from "date-fns"
import { getScheduleWindow, getScheduleEndDate } from "@/lib/schedule/queries"
import { DashboardShell } from "@/components/schedule/dashboard-shell"
import Header from "@/components/layout/header"

// ...
export default async function Dashboard({ searchParams }: ...) {
  const { viewStart } = await searchParams
  // ...
  const [schedule, scheduleEndDate] = await Promise.all([...])

  return (
    <DashboardShell
      key={validatedStart ?? "default"}
      initialData={schedule}
      ...
      header={<Header />}
    />
  )
}
```

**Patch:** Add token check query before the return. Extend `Promise.all` to include the `user_google_tokens` lookup. Pass `showOwnerWarning` to `DashboardShell`.

```typescript
// Add imports:
import { db } from "@/db"
import { userGoogleTokens } from "@/db/schema/tokens"
import { eq } from "drizzle-orm"
import config from "@/config/app"

// In Dashboard function body, alongside existing Promise.all:
const ownerEmail = config.parents[0].ownerEmail
const [schedule, scheduleEndDate, tokenRow] = await Promise.all([
  getScheduleWindow(validatedStart),
  getScheduleEndDate(),
  db.select({ email: userGoogleTokens.email })
    .from(userGoogleTokens)
    .where(eq(userGoogleTokens.email, ownerEmail))
    .limit(1)
    .then(rows => rows[0]),
])
const showOwnerWarning = !tokenRow
```

`DashboardShell` interface gains `showOwnerWarning?: boolean` prop.

**Drizzle select analog** (schedule.ts lines 33-38):
```typescript
await db.select({ ... })
  .from(table)
  .where(eq(table.col, value))
  .limit(1)
```

---

### `src/config/app.ts` (config) — PATCH

**Analog:** `src/config/app.ts` (current — lines 1-35)

**Current interface** (lines 1-13):
```typescript
export interface AppConfig {
  parents: Array<{
    id: ParentId
    name: string
    email: string       // Google account email
    calendarId: string  // Target Google Calendar ID
  }>
  children: string[]
  startDate: string
  firstParent: ParentId
}
```

**Patch:** Add `ownerEmail: string` to the parent entry shape. In the config object, set `ownerEmail` via `process.env.CALENDAR_OWNER_EMAIL!` or hardcode same value as `email` for single-owner setup (D-01, D-02).

```typescript
export interface AppConfig {
  parents: Array<{
    id: ParentId
    name: string
    email: string
    calendarId: string
    ownerEmail: string  // NEW: email of user whose token is used for GCal sync (D-01)
  }>
  // ...
}
```

---

### `src/lib/gcal/client.ts` (service, request-response) — REPLACE

**Analog:** `src/lib/gcal/client.ts` (current — lines 1-76)

**Current imports** (lines 1-7):
```typescript
import { google } from "googleapis"
import type { calendar_v3 } from "googleapis"
import { db } from "@/db"
import { accounts } from "@/db/schema/auth"
import { users } from "@/db/schema/auth"
import { eq, and } from "drizzle-orm"
```

**Current DB lookup pattern** (lines 23-33):
```typescript
const [row] = await db
  .select({ refresh_token: accounts.refresh_token })
  .from(accounts)
  .innerJoin(users, eq(accounts.userId, users.id))
  .where(and(eq(users.email, parentEmail), eq(accounts.provider, "google")))
  .limit(1)
```

**Current token exchange pattern** (lines 40-74) — KEEP EXACTLY — only the lookup changes:
```typescript
const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    client_id: process.env.AUTH_GOOGLE_ID!,
    client_secret: process.env.AUTH_GOOGLE_SECRET!,
    grant_type: "refresh_token",
    refresh_token: row.refresh_token,
  }),
})
// ... error handling, oauth2Client.setCredentials, return google.calendar(...)
```

**Replacement imports and lookup** (reading `user_google_tokens` instead of `accounts` join):
```typescript
import { google } from "googleapis"
import type { calendar_v3 } from "googleapis"
import { db } from "@/db"
import { userGoogleTokens } from "@/db/schema/tokens"
import { eq } from "drizzle-orm"

export async function buildGCalClient(ownerEmail: string): Promise<calendar_v3.Calendar> {
  const [row] = await db
    .select({ refreshToken: userGoogleTokens.refreshToken })
    .from(userGoogleTokens)
    .where(eq(userGoogleTokens.email, ownerEmail))
    .limit(1)

  if (!row?.refreshToken) {
    throw new Error(`No refresh token found for ${ownerEmail}. Calendar owner must sign in.`)
  }
  // Token exchange block identical to current lines 40-74, only ref changes:
  // row.refresh_token → row.refreshToken (camelCase column alias from schema)
```

---

### `src/lib/gcal/sync.ts` (service, CRUD) — PATCH

**Analog:** `src/lib/gcal/sync.ts` (current — line 160)

**Current call site** (line 160):
```typescript
const calendar = await buildGCalClient(parent.email)
```

**Patch:** Change one line — `parent.email` → `parent.ownerEmail`:
```typescript
const calendar = await buildGCalClient(parent.ownerEmail)
```

No other changes needed in `sync.ts`.

---

### `src/env.ts` (config) — PATCH

**Analog:** `src/env.ts` (current — lines 1-18)

**Current required vars** (lines 5-12):
```typescript
const REQUIRED_ENV_VARS = [
  "AUTH_GOOGLE_ID",
  "AUTH_GOOGLE_SECRET",
  "AUTH_SECRET",
  "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const
```

**Patch:** Per RESEARCH.md Runtime State Inventory, `SUPABASE_SERVICE_ROLE_KEY` is NOT needed in Phase 8 (Drizzle uses `DATABASE_URL` directly). No change required to this file unless the team adds the service role key proactively for Phase 9 readiness. If added:
```typescript
"SUPABASE_SERVICE_ROLE_KEY",  // Phase 9: needed for RLS bypass via supabase-js admin client
```

---

### `src/app/page.tsx` (component, request-response) — PATCH

**Analog:** `src/app/page.tsx` (current — lines 1-18)

**Current auth check** (lines 1-7):
```typescript
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import SignInButton from "@/components/sign-in-button"

export default async function Home() {
  const session = await auth()
  if (session?.user) redirect("/dashboard")
```

**Patch:** Replace `auth()` with Supabase `getUser()`:
```typescript
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import SignInButton from "@/components/sign-in-button"

export default async function Home() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect("/dashboard")
  // JSX identical to current lines 9-18
```

---

## Shared Patterns

### Supabase Server Client Usage
**Source:** `src/lib/supabase/server.ts` (new file — all server-side auth)
**Apply to:** `src/middleware.ts`, `src/actions/auth.ts`, `src/actions/schedule.ts`, `src/components/layout/header.tsx`, `src/app/page.tsx`, `src/app/dashboard/page.tsx`, `src/app/auth/callback/route.ts`

```typescript
// Every server-side auth check follows this pattern:
const supabase = await createSupabaseServerClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) redirect("/") // or throw new Error("Not authenticated")
```

### Drizzle Admin Query (no RLS bypass needed in Phase 8)
**Source:** `src/db/index.ts` — `db` export via `DATABASE_URL` direct Postgres connection
**Apply to:** `src/app/auth/callback/route.ts`, `src/lib/gcal/client.ts`, `src/app/dashboard/page.tsx`

```typescript
import { db } from "@/db"
// Direct Postgres connection — bypasses Supabase Auth context entirely (D-11)
```

### Finnish UI Copy
**Source:** `src/components/sign-in-button.tsx` line 9, `src/actions/schedule.ts` error messages
**Apply to:** `src/app/auth/error/page.tsx`, `src/components/owner-warning-banner.tsx`

All user-visible strings in Finnish. Error page and banner copy specified verbatim in CONTEXT.md decisions D-05, D-06, D-08.

### "use server" Server Action Pattern
**Source:** `src/actions/auth.ts` (lines 1-1) and `src/actions/schedule.ts` (lines 1-1)
**Apply to:** `src/actions/auth.ts` (replacement)

```typescript
"use server"
// All Server Actions start with this directive
```

### "use client" Client Component Pattern
**Source:** `src/components/sign-in-button.tsx` (line 1), `src/components/schedule/publish-button.tsx` (line 1)
**Apply to:** `src/components/sign-in-button.tsx`, `src/components/owner-warning-banner.tsx`, `src/app/auth/error/page.tsx`

```typescript
"use client"
// All client components start with this directive
```

### Drizzle onConflictDoUpdate (upsert)
**Source:** `src/actions/schedule.ts` line 175 (uses `onConflictDoNothing` — same API surface)
**Apply to:** `src/app/auth/callback/route.ts`

```typescript
await db.insert(table).values(values).onConflictDoUpdate({
  target: table.uniqueColumn,
  set: { ...updatedValues },
})
```

---

## No Analog Found

All files have clear analogs. No files require falling back to RESEARCH.md-only patterns; however, these files are **pure new content** with no existing analog to copy from in the codebase:

| File | Role | Data Flow | Note |
|------|------|-----------|------|
| `src/components/owner-warning-banner.tsx` | component | event-driven | Closest analog is `publish-button.tsx` for useState dismiss; no existing banner/alert UI component |
| `src/app/auth/error/page.tsx` | component | request-response | Closest analog is `app/page.tsx` for centered layout; the re-auth button behavior is new |

For both of these, use the RESEARCH.md patterns (Patterns 8, D-06 copy text) combined with the `Button` component from `src/components/ui/button.tsx`.

---

## Metadata

**Analog search scope:** `src/` (all TypeScript files)
**Files scanned:** 47
**Pattern extraction date:** 2026-05-09
