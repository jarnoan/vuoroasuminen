---
phase: 13-invite-access-gate
plan: P04
type: execute
wave: 2
depends_on:
  - P01
files_modified:
  - src/proxy.ts
autonomous: true
requirements:
  - ONBR-07

must_haves:
  truths:
    - "Unauthenticated requests to protected routes redirect to /"
    - "Authenticated users with no family_config row redirect to /setup"
    - "Authenticated users whose email matches neither parent1_email nor parent2_email are signed out and redirected to /auth/error?error=unauthorized_email"
    - "Authenticated users whose email matches parent1_email or parent2_email pass through"
    - "The routes /setup, /auth/*, /invite/*, and / are not subject to the onboarding check"
    - "The Drizzle connection for family_config reads is created inside the middleware function body — never at module scope"
  artifacts:
    - path: "src/proxy.ts"
      provides: "Three-tier middleware gate per D-11"
      contains: "family_config"
  key_links:
    - from: "src/proxy.ts"
      to: "family_config DB table"
      via: "Drizzle db.select().from(familyConfig).limit(1) inside proxy() function body"
      pattern: "familyConfig"
    - from: "src/proxy.ts"
      to: "/auth/error?error=unauthorized_email"
      via: "NextResponse.redirect on unrecognized email"
      pattern: "unauthorized_email"
---

<objective>
Extend the proxy.ts middleware with a three-tier onboarding gate enforcing: (1) authentication, (2) onboarding completeness, and (3) email membership in family_config.

Purpose: Currently proxy.ts only checks authentication. Phase 13 adds the full gate from D-11 so that users who are signed in but have not completed setup are redirected to /setup, and users who are signed in with an unrecognized email are signed out and shown a Finnish error page.

Output:
- src/proxy.ts — extended with onboarding check (three-tier: auth → family_config → email match)
</objective>

<execution_context>
@/Users/jarno/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jarno/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/jarno/src/vuoroasuminen/.planning/PROJECT.md
@/Users/jarno/src/vuoroasuminen/.planning/phases/13-invite-access-gate/13-CONTEXT.md
@/Users/jarno/src/vuoroasuminen/.planning/phases/08-supabase-auth-stack/08-CONTEXT.md

<interfaces>
<!-- Key contracts for P04 executor. -->

Current src/proxy.ts (full file — read it):
```typescript
// Module exports: proxy() function and config.matcher
// Currently: auth check only — not signed in + not on home/auth → redirect to /
// Supabase client created inside proxy() body (D-10 compliant)
// getUser() used (not getSession()) — D-09 compliant
```

From src/db/schema/domain.ts (familyConfig table):
```typescript
export const familyConfig = pgTable("family_config", {
  id: integer("id").primaryKey().default(1),
  parent1Email: text("parent1_email").notNull(),
  parent2Email: text("parent2_email").notNull(),
  // ... other columns
})
```

From src/db/index.ts:
```typescript
export const db = createDb()
// Uses DATABASE_URL (service_role connection string)
// CRITICAL (D-13): `db` is a module-scope export but the Pool is created once
// at startup — this is acceptable. However, do NOT create a new db/Pool
// inside proxy() — reuse the exported `db`. What must NOT be module-scoped
// is the Supabase client (which carries per-user session state).
// The Drizzle `db` carries no session state — it is safe to reuse.
```

D-09 (Phase 8): getUser() validates JWT server-side — MUST use, not getSession()
D-10 (Phase 8): Supabase client must NOT be initialized at module scope in middleware
D-13 (Phase 13): family_config reads use service_role Drizzle connection — reads happen inside proxy() function body (not module scope)

Protected routes = everything except:
- "/" (home/sign-in page)
- "/auth/*" (OAuth callback, error page)
- "/invite/*" (invite acceptance — unauthenticated users need this)
- "/setup" (wizard — authenticated but no family_config)
- Static assets (already excluded by config.matcher)
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extend proxy.ts with three-tier onboarding gate</name>
  <files>src/proxy.ts</files>
  <read_first>
    - src/proxy.ts — current file (understand existing auth check, response construction, matcher)
    - src/db/schema/domain.ts — familyConfig table definition (parent1Email, parent2Email columns)
    - src/db/index.ts — db export and how createDb() works
    - .planning/phases/13-invite-access-gate/13-CONTEXT.md §D-11, D-12, D-13
    - .planning/phases/08-supabase-auth-stack/08-CONTEXT.md §D-09, D-10
  </read_first>
  <action>
