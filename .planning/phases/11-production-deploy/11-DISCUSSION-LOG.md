# Phase 11: Production Deploy - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-16
**Phase:** 11-production-deploy
**Areas discussed:** generate-app-config.js exit code, middleware.ts rename (DPLY-05), Production domain, Env var delivery to Vercel

---

## generate-app-config.js exit code

| Option | Description | Selected |
|--------|-------------|----------|
| Only on Vercel (check VERCEL=1) | Fail if VERCEL env var is set AND a required var is missing | |
| Always fail on missing vars | Remove the skip logic entirely. Local dev uses dotenv to read .env.local | ✓ |
| Check CI env var | Fail if CI=true (set by Vercel, GitHub Actions, etc.) | |

**User's choice:** Always fail on missing vars — remove skip logic entirely

---

### dotenv for local build

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — add dotenv load | Script reads .env.local at build time; local `npm run build` works without shell exports | ✓ |
| No — process.env only | Simpler; local build fails unless APP_* vars are exported in shell | |

**User's choice:** Add dotenv load — matches src/env.ts pattern

---

## middleware.ts rename (DPLY-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Verify first — not sure of reason | Research actual Next.js 16 requirement before implementing | ✓ |
| It's about Vercel's routing middleware product | Keep middleware.ts; optionally add proxy.ts for Vercel-level routing | |
| Requirement is wrong — close as N/A | middleware.ts is correct for Next.js 16; rename would break auth | |
| There IS a Next.js 16 change I know about | Describe the actual change | |

**User's choice:** Verify first — researcher must determine what (if any) Next.js 16 change is required before implementing DPLY-05

---

## Production domain

| Option | Description | Selected |
|--------|-------------|----------|
| Vercel auto-assigned URL | vuoroasuminen.vercel.app — free, instant, no DNS config | ✓ |
| Custom domain | Requires DNS setup, Vercel domain config, TLS provisioning | |

**User's choice:** Vercel auto-assigned URL for v1.3

---

## Env var delivery to Vercel

| Option | Description | Selected |
|--------|-------------|----------|
| vercel env add CLI | `vercel env add VAR_NAME production` per var; values typed interactively | ✓ |
| Vercel dashboard | Manual entry in web UI | |
| Import from .env.local | Risk: local values differ from production values | |

**User's choice:** vercel env add CLI

---

### .env.example update

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — update .env.example | Add SUPABASE_SERVICE_ROLE_KEY, APP_CALENDAR_OWNER_EMAIL, APP_FATHER_*/APP_MOTHER_* | ✓ |
| No — update separately | Leave for follow-up task | |

**User's choice:** Update .env.example this phase

---

### Production DATABASE_URL

| Option | Description | Selected |
|--------|-------------|----------|
| Pooler URL for Vercel (port 6543, ?pgbouncer=true) | Prevents connection exhaustion under serverless concurrency | ✓ |
| Same direct connection as local dev (port 5432) | Simpler but may hit connection limits | |

**User's choice:** Pooler URL for Vercel production

---

## Deferred Ideas

- Custom domain — future work if needed
- Staging environment — explicitly out of scope
