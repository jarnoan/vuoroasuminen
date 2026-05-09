# Supabase Auth in Next.js 15 App Router — Migration Research

**Domain:** Auth migration — Auth.js v5 → Supabase Auth  
**Researched:** 2026-05-09  
**Scope:** Google OAuth, session management, provider token access, middleware, Server Action guards  
**Overall confidence:** HIGH — patterns verified against official Supabase docs and Context7 source

---

## 1. Sign-In / Sign-Out Flow with Google OAuth

### Flow: PKCE (required for SSR)

`@supabase/ssr` configures all server clients with `flowType: 'pkce'` by default. Implicit flow is only for browser-only SPAs. For Next.js App Router, always use PKCE.

**Sign-in — Server Action (recommended)**

The sign-in action calls `signInWithOAuth` on a server client. Because `signInWithOAuth` returns a redirect URL (it never touches `window.location` on the server), the action reads the URL from the response and redirects via Next.js `redirect()`.

```typescript
// src/actions/auth.ts
"use server"

import { createClient } from "@/lib/supabase/server"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

export async function signInWithGoogle() {
  const supabase = await createClient()
  const origin = (await headers()).get("origin")

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
      queryParams: {
        access_type: "offline",   // requests refresh_token
        prompt: "consent",        // forces re-consent so Google re-issues refresh_token
      },
      scopes: [
        "openid",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/calendar",
      ].join(" "),
    },
  })

  if (error) throw error
  redirect(data.url!)
}
```

**Sign-out — Server Action**

```typescript
// src/actions/auth.ts (continued)
export async function signOutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/")
}
```

**OAuth callback — Route Handler**

After Google redirects back, Supabase sends the browser to your callback URL with a `?code=` query parameter. The callback route exchanges the code for a session. This is also where `provider_token` and `provider_refresh_token` are available (see section 3).

```typescript
// src/app/auth/callback/route.ts
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/dashboard"

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.session) {
      // data.session.provider_token        — Google access_token (short-lived)
      // data.session.provider_refresh_token — Google refresh_token (long-lived)
      // Persist to user_google_tokens here (see section 3)

      const forwardedHost = request.headers.get("x-forwarded-host")
      if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}
```

**Callback URL to register in Google Cloud Console:**  
`https://<your-supabase-project-ref>.supabase.co/auth/v1/callback`  
(NOT your Next.js app URL — Supabase handles the first leg of the OAuth redirect)

**Redirect URL to allowlist in Supabase Dashboard → Authentication → URL Configuration:**  
`https://yourdomain.com/auth/callback`  
Add a wildcard for preview deployments: `https://*.vercel.app/auth/callback`

---

## 2. Creating Supabase Clients in App Router

Four distinct contexts, each needs its own client construction.

### 2a. Reusable server utility (`src/lib/supabase/server.ts`)

Used in Server Components, Server Actions, and Route Handlers. Reads and writes cookies via the Next.js `cookies()` store.

```typescript
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from a Server Component — cookies cannot be set.
            // This is safe to ignore: middleware handles the cookie write on
            // the next request.
          }
        },
      },
    }
  )
}
```

### 2b. Browser client utility (`src/lib/supabase/client.ts`)

Used in Client Components for Realtime subscriptions. Migrate from the current bare `createClient` (from `@supabase/supabase-js`) to `createBrowserClient` (from `@supabase/ssr`).

```typescript
import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

`createBrowserClient` uses an internal singleton — no need for the manual singleton the current `src/lib/supabase/client.ts` implements.

The existing Realtime subscription code in `realtime-provider.tsx` continues to work after this swap; the `channel()` / `postgres_changes` API is unchanged.

### 2c. Middleware client (inline in `src/middleware.ts`)

The middleware client is created inline — not from the shared utility — because it must write cookies to both `request.cookies` and `supabaseResponse.cookies`. See section 4.

### 2d. Service-role client (for RLS bypass in admin scripts only)

Use `createClient` from `@supabase/supabase-js` directly with `SUPABASE_SERVICE_ROLE_KEY`. Never expose the service role key to the browser or pass it to `createServerClient`.

---

## 3. Accessing Google Provider Tokens Server-Side

### The critical constraint

**Supabase does not store provider tokens.** The `auth.users` table in Supabase stores the Supabase session (Supabase access + refresh tokens), but Google's `access_token` and `refresh_token` are not persisted anywhere by Supabase. This is by design — Supabase treats provider tokens as the app's concern.

### Where provider tokens appear

Provider tokens are available **only at the moment of the OAuth callback**, in the session returned by `exchangeCodeForSession`:

```typescript
const { data, error } = await supabase.auth.exchangeCodeForSession(code)
// data.session.provider_token          — Google access_token (short-lived, ~1 hour)
// data.session.provider_refresh_token  — Google refresh_token (long-lived)
// data.session.user.email              — user's email
// data.session.user.id                 — Supabase user UUID
```

They are **not** available later via `getUser()`, `getClaims()`, or `getSession()` on the server — those return only Supabase session data.

### Required: persist tokens in `user_google_tokens` table

The v1.2 milestone plan already specifies a custom `user_google_tokens` table. Persist immediately in the callback route:

```typescript
// Inside the callback route handler, after successful exchangeCodeForSession:
const { provider_token, provider_refresh_token, user } = data.session