Rewrite src/proxy.ts to implement the three-tier gate from D-11.

**CRITICAL constraints (must appear as comments in the file):**
- D-09: Always use `supabase.auth.getUser()` — not `getSession()`
- D-10: Create Supabase client INSIDE proxy() body — not at module scope
- D-13: family_config reads use the Drizzle `db` (service_role) — NOT a Supabase anon client

**New proxy.ts:**

```typescript
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createSupabaseMiddlewareClient } from "@/lib/supabase/middleware"
import { db } from "@/db"
import { familyConfig } from "@/db/schema/domain"
import { eq } from "drizzle-orm"

export async function proxy(request: NextRequest) {
  // CRITICAL (D-10): create the response and Supabase client INSIDE the handler.
  // Module-scope clients leak sessions between users on Vercel warm instances.
  const response = NextResponse.next()
  const supabase = createSupabaseMiddlewareClient(request, response)

  // CRITICAL (D-09): getUser() validates the JWT server-side. getSession() trusts
  // a spoofable cookie and MUST NOT be used for route protection.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Routes exempt from onboarding check:
  // - "/" — home / sign-in page
  // - "/auth/*" — OAuth callback, error page
  // - "/invite/*" — invite acceptance (unauthenticated users must reach this)
  // - "/setup" — onboarding wizard (no family_config row yet)
  const isExempt =
    pathname === "/" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/invite/") ||
    pathname === "/setup"

  // Tier 1: Not signed in → redirect to /
  if (!user && !isExempt) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  // Exempt routes bypass tiers 2 and 3
  if (isExempt) {
    return response
  }

  // Tier 2 + 3: user is signed in and route is protected
  // CRITICAL (D-13): Read family_config using service_role Drizzle connection.
  // Do NOT use supabase anon client for this read — RLS would block it.
  let configRow: { parent1Email: string; parent2Email: string } | undefined
  try {
    const [row] = await db
      .select({
        parent1Email: familyConfig.parent1Email,
        parent2Email: familyConfig.parent2Email,
      })
      .from(familyConfig)
      .where(eq(familyConfig.id, 1))
      .limit(1)
    configRow = row
  } catch (err) {
    console.error("[proxy] family_config read failed:", err)
    // DB error — allow through to avoid a boot-time lockout; dashboard handles missing config
    return response
  }

  // Tier 2: Signed in but no family_config row → redirect to /setup (wizard not completed)
  if (!configRow) {
    return NextResponse.redirect(new URL("/setup", request.url))
  }

  // Tier 3: Signed in, family_config exists, but email not in parent list
  const userEmail = user.email
  const isRecognized =
    userEmail === configRow.parent1Email ||
    userEmail === configRow.parent2Email

  if (!isRecognized) {
    // Sign out the session before redirecting — prevents a redirect loop where
    // the user refreshes /auth/error and is passed through to a protected route
    // on a warmed Supabase session.
    // signOut() via the server client writes cookie-clearing headers into `response`.
    // We must build a fresh redirect response AFTER signOut so the cookie-clearing
    // headers and the Location header are both on the same response object.
    const errorRedirect = NextResponse.redirect(
      new URL("/auth/error?error=unauthorized_email", request.url),
    )
    // Copy Supabase session-clearing cookies from the middleware response to the redirect
    response.cookies.getAll().forEach(({ name, value, ...options }) => {
      errorRedirect.cookies.set(name, value, options)
    })
    await supabase.auth.signOut()
    // Re-copy cookies after signOut (signOut writes to the response object passed in)
    response.cookies.getAll().forEach(({ name, value, ...options }) => {
      errorRedirect.cookies.set(name, value, options)
    })
    return errorRedirect
  }

  // Tier 4: All checks pass — allow through
  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
```

**Note on signOut in middleware:** `supabase.auth.signOut()` in the middleware context writes session-clearing cookies to the shared `response` object (passed to createSupabaseMiddlewareClient). To ensure those cookie-clearing headers are forwarded to the browser on the redirect, copy all cookies from the middleware response to the errorRedirect response. This is the standard @supabase/ssr pattern for sign-out in middleware.

