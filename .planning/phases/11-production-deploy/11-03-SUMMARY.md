---
phase: 11-production-deploy
plan: 03
subsystem: infra
tags: [vercel, google-oauth, supabase, deployment]

requires:
  - phase: 11-01
    provides: generate-app-config.js exit-1 fix and .env.example documentation
  - phase: 11-02
    provides: src/proxy.ts Next.js 16 convention file

provides:
  - Live production deployment at https://vuoroasuminen.vercel.app
  - All 15 required env vars set in Vercel production environment
  - Google Cloud Console OAuth client authorised for Supabase callback URL
  - Supabase Auth Site URL and Redirect allowlist configured for production domain
  - Both parents verified signing in end-to-end on production URL

affects: [phase-12-onboarding]

tech-stack:
  added: []
  patterns:
    - "Vercel production env vars set via vercel env add (interactive, values never in shell history)"
    - "DATABASE_URL on Vercel uses pooler port 6543 with ?pgbouncer=true (local uses 5432)"

key-files:
  created: []
  modified:
    - scripts/generate-app-config.js
    - .env.example

key-decisions:
  - "SUPABASE_SERVICE_ROLE_KEY not added — codebase never references it; DB uses DATABASE_URL only"
  - "generate-app-config.js corrected to use PARENT_FATHER_*/PARENT_MOTHER_* naming (matching .env.local and runtime src/config/app.ts); APP_FATHER_* vars were cleaned up in env-local-dedup and not needed"
  - "15 vars set in Vercel (not 18 as originally planned) after removing unused APP_FATHER_*/APP_MOTHER_*/SUPABASE_SERVICE_ROLE_KEY"
  - "Production URL: https://vuoroasuminen.vercel.app"

patterns-established:
  - "Supabase OAuth callback registered on Supabase's server (wsdrguowmcjyfrsjsywn.supabase.co/auth/v1/callback), NOT the Next.js /auth/callback route"

requirements-completed:
  - DPLY-01
  - DPLY-02
  - DPLY-03

duration: 45min
completed: 2026-05-16
---

# Phase 11-03: Production Deploy Summary

**App live at https://vuoroasuminen.vercel.app — both parents sign in via Google OAuth with no errors**

## Performance

- **Duration:** ~45 min (including human dashboard steps)
- **Completed:** 2026-05-16
- **Tasks:** 7 (Tasks 1, 6 auto; Tasks 2, 3, 4, 5, 7 human-action/verify)
- **Files modified:** 2 (generate-app-config.js, .env.example — corrective fixes)

## Accomplishments

- Vercel CLI verified (v54.1.0), project linked, 15 env vars set in production environment
- Google Cloud Console OAuth client updated with Supabase auth server callback URI
- Supabase Auth Site URL and Redirect allowlist set to production domain
- Production build succeeded: `generate-app-config: wrote src/config/app.ts`, `ƒ Proxy (Middleware)` in route output, no deprecation warnings
- Both parents (father + mother) completed end-to-end Google sign-in on production URL

## Corrective Fix Applied

`generate-app-config.js` required `APP_FATHER_*`/`APP_MOTHER_*` but `.env.local` and runtime `src/config/app.ts` use `PARENT_FATHER_*`/`PARENT_MOTHER_*`. These were renamed in the env-local-dedup quick task but the build script was not updated then. Fixed before setting Vercel env vars, preventing a silent build failure.

Also removed `SUPABASE_SERVICE_ROLE_KEY` from required vars — no code references it.

## Files Modified

- `scripts/generate-app-config.js` — corrected `required` array and template to use `PARENT_FATHER_*`/`PARENT_MOTHER_*`
- `.env.example` — removed `SUPABASE_SERVICE_ROLE_KEY` and `APP_FATHER_*`/`APP_MOTHER_*` block (not used)

## Decisions Made

- DATABASE_URL on Vercel uses pooler (port 6543, `?pgbouncer=true`); local .env.local stays on port 5432
- 15 env vars set (not 18): removed `SUPABASE_SERVICE_ROLE_KEY`, `APP_FATHER_*`, `APP_MOTHER_*`

## Deviations from Plan

### Auto-fixed Issues

**1. generate-app-config.js var naming mismatch**
- **Found during:** Task 3 (env var setup review)
- **Issue:** Plan listed `APP_FATHER_*`/`APP_MOTHER_*` as required Vercel vars, but `.env.local` and `src/config/app.ts` use `PARENT_FATHER_*`/`PARENT_MOTHER_*`. Adding the APP_ vars would re-introduce what was cleaned up.
- **Fix:** Updated `generate-app-config.js` required array and generated template to match actual naming. Removed `SUPABASE_SERVICE_ROLE_KEY` (unused in codebase).
- **Files modified:** `scripts/generate-app-config.js`, `.env.example`
- **Committed in:** `d4821ac`

---

**Total deviations:** 1 auto-fixed (naming mismatch caught before setting wrong vars)
**Impact:** Prevented setting 3 unused env vars; corrected build script alignment with actual runtime code.

## Issues Encountered

None beyond the corrective fix above.

## Next Phase Readiness

- Phase 12 (Onboarding Wizard) can proceed — production URL is live and both parents can sign in
- Family config still comes from build-time env vars; Phase 12 will move this to DB-backed config
- `generate-app-config.js` will need removal or update in Phase 12 when env vars are replaced by DB config

---
*Phase: 11-production-deploy*
*Completed: 2026-05-16*