if (provider_refresh_token) {
  // Upsert: re-sign-in updates the stored tokens
  await supabase.from("user_google_tokens").upsert(
    {
      user_id: user.id,
      email: user.email,
      google_access_token: provider_token,
      google_refresh_token: provider_refresh_token,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  )
}
```

**Why upsert on every sign-in, not just first sign-in:** With `prompt=consent` on every sign-in (required to avoid `invalid_grant`), Google re-issues the refresh token each time. Upsert ensures the stored token is always current.

### GCal client migration

The current `buildGCalClient` in `src/lib/gcal/client.ts` reads from the Drizzle `accounts` table (Auth.js schema). After migration, it reads from `user_google_tokens` via the Supabase server client:

```typescript
// src/lib/gcal/client.ts (post-migration sketch)
export async function buildGCalClient(ownerEmail: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("user_google_tokens")
    .select("google_refresh_token")
    .eq("email", ownerEmail)
    .single()

  if (error || !data?.google_refresh_token) {
    throw new Error("Calendar authentication required. Please sign in again.")
  }
  // Token exchange logic stays identical to current implementation
  // (manual POST to https://oauth2.googleapis.com/token)
}
```

### Access token freshness

The stored `google_access_token` expires in ~1 hour. The current pattern in `buildGCalClient` — exchange the refresh token on every GCal API call — is correct and should be preserved. Do NOT rely on the stored `google_access_token` for API calls; always exchange the `google_refresh_token` for a fresh one at call time.

---

## 4. Middleware Pattern for Session Refresh

The middleware must:

1. Create a Supabase client that writes cookies to both `request.cookies` (so Server Components see the refreshed session) AND `supabaseResponse.cookies` (so the browser receives updated cookies).
2. Call `supabase.auth.getUser()` to trigger Supabase token refresh if the session is close to expiry.
3. Protect routes by redirecting unauthenticated users.
4. Return `supabaseResponse` — never create a new `NextResponse` after the client is set up or cookies will be lost.

```typescript
// src/middleware.ts
import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Write to request so downstream Server Components see fresh cookies
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          // Recreate response with updated request cookies
          supabaseResponse = NextResponse.next({ request })
          // Write to response so browser receives updated cookies
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Do not add any code between createServerClient and getUser().
  // Even an innocent await can cause sessions to desync and users to be
  // randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isOnHome = request.nextUrl.pathname === "/"
  const isOnAuthRoutes = request.nextUrl.pathname.startsWith("/auth")

  if (!user && !isOnHome && !isOnAuthRoutes) {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    return NextResponse.redirect(url)
  }

  // IMPORTANT: always return supabaseResponse, not a freshly created response.
  // If you must create a new response, copy cookies:
  //   myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  return supabaseResponse
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
```

### `getUser()` vs `getClaims()` in middleware

| Method | What it does | When to use |
|--------|-------------|-------------|
| `getUser()` | Network request to Supabase Auth server; revalidates session is still valid | Route protection — definitive, can't be spoofed |
| `getClaims()` | Local JWT validation against cached JWKS public keys | Only valid when asymmetric signing (ECC/RSA) is configured; faster but doesn't check server-side revocation |
| `getSession()` | Reads cookie without any validation | Never for authorization — spoof-able |

Use `getUser()` in middleware for this app. The one extra network call per request is acceptable for a two-user app. `getClaims()` is an optimization for high-traffic scenarios.

---

## 5. Protecting Routes and Server Actions

### In Server Components (equivalent to `auth()` from Auth.js)

```typescript
// src/app/dashboard/page.tsx
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/")

  // user.id  — Supabase UUID
  // user.email — verified email (matches parentEmail in app.ts config)
  return <Dashboard user={user} />
}
```

The middleware already redirects unauthenticated users before they reach the Server Component. The `getUser()` check in the component is defence-in-depth — Supabase docs explicitly recommend it for any page that uses user identity for data access decisions.

### In Server Actions (equivalent to `auth()` guard in current `actions/schedule.ts`)

```typescript
"use server"

import { createClient } from "@/lib/supabase/server"

export async function someScheduleAction(input: unknown) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Error("Unauthorized")
  }

  const parentEmail = user.email!
  // ... proceed
}
```

**Reusable auth guard helper (reduces boilerplate across all actions):**

```typescript
// src/lib/auth-guard.ts
import { createClient } from "@/lib/supabase/server"
import type { User } from "@supabase/supabase-js"

export async function requireUser(): Promise<User> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error("Unauthorized")
  return user
}
```

Usage:

```typescript
import { requireUser } from "@/lib/auth-guard"