**Note on DB error handling:** If the DB read fails (e.g., cold start, connection timeout), the middleware allows the request through rather than locking everyone out. The dashboard's own `getAppConfig()` call will throw and redirect to /setup if config is missing — the middleware is a belt, not a suspender. In production, DB errors are transient; a hard lockout would be worse.
  </action>
  <verify>
    <automated>cd /Users/jarno/src/vuoroasuminen && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <acceptance_criteria>
    - src/proxy.ts imports `db` from "@/db"
    - File imports `familyConfig` from "@/db/schema/domain"
    - File imports `eq` from "drizzle-orm"
    - File contains `pathname.startsWith("/invite/")` in the exempt check
    - File contains `pathname === "/setup"` in the exempt check
    - File contains `family_config` DB query inside proxy() function body (not at module scope)
    - File contains `.select({ parent1Email: familyConfig.parent1Email, parent2Email: familyConfig.parent2Email })`
    - File contains `unauthorized_email` in the redirect URL
    - File contains `supabase.auth.signOut()` call for unrecognized email case
    - File contains the D-09 comment referencing getUser()
    - File contains the D-10 comment referencing module-scope client leak risk
    - File contains the D-13 comment referencing service_role Drizzle connection
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>Three-tier gate: unauthenticated → /, no config → /setup, unrecognized email → /auth/error?error=unauthorized_email + signOut; authorized users pass through; TypeScript compiles clean</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → all protected routes | Every request passes through proxy(); JWT validated server-side |
| Middleware → DB | family_config read uses service_role Drizzle (bypasses RLS — intentional, middleware has no user context) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-13-P04-01 | Spoofing | JWT validation in middleware | mitigate | getUser() validates JWT against Supabase server — cannot be bypassed with a crafted cookie (D-09) |
| T-13-P04-02 | Tampering | Module-scope Supabase client | mitigate | Client created inside proxy() body per D-10 — no warm-instance session leakage between users |
| T-13-P04-03 | Elevation of Privilege | Unrecognized email access | mitigate | Three-tier check: email must match parent1Email or parent2Email in DB — third-party Google accounts rejected and signed out |
| T-13-P04-04 | Elevation of Privilege | /invite/* bypass | accept | Invite routes are intentionally exempt so Parent B can reach the invite page unauthenticated; token validation happens inside the route handler (P01) and again in auth/callback (P03) |
| T-13-P04-05 | Denial of Service | DB read on every request | accept | Two-user app; family_config is a single-row table; read latency is ~2-5ms on Supabase; no caching needed at this scale |
| T-13-P04-06 | Denial of Service | DB error allows through | accept | On DB error, middleware allows the request through rather than locking everyone out; dashboard's own guard handles missing config — transient DB errors should not hard-lock the app |
| T-13-P04-07 | Repudiation | Middleware sign-out | accept | signOut() invalidates Supabase session; there is no persistent log of middleware-triggered sign-outs at this scale (acceptable for a two-user app) |
</threat_model>

<verification>
After task complete:

1. `npx tsc --noEmit` — zero TypeScript errors
2. Visit `/dashboard` while signed out → redirect to `/`
3. Visit `/invite/some-token` while signed out → no redirect (exempt route, reach invite page)
4. Visit `/setup` while signed out → no redirect to /setup (exempt); dashboard path still redirects
5. Sign in as a recognized parent → `/dashboard` loads normally
6. Simulate unrecognized email: temporarily rename an email in DB, visit `/dashboard` → redirect to `/auth/error?error=unauthorized_email`
7. After wizard completes and family_config row exists: visiting `/dashboard` as a recognized parent passes tier 2 and 3 checks
</verification>

<success_criteria>
- Unauthenticated requests to /dashboard, /setup/step, and other protected routes redirect to /
- Authenticated user with no family_config row redirects to /setup
- Authenticated user with email not in family_config redirects to /auth/error?error=unauthorized_email and session is signed out
- Authenticated user with recognized email passes through to requested route
- /invite/[token], /auth/*, /setup, and / routes are exempt from the onboarding check
- TypeScript compiles clean
</success_criteria>

<output>
After completion, create .planning/phases/13-invite-access-gate/13-P04-SUMMARY.md
</output>
