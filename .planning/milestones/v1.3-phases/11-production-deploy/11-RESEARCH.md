# Phase 11: Production Deploy - Research

**Researched:** 2026-05-16
**Domain:** Vercel deployment, Next.js 16 middleware→proxy migration, Google OAuth configuration, Supabase Auth production setup
**Confidence:** HIGH

## Summary

Phase 11 deploys the app to Vercel, fixes the build script's exit-code logic, migrates `src/middleware.ts` to `src/proxy.ts` (which is a real and required Next.js 16 change — not a misunderstanding), configures Google Cloud Console and Supabase for the production domain, and sets all required env vars in Vercel.

The most critical finding: **DPLY-05 is a real requirement**. Next.js 16 deprecated `middleware.ts` in favor of `proxy.ts`. The project is already on `next@16.2.2`. The `middleware` filename still works at runtime (deprecated, not removed) but produces deprecation warnings and may be removed in a future version. The rename also changes the exported function name from `middleware` to `proxy`. A codemod exists to automate this.

The second critical finding for DPLY-04: `dotenv` is not a direct dependency in `package.json` — it is only transitive (via `shadcn` → `@dotenvx/dotenvx` → `dotenv`). To safely `require("dotenv")` in `scripts/generate-app-config.js`, `dotenv` must be added as a direct development dependency to guarantee it is always available.