export async function publishDraft() {
  const user = await requireUser()
  // user.email available for parentEmail lookup
}
```

### Never use `getSession()` for authorization

`getSession()` reads from the cookie without server validation — it can be spoofed. Use `getUser()` for every authorization check. `getSession()` is appropriate only if you need to read the raw Supabase `access_token` to pass somewhere.

---

## 6. Migration Delta: Auth.js → Supabase Auth

| Concern | Auth.js v5 pattern | Supabase Auth pattern |
|---------|-------------------|----------------------|
| Session read in Server Component | `auth()` from `@/auth` | `createClient()` then `supabase.auth.getUser()` |
| Session read in Server Action | `auth()` from `@/auth` | `createClient()` then `supabase.auth.getUser()` |
| Session read in middleware | `auth(req => ...)` wrapping | `createServerClient` + `getUser()` inline |
| OAuth redirect initiation | Auth.js handles automatically | Manual: Server Action calls `signInWithOAuth`, redirects to `data.url` |
| OAuth callback | Auto-handled at `/api/auth/callback/google` | Manual Route Handler at `/auth/callback` |
| Provider token storage | DrizzleAdapter writes to `accounts` table automatically | Manual upsert to `user_google_tokens` in callback Route Handler |
| Provider token retrieval for GCal | Query Drizzle `accounts` table | Query Supabase `user_google_tokens` table |
| Sign-out | `signOut()` from `@/auth` | `supabase.auth.signOut()` in Server Action |
| Middleware auth guard | `!!req.auth` | `!!user` from `supabase.auth.getUser()` |
| User identity key | `session.user.email` | `user.email` |
| Supabase session refresh token rotation | Manual in `jwt` callback | Handled automatically by Supabase Auth |
| Token refresh trigger in middleware | Not needed (JWT is stateless) | Required: `getUser()` triggers refresh |
| Browser Supabase client | `createClient` from `@supabase/supabase-js` | `createBrowserClient` from `@supabase/ssr` |

---

## 7. Environment Variables

```bash
# Already present — keep as-is
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>

# Remove after migration (Auth.js specific)
# AUTH_SECRET=...
# DATABASE_URL=...  (if Drizzle + Postgres connection removed)

# Keep — still needed for manual GCal token exchange in gcal/client.ts
# (can rename from AUTH_GOOGLE_ID/SECRET to GOOGLE_CLIENT_ID/SECRET)
AUTH_GOOGLE_ID=<google-client-id>
AUTH_GOOGLE_SECRET=<google-client-secret>
```

**Google OAuth credentials go into Supabase Dashboard, not Next.js env vars.**  
Supabase Dashboard → Authentication → Providers → Google → enter Client ID and Secret.  
The `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` in Next.js are only needed for the manual token exchange (`oauth2.googleapis.com/token` POST) in `gcal/client.ts`.

---

## 8. Supabase Dashboard Configuration Checklist

- [ ] Authentication → Providers → Google: enter Client ID and Secret from Google Cloud Console
- [ ] Authentication → URL Configuration → Site URL: `https://yourdomain.com`
- [ ] Authentication → URL Configuration → Redirect URLs: add `https://yourdomain.com/auth/callback`
- [ ] (Local dev) Redirect URLs: add `http://localhost:3000/auth/callback`
- [ ] Google Cloud Console → Authorized redirect URIs: `https://<ref>.supabase.co/auth/v1/callback`
- [ ] Google Cloud Console → Authorized JavaScript origins: `https://yourdomain.com`

---

## 9. RLS Implication

Once Supabase Auth is in place, every `createServerClient` (anon key) call inherits the user's JWT, which Supabase uses to enforce Row Level Security policies. Policies on domain tables (e.g., `schedule_cells`) can reference `auth.uid()` directly. The `user_google_tokens` table should have an RLS policy so users can only read their own row.

---

## Sources

- Supabase SSR — Context7 (HIGH confidence): `createServerClient`, middleware `setAll`/`getAll` pattern, `createBrowserClient` singleton  
  https://github.com/supabase/ssr
- Supabase JS — Context7 (HIGH confidence): `signInWithOAuth`, `getUser`, `getSession`, `getClaims`, `signOut`, `exchangeCodeForSession`  
  https://context7.com/supabase/supabase-js/llms.txt
- Supabase Docs — Google OAuth provider (HIGH confidence): PKCE flow, callback setup, `provider_token`, `access_type`/`prompt` params  
  https://supabase.com/docs/guides/auth/social-login/auth-google
- Supabase Docs — Setting up Server-Side Auth for Next.js (HIGH confidence)  
  https://supabase.com/docs/guides/auth/server-side/nextjs
- Supabase Docs — `getClaims` reference (HIGH confidence): `getClaims` vs `getUser` distinction  
  https://supabase.com/docs/reference/javascript/auth-getclaims
- Supabase Discussion #22578 — provider_token storage (MEDIUM confidence): confirmed tokens not stored by Supabase  
  https://github.com/orgs/supabase/discussions/22578
- Supabase Discussion #22653 — `provider_refresh_token` in callback (MEDIUM confidence): `exchangeCodeForSession` returns provider tokens  
  https://github.com/orgs/supabase/discussions/22653
