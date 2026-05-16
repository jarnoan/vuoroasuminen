# Phase 11: Production Deploy - Context

**Gathered:** 2026-05-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Get the app live at a stable production URL (Vercel) with Google OAuth and Supabase Auth fully configured for the production domain. Includes: fixing the build env var validation, verifying the DPLY-05 middleware requirement, configuring Google Cloud Console and Supabase for the production domain, and setting all required env vars in Vercel.

This phase does NOT include the onboarding wizard or invite link (Phases 12–13). The app deploys with the current env-var-based `src/config/app.ts` config pattern.

</domain>

<decisions>
## Implementation Decisions

### DPLY-04: generate-app-config.js exit code
- **D-01:** Remove the "skip on missing vars" logic entirely. Script ALWAYS exits 1 when any required var is missing — no conditional `VERCEL` or `CI` check.
- **D-02:** Add `require("dotenv").config({ path: path.join(__dirname, "../.env.local") })` at the top of the script (before the env checks). This makes `npm run build` work locally using `.env.local` values without requiring shell exports. Matches how `src/env.ts` already handles dotenv.
- **D-03:** The required var list in the script (`APP_FATHER_NAME`, `APP_FATHER_EMAIL`, `APP_FATHER_CALENDAR_ID`, `APP_MOTHER_NAME`, `APP_MOTHER_EMAIL`, `APP_MOTHER_CALENDAR_ID`, `APP_CHILDREN`, `APP_START_DATE`, `APP_FIRST_PARENT`, `APP_CALENDAR_OWNER_EMAIL`) stays as-is — these are the Vercel env var names, distinct from the `PARENT_FATHER_*` names in `.env.example`.

### DPLY-05: middleware.ts rename
- **D-04:** The "rename middleware.ts to proxy.ts" requirement needs verification before implementing. The researcher MUST investigate whether Next.js 16 actually requires any file rename or configuration change. Renaming `src/middleware.ts` to `src/proxy.ts` would break Next.js routing entirely (Next.js only recognizes `middleware.ts` / `src/middleware.ts`). If the requirement is based on a misunderstanding, close DPLY-05 as N/A and keep the file as-is. If there IS a valid Next.js 16 change needed (different config, different export pattern, etc.), implement that instead.

### Production Domain
- **D-05:** Use Vercel auto-assigned URL: `https://vuoroasuminen.vercel.app` (confirm actual URL after first deploy — Vercel may append a suffix if the name was taken).
- **D-06:** Google Cloud Console: add Supabase's callback URL as an authorized redirect URI — `https://wsdrguowmcjyfrsjsywn.supabase.co/auth/v1/callback`. This is Supabase's auth server, NOT the Next.js `/auth/callback` route.
- **D-07:** Supabase Dashboard: set Site URL to `https://vuoroasuminen.vercel.app` and add it to the redirect URL allowlist. This is what Supabase uses to validate the post-auth redirect target.

### Env Var Delivery to Vercel
- **D-08:** Use `vercel env add VAR_NAME production` CLI for each required var. Values entered interactively (not in shell history). Run after `vercel login` and project link confirmed.
- **D-09:** Update `.env.example` to document ALL required vars, with comments explaining each group:
  - `SUPABASE_SERVICE_ROLE_KEY` — currently missing from `.env.example`; required for admin Drizzle connection (Phase 8 D-11)
  - `APP_CALENDAR_OWNER_EMAIL` — currently missing from `.env.example`; required by `generate-app-config.js`
  - All `APP_FATHER_*` / `APP_MOTHER_*` vars — currently only `PARENT_FATHER_*` / `PARENT_MOTHER_*` are documented; the `APP_*` prefix is what Vercel/build actually uses
- **D-10:** Production `DATABASE_URL` uses Supabase pooler (port 6543) with `?pgbouncer=true` appended. Pattern: `postgresql://postgres.[ref]:[password]@aws-1-eu-north-1.pooler.supabase.com:6543/postgres?pgbouncer=true`. Prevents connection exhaustion under Vercel serverless concurrency. Local dev continues to use port 5432 (direct connection, already in `.env.local`).