**Primary recommendation:** Execute in this order — (1) add dotenv as dev dependency and fix generate-app-config.js, (2) rename middleware.ts → proxy.ts with function rename, (3) update .env.example, (4) deploy to Vercel to get production URL, (5) configure Google Cloud Console and Supabase, (6) set env vars in Vercel, (7) trigger redeploy and verify.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Remove the "skip on missing vars" logic entirely. Script ALWAYS exits 1 when any required var is missing — no conditional `VERCEL` or `CI` check.
- **D-02:** Add `require("dotenv").config({ path: path.join(__dirname, "../.env.local") })` at the top of the script (before the env checks). This makes `npm run build` work locally using `.env.local` values without requiring shell exports.
- **D-03:** The required var list in the script stays as-is: `APP_FATHER_NAME`, `APP_FATHER_EMAIL`, `APP_FATHER_CALENDAR_ID`, `APP_MOTHER_NAME`, `APP_MOTHER_EMAIL`, `APP_MOTHER_CALENDAR_ID`, `APP_CHILDREN`, `APP_START_DATE`, `APP_FIRST_PARENT`, `APP_CALENDAR_OWNER_EMAIL`. These are the Vercel env var names.
- **D-04:** The "rename middleware.ts to proxy.ts" requirement needs verification before implementing (researcher must confirm). Renaming `src/middleware.ts` to `src/proxy.ts` would break Next.js routing if it is NOT a real requirement. — **Research verdict: IT IS REAL. See findings below.**
- **D-05:** Use Vercel auto-assigned URL: `https://vuoroasuminen.vercel.app` (confirm actual URL after first deploy).
- **D-06:** Google Cloud Console: add `https://wsdrguowmcjyfrsjsywn.supabase.co/auth/v1/callback` as authorized redirect URI (Supabase's auth server, not the Next.js `/auth/callback` route).
- **D-07:** Supabase Dashboard: set Site URL to `https://vuoroasuminen.vercel.app` and add it to the redirect URL allowlist.
- **D-08:** Use `vercel env add VAR_NAME production` CLI for each required var. Values entered interactively.
- **D-09:** Update `.env.example` to document ALL required vars with comments:
  - `SUPABASE_SERVICE_ROLE_KEY` — currently missing from `.env.example`
  - `APP_CALENDAR_OWNER_EMAIL` — currently missing from `.env.example`
  - All `APP_FATHER_*` / `APP_MOTHER_*` vars — document with `APP_` prefix (what Vercel/build actually uses)
- **D-10:** Production `DATABASE_URL` uses Supabase pooler (port 6543) with `?pgbouncer=true`. Pattern: `postgresql://postgres.[ref]:[password]@aws-1-eu-north-1.pooler.supabase.com:6543/postgres?pgbouncer=true`.

### Claude's Discretion
- Exact vercel CLI commands and sequencing in the plan
- Whether to add a `vercel-env-checklist.md` or document the env var setup steps in the plan only
- Order of plan tasks (e.g., generate-app-config fix first, then deploy, then configure external services)

### Deferred Ideas (OUT OF SCOPE)
- Custom domain — use Vercel auto-assigned URL for v1.3
- Staging environment — explicitly out of scope per REQUIREMENTS.md
- Supabase Pro upgrade — operational task; tracked in STATE.md
- Google OAuth app verification — operational task; tracked in STATE.md
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DPLY-01 | User can access the app at a stable production URL (Vercel linked to repo, main branch auto-deploys) | Vercel project already linked (`.vercel/project.json` exists with projectId and projectName); `vercel env add` + redeploy triggers auto-deploy |
| DPLY-02 | Google OAuth sign-in works on the production domain (Supabase callback URL registered in Google Cloud Console) | Requires adding `https://wsdrguowmcjyfrsjsywn.supabase.co/auth/v1/callback` to Google Cloud Console authorized redirect URIs |
| DPLY-03 | Supabase Auth accepts sign-ins from the production domain (Site URL + redirect allowlist configured) | Requires setting Site URL and adding `https://vuoroasuminen.vercel.app` to Supabase Auth redirect allowlist |
| DPLY-04 | Build fails loudly when required env vars are missing (generate-app-config.js exits 1, not 0) | Current script exits 0 on missing vars (line 31: `process.exit(0)`); fix: change to `process.exit(1)` + add dotenv + update log message |
| DPLY-05 | Next.js 16 middleware compliance (middleware.ts renamed to proxy.ts) | CONFIRMED REAL — Next.js 16 deprecated `middleware.ts`, renamed to `proxy.ts`; exported function must also be renamed from `middleware` to `proxy`; official codemod available |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Auth route protection | Frontend Server (proxy.ts) | — | proxy.ts runs before routes render; validates JWT via Supabase getUser() before any page renders |
| OAuth callback handling | External (Supabase Auth server) | Next.js `/auth/callback` route | Supabase handles the OAuth code exchange; Next.js route finalizes the session |
| Build-time config generation | Build system (scripts/) | — | generate-app-config.js runs at `npm run build` before next build; writes src/config/app.ts |
| Env var storage (production) | Vercel platform | — | Vercel injects env vars at build time and runtime; not stored in git |
| Google OAuth app registration | External (Google Cloud Console) | — | Authorized redirect URIs are configured in the Google developer console; not in code |
| Supabase Auth configuration | External (Supabase Dashboard) | — | Site URL and redirect allowlist are set in Supabase dashboard settings |

## DPLY-05 Research: middleware.ts → proxy.ts

### Finding: The Rename IS Required

**Status:** VERIFIED — DPLY-05 is a real Next.js 16 requirement, not a misunderstanding.

**Source:** [VERIFIED: nextjs.org/docs/app/guides/upgrading/version-16] and [VERIFIED: nextjs.org/blog/next-16]

Next.js 16 (released October 2025) renamed the `middleware` file convention to `proxy`. Key facts:

1. **Deprecation, not yet removal:** `middleware.ts` still works in Next.js 16 but is deprecated. Build warnings appear. It will be removed in a future version.

2. **File location stays the same:** `src/proxy.ts` replaces `src/middleware.ts` — same directory, same location rules (`src/` or project root). The concern in the CONTEXT.md D-04 (that renaming to `proxy.ts` would break routing) was based on a misunderstanding — `proxy.ts` IS the new recognized filename.

3. **Function name must also change:** The exported named function must be renamed from `middleware` to `proxy`. Default exports are also supported.

4. **Runtime change:** `proxy.ts` runs on the Node.js runtime. Edge runtime is NOT supported in proxy. The existing `src/middleware.ts` in this project does NOT use edge runtime — it uses `@supabase/ssr` which requires Node.js — so the runtime change has no impact.

5. **`config` export stays identical:** The `matcher` export pattern is unchanged.

6. **Codemod available:**
   ```bash
   npx @next/codemod@canary middleware-to-proxy .
   ```

7. **`config` key rename:** `skipMiddlewareUrlNormalize` → `skipProxyUrlNormalize`. This project does not use that config option, so no change needed in `next.config.ts`.

### Current middleware.ts vs Required proxy.ts

**Current `src/middleware.ts`:**
```typescript
// Source: actual codebase
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createSupabaseMiddlewareClient } from "@/lib/supabase/middleware"

export async function middleware(request: NextRequest) { ... }

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
```

**Required `src/proxy.ts`:**
```typescript
// Source: nextjs.org/docs/app/api-reference/file-conventions/proxy
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createSupabaseMiddlewareClient } from "@/lib/supabase/middleware"

export async function proxy(request: NextRequest) { ... }  // renamed from middleware

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],  // unchanged
}
```

**The logic inside the function is identical** — only the filename and function name change.

## DPLY-04 Research: generate-app-config.js Fixes

### Current State (from codebase)

```javascript
// Current (WRONG) behavior — lines 26-31
const missing = required.filter((k) => !process.env[k])
if (missing.length > 0) {
  console.log(
    `generate-app-config: skipping (missing env vars: ${missing.join(", ")})`
  )
  process.exit(0)  // BUG: exits 0 (success) — build continues silently
}
```

### Required Changes

**Change 1: Add dotenv at the top**
```javascript
// Source: D-02 decision + pattern from src/env.ts
const path = require("path")
require("dotenv").config({ path: path.join(__dirname, "../.env.local") })
```

**Change 2: Fix the exit code and message**
```javascript
// Source: D-01 decision
if (missing.length > 0) {
  console.error(
    `generate-app-config: FATAL: missing required env vars: ${missing.join(", ")}`
  )
  process.exit(1)  // FIXED: exits 1 (failure) — build aborts
}
```

### dotenv Dependency Risk

**Finding:** `dotenv` is NOT a direct dependency in `package.json`. It is installed only transitively (via `shadcn` → `@dotenvx/dotenvx` → `dotenv`). [VERIFIED: npm list output]

**Risk:** If `shadcn` is removed or updates its dependency tree, `dotenv` could disappear from `node_modules`. The script would then fail with `Cannot find module 'dotenv'`.

**Mitigation required:** Add `dotenv` as a direct devDependency:
```bash
npm install --save-dev dotenv
```

The currently installed transitive version is `17.4.0`. [VERIFIED: package-lock.json]

## Standard Stack (Phase-Specific)

### Core (already installed)
| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| Vercel CLI | 54.1.0 | Deploy management, env var injection | [VERIFIED: `vercel --version`] |
| Next.js | 16.2.2 | App framework — already installed | [VERIFIED: package.json] |
| dotenv | 17.4.0 (transitive) | Local env loading in build script | Must be made direct devDep |

### Vercel Project Status
- Project already linked: `.vercel/project.json` exists [VERIFIED: codebase]
- `projectId`: `prj_g67bSccUpUtIKGZNjnYDPVQUh0X6`
- `projectName`: `vuoroasuminen`
- Vercel Node version: `24.x` (meets Next.js 16 requirement of 20.9+) [VERIFIED: .vercel/project.json]

## Architecture Patterns

### Proxy.ts Pattern (Next.js 16)

```typescript
// Source: [VERIFIED: nextjs.org/docs/app/api-reference/file-conventions/proxy]
// File: src/proxy.ts (formerly src/middleware.ts)

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Named export 'proxy' (was 'middleware')
export async function proxy(request: NextRequest) {
  // ... same logic as before ...
}

// config export unchanged
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

### Build Script Pattern (generate-app-config.js)

```javascript
// Source: D-01, D-02 decisions + src/env.ts pattern
#!/usr/bin/env node
const fs = require("fs")
const path = require("path")

// MUST be before required[] check — loads .env.local for local builds
require("dotenv").config({ path: path.join(__dirname, "../.env.local") })

const required = [ /* ... APP_* vars ... */ ]

const missing = required.filter((k) => !process.env[k])
if (missing.length > 0) {
  console.error(
    `generate-app-config: FATAL: missing required env vars: ${missing.join(", ")}`
  )
  process.exit(1)  // Non-zero: aborts next build
}
// ... rest of script unchanged ...
```

### Vercel Env Var Pattern (D-08)

```bash
# Source: [CITED: vercel.com/docs/cli/env]
# Run once per var — values entered interactively (not in shell history)
vercel env add GOOGLE_CLIENT_ID production
vercel env add GOOGLE_CLIENT_SECRET production
vercel env add DATABASE_URL production
# ... etc for all required vars
```

### Supabase Pooler DATABASE_URL Pattern (D-10)

```
# Production (pooler — prevents connection exhaustion on Vercel serverless)
postgresql://postgres.wsdrguowmcjyfrsjsywn:[password]@aws-1-eu-north-1.pooler.supabase.com:6543/postgres?pgbouncer=true

# Local dev (direct connection — already in .env.local, no change)
postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
```

## Complete Env Var Checklist for Vercel

All vars that must be set via `vercel env add VAR_NAME production`:

### Runtime vars (needed by Next.js server at request time)
| Var Name | Source | Notes |
|----------|--------|-------|
| `GOOGLE_CLIENT_ID` | Google Cloud Console → Credentials | Same client used for GCal API and OAuth |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console → Credentials | |
| `DATABASE_URL` | Supabase → Settings → Database | Use pooler URL (port 6543, `?pgbouncer=true`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API | `https://wsdrguowmcjyfrsjsywn.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API | |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API | Admin key for GCal/token reads (Phase 8 D-11) — currently missing from .env.example |
| `PARENT_FATHER_EMAIL` | Family config | Used to identify which parent is signed in |
| `PARENT_MOTHER_EMAIL` | Family config | |

### Build-time vars (needed by generate-app-config.js during `next build`)
| Var Name | Source | Notes |
|----------|--------|-------|
| `APP_FATHER_NAME` | Family config | |
| `APP_FATHER_EMAIL` | Family config | |
| `APP_FATHER_CALENDAR_ID` | Google Calendar settings | |
| `APP_MOTHER_NAME` | Family config | |
| `APP_MOTHER_EMAIL` | Family config | |
| `APP_MOTHER_CALENDAR_ID` | Google Calendar settings | |
| `APP_CHILDREN` | Family config | Comma-separated names |
| `APP_START_DATE` | Schedule config | ISO date: first Monday of alternating pattern |
| `APP_FIRST_PARENT` | Schedule config | `"father"` or `"mother"` |
| `APP_CALENDAR_OWNER_EMAIL` | Family config | Currently missing from .env.example |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| middleware→proxy migration | Manual search/replace across files | `npx @next/codemod@canary middleware-to-proxy .` | Official codemod handles all edge cases including function rename |
| Env var secret storage | Plain text in git or shell history | `vercel env add VAR_NAME production` interactive prompt | Values never touch shell history or git |
| OAuth token refresh | Custom token exchange logic | Supabase Auth + `@supabase/ssr` (already implemented) | Already working; no changes needed for GCal token logic in Phase 11 |

## Common Pitfalls

### Pitfall 1: Wrong OAuth redirect URI in Google Cloud Console
**What goes wrong:** Adding `https://vuoroasuminen.vercel.app/auth/callback` (the Next.js route) instead of `https://wsdrguowmcjyfrsjsywn.supabase.co/auth/v1/callback` (Supabase's auth server). Result: `redirect_uri_mismatch` error at sign-in.
**Why it happens:** Google OAuth redirect URIs must match exactly what Supabase sends during the OAuth flow. Supabase handles the code exchange using its own server URL.
**How to avoid:** Register `https://wsdrguowmcjyfrsjsywn.supabase.co/auth/v1/callback` — confirmed from D-06.
**Warning signs:** `Error 400: redirect_uri_mismatch` on the Google sign-in page.

### Pitfall 2: Supabase Site URL not matching the actual Vercel URL
**What goes wrong:** Vercel may assign `vuoroasuminen-<hash>.vercel.app` instead of `vuoroasuminen.vercel.app` if the name was taken. If Supabase Site URL is set to the wrong domain, post-auth redirects fail.
**Why it happens:** Vercel project names are globally unique. First deploy reveals the actual URL.
**How to avoid:** Deploy first, confirm the actual URL, THEN configure Supabase Site URL and Google redirect URI.
**Warning signs:** After sign-in, browser redirects to an error page or infinite loop.

### Pitfall 3: dotenv not a direct dependency
**What goes wrong:** `require("dotenv")` works now (it's transitive via shadcn) but could break if shadcn's dependency tree changes.
**Why it happens:** Package.json does not list dotenv directly. Transitive dependencies are not guaranteed to be stable.
**How to avoid:** Run `npm install --save-dev dotenv` before shipping.
**Warning signs:** `Cannot find module 'dotenv'` during build.

### Pitfall 4: Using `process.exit(0)` path still present after edit
**What goes wrong:** If the exit-code fix is incomplete (e.g., wrong line edited, or the old path left in), Vercel will deploy with missing vars and `src/config/app.ts` will be generated with `undefined` values.
**How to avoid:** After editing, verify with: `node scripts/generate-app-config.js; echo "exit: $?"` — should print exit code 1 and an error message when run without env vars set.
**Warning signs:** Silent build success with malformed app.ts output.

### Pitfall 5: Middleware still using `middleware` export name after proxy rename
**What goes wrong:** If the file is renamed to `proxy.ts` but the function is still exported as `middleware`, Next.js will not recognize it as the proxy handler. Routes become unprotected.
**Why it happens:** Both the filename AND the export name must change.
**How to avoid:** Use the official codemod (`npx @next/codemod@canary middleware-to-proxy .`) which handles both. If doing manually, verify: `export async function proxy(...)` in `src/proxy.ts`.
**Warning signs:** All routes accessible without authentication after deploy.

### Pitfall 6: Production DATABASE_URL using direct connection (port 5432) instead of pooler
**What goes wrong:** Vercel serverless functions create a new DB connection per invocation. Under load, this exhausts Supabase's connection limit quickly.
**Why it happens:** Local dev uses port 5432 (direct) which works fine. Same URL copied to Vercel would be wrong.
**How to avoid:** Production DATABASE_URL must use port 6543 with `?pgbouncer=true` (D-10 pattern).
**Warning signs:** `too many connections` Postgres errors in Vercel function logs.

## Code Examples

### Verified: proxy.ts skeleton
```typescript
// Source: [VERIFIED: nextjs.org/docs/app/api-reference/file-conventions/proxy]
// src/proxy.ts

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createSupabaseMiddlewareClient } from "@/lib/supabase/middleware"

export async function proxy(request: NextRequest) {
  const response = NextResponse.next()
  const supabase = createSupabaseMiddlewareClient(request, response)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isOnHome = pathname === "/"
  const isOnAuthRoute = pathname.startsWith("/auth/")

  if (!user && !isOnHome && !isOnAuthRoute) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
```

### Verified: generate-app-config.js corrected top section
```javascript
// Source: D-01, D-02 decisions
#!/usr/bin/env node
const fs = require("fs")
const path = require("path")

// Load .env.local for local builds (on Vercel, vars are injected directly)
require("dotenv").config({ path: path.join(__dirname, "../.env.local") })

const required = [
  "APP_FATHER_NAME",
  "APP_FATHER_EMAIL",
  "APP_FATHER_CALENDAR_ID",
  "APP_MOTHER_NAME",
  "APP_MOTHER_EMAIL",
  "APP_MOTHER_CALENDAR_ID",
  "APP_CHILDREN",
  "APP_START_DATE",
  "APP_FIRST_PARENT",
  "APP_CALENDAR_OWNER_EMAIL",
]

const missing = required.filter((k) => !process.env[k])
if (missing.length > 0) {
  console.error(
    `generate-app-config: FATAL: missing required env vars: ${missing.join(", ")}`
  )
  process.exit(1)
}
// ... rest of file unchanged ...
```

### Verified: .env.example additions needed
```bash
# Missing from current .env.example — must be added:

# Supabase service role key (required for admin Drizzle connection — GCal token reads)
# Supabase Dashboard -> Settings -> API -> service_role secret
SUPABASE_SERVICE_ROLE_KEY=

# Calendar owner email (the Google account whose token is used for GCal writes)
# Must match one of the parent emails that has done OAuth sign-in
APP_CALENDAR_OWNER_EMAIL=

# Build-time family config (APP_* prefix — these are what Vercel/generate-app-config.js uses)
# Note: PARENT_FATHER_* vars above are for runtime parent identification
APP_FATHER_NAME=
APP_FATHER_EMAIL=
APP_FATHER_CALENDAR_ID=
APP_MOTHER_NAME=
APP_MOTHER_EMAIL=
APP_MOTHER_CALENDAR_ID=
APP_FIRST_PARENT=father
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` with `export function middleware()` | `proxy.ts` with `export function proxy()` | Next.js 16.0 (Oct 2025) | File rename + function rename required; logic unchanged |
| Edge runtime for middleware | Node.js runtime for proxy (edge deprecated) | Next.js 16.0 | No impact for this project — Supabase SSR already requires Node.js runtime |
| `skipMiddlewareUrlNormalize` config key | `skipProxyUrlNormalize` | Next.js 16.0 | Not used in this project — no action needed |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Vercel CLI | DPLY-01, DPLY-08 (env vars) | Yes | 54.1.0 | — |
| Node.js | Build script | Yes | 25.3.0 (local) / 24.x (Vercel) | — |
| dotenv (direct dep) | DPLY-04 (generate-app-config.js) | Transitive only | 17.4.0 | Must add as devDep via `npm install --save-dev dotenv` |
| Vercel project link | DPLY-01 | Yes | `.vercel/project.json` present | — |
| Supabase project | DPLY-02, DPLY-03 | Yes | ref: wsdrguowmcjyfrsjsywn | — |

**Missing dependencies with no fallback:**
- None that block execution.

**Missing dependencies requiring action:**
- `dotenv` as direct devDependency — transitive only now; must be locked with `npm install --save-dev dotenv` before the build script is deployed.

## Validation Architecture

> `nyquist_validation: false` in `.planning/config.json` — this section is skipped per config.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Supabase Auth + Google OAuth (already implemented) |
| V3 Session Management | Yes | `@supabase/ssr` cookie-based sessions; `getUser()` not `getSession()` (D-09 carry-forward) |
| V4 Access Control | Yes | proxy.ts enforces route protection; unauthenticated users redirected to `/` |
| V5 Input Validation | Partial | Build script validates presence of env vars; no user input in this phase |
| V6 Cryptography | No | OAuth tokens handled by Supabase; no custom crypto in this phase |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Session leak on Vercel warm instances | Information Disclosure | Never initialize Supabase client at module scope (D-10 carry-forward from Phase 8) |
| Spoofed OAuth state parameter | Tampering | Supabase handles state validation; no custom OAuth logic |
| Exposed service role key | Information Disclosure | `SUPABASE_SERVICE_ROLE_KEY` must be set as a Vercel env var — never committed to git or included in `NEXT_PUBLIC_` vars |
| OAuth redirect_uri mismatch attack | Spoofing | Only the Supabase callback URL is registered; no wildcard URIs |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Vercel URL will be `https://vuoroasuminen.vercel.app` (D-05) | Production Domain | If taken, Vercel appends suffix; Supabase Site URL and Google redirect URI configuration must be updated after first deploy |
| A2 | `src/env.ts` dotenv pattern (`config({ path: ".env.local" })`) applies equally to CommonJS `require("dotenv").config(...)` | DPLY-04 findings | Minimal risk — both use same dotenv package; CommonJS require is confirmed working via local test |

## Open Questions

1. **Will the codemod handle the `createSupabaseMiddlewareClient` import path correctly?**
   - What we know: The codemod renames the file and exported function. Import paths from other files that import `middleware` (if any) are also handled.
   - What's unclear: Whether any other file in this project imports from `src/middleware.ts` directly.
   - Recommendation: Run `grep -r "from.*middleware" src/` before running the codemod to see if any imports need manual updating. The `src/lib/supabase/middleware.ts` helper file should NOT be renamed — it is a named helper module, not the Next.js middleware convention file.

2. **Should `scripts/generate-app-config.js` be updated or replaced?**
   - What we know: Phase 12 will move family config to DB, making the `APP_*` env vars unnecessary. The script will become a no-op or be deleted in Phase 12.
   - What's unclear: Whether to note this in comments now or leave clean-up to Phase 12.
   - Recommendation: Keep the script as-is for Phase 11 (just the two fixes: dotenv + exit code). Add a TODO comment noting it will be removed in Phase 12 when DB config lands.

## Sources

### Primary (HIGH confidence)
- [VERIFIED: nextjs.org/docs/app/guides/upgrading/version-16] — Full Next.js 15→16 upgrade guide; confirmed middleware→proxy deprecation, Turbopack default, async API removals
- [VERIFIED: nextjs.org/blog/next-16] — Official release post (Oct 2025); confirms proxy.ts rename as stable requirement
- [VERIFIED: nextjs.org/docs/app/api-reference/file-conventions/proxy] — Full proxy.ts API reference; confirms file location rules, function export, config matcher, migration codemod command
- [VERIFIED: package.json] — next@16.2.2 installed; project on Next.js 16
- [VERIFIED: .vercel/project.json] — project already linked; Node 24.x runtime
- [VERIFIED: scripts/generate-app-config.js] — current exit code bug confirmed (line 31: `process.exit(0)`)
- [VERIFIED: src/middleware.ts] — current file; function exported as `middleware`; no edge runtime config
- [VERIFIED: npm list dotenv] — dotenv is transitive only (not in package.json)

### Secondary (MEDIUM confidence)
- [CITED: nextjs.org/docs/messages/middleware-to-proxy] — Migration guide for the rename
- [CITED: vercel.com/docs/cli] — Vercel CLI env var management (assumed pattern based on CLI version 54.1.0)

## Metadata

**Confidence breakdown:**
- DPLY-05 (middleware→proxy): HIGH — confirmed by official Next.js 16 docs and release blog
- DPLY-04 (generate-app-config fix): HIGH — exact lines identified in codebase
- DPLY-01 (Vercel deploy): HIGH — project already linked, CLI present
- DPLY-02 (Google OAuth): HIGH — Supabase callback URL is a known project value
- DPLY-03 (Supabase auth config): HIGH — standard Supabase Auth dashboard configuration
- dotenv direct dep requirement: HIGH — verified via `npm list` and package.json

**Research date:** 2026-05-16
**Valid until:** 2026-06-16 (Next.js docs stable; Vercel CLI may update but env add pattern is stable)