### Claude's Discretion
- Exact vercel CLI commands and sequencing in the plan
- Whether to add a `vercel-env-checklist.md` or document the env var setup steps in the plan only
- Order of plan tasks (e.g., generate-app-config fix first, then deploy, then configure external services)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Deploy — DPLY-01 through DPLY-05 definitions

### Roadmap
- `.planning/ROADMAP.md` §Phase 11 — goal, success criteria (5 must-be-true)

### Existing implementation (read before touching)
- `scripts/generate-app-config.js` — build-time config generator; exit code fix goes here (D-01, D-02)
- `src/middleware.ts` — current auth middleware; do NOT rename until DPLY-05 is verified (D-04)
- `src/config/app.ts` — current config; generated at build time by `generate-app-config.js` on Vercel; committed to git for local dev
- `src/env.ts` — uses `dotenv` already (reference for the dotenv pattern in D-02)
- `.env.example` — needs update to document all Vercel-required vars (D-09)
- `.vercel/project.json` — Vercel project already linked (projectId: prj_g67bSccUpUtIKGZNjnYDPVQUh0X6, projectName: vuoroasuminen)
- `package.json` — build script: `node scripts/generate-app-config.js && next build`

### Prior phase decisions (carry forward)
- `.planning/phases/08-supabase-auth-stack/08-CONTEXT.md` — D-09 (getUser not getSession), D-10 (no module-scope client), D-11 (admin Drizzle for GCal/token reads)

### External services
- Supabase project ref: `wsdrguowmcjyfrsjsywn` (visible in DATABASE_URL in `.env.local`)
- Supabase auth callback URL: `https://wsdrguowmcjyfrsjsywn.supabase.co/auth/v1/callback`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/generate-app-config.js`: CommonJS script; add dotenv at top, change exit code on missing vars — surgical edits only
- `dotenv`: already a project dependency (used in `src/env.ts`); safe to `require` in the script

### Established Patterns
- Build script wiring: `package.json` build command already runs `generate-app-config.js` before `next build` — no change needed there
- Drizzle admin connection: `db` from `@/db` uses `DATABASE_URL`; production URL needs the pooler suffix (D-10)

### Integration Points
- `.env.example`: documentation file only — update to add `APP_*` vars, `SUPABASE_SERVICE_ROLE_KEY`, `APP_CALENDAR_OWNER_EMAIL`
- Vercel environment: build-time vars (`APP_FATHER_*`, etc.) AND runtime vars (`GOOGLE_CLIENT_*`, `SUPABASE_*`, `DATABASE_URL`) all go in Vercel production env
- Google Cloud Console: authorized redirect URIs list — add Supabase callback URL
- Supabase Auth settings: Site URL + redirect allowlist — add Vercel production URL

</code_context>

<specifics>
## Specific Ideas

- Supabase pooler DATABASE_URL format: `postgresql://postgres.wsdrguowmcjyfrsjsywn:[password]@aws-1-eu-north-1.pooler.supabase.com:6543/postgres?pgbouncer=true`
- `generate-app-config.js` dotenv line: `require("dotenv").config({ path: path.join(__dirname, "../.env.local") })` — before the `required` array definition
- Error message when vars missing should list ALL missing vars in one shot (current code already does this: `missing.join(", ")`) — keep that behavior, just change `process.exit(0)` to `process.exit(1)` and update the log message from "skipping" to "FATAL: missing required env vars"
- Plan should include a checklist of manual operational steps: (1) Vercel deploy to get production URL, (2) add Supabase callback URL to Google Cloud Console, (3) configure Supabase Site URL + allowlist, (4) set all env vars via `vercel env add`, (5) trigger production redeploy, (6) verify sign-in on production URL

</specifics>

<deferred>
## Deferred Ideas

- Custom domain — use Vercel auto-assigned URL for v1.3; custom domain is future work if needed
- Staging environment — explicitly out of scope per REQUIREMENTS.md
- Supabase Pro upgrade — operational task; tracked in STATE.md; not a code change
- Google OAuth app verification (3–5 business days) — operational task; tracked in STATE.md

</deferred>

---

*Phase: 11-production-deploy*
*Context gathered: 2026-05-16*
