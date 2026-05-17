---
plan: 12-05
phase: 12-onboarding-wizard
status: complete
wave: 4
completed: 2026-05-16
requirements_addressed:
  - ONBR-03
  - ONBR-04
key-files:
  modified:
    - src/env.ts
    - .env.example
    - src/app/setup/page.tsx
    - src/app/setup/steps/step-complete.tsx
---

## What Was Built

Final gate for Phase 12 — env cleanup + human verification of the end-to-end wizard flow.

**Task 1 — Env var cleanup:**
- `src/env.ts` REQUIRED_ENV_VARS trimmed from 9 to 5 entries: removed `PARENT_FATHER_EMAIL`, `PARENT_MOTHER_EMAIL`, `APP_CHILDREN`, `APP_START_DATE`
- `.env.example` updated: legacy `PARENT_*`, `APP_CHILDREN`, `APP_START_DATE`, `APP_FIRST_PARENT`, `APP_CALENDAR_OWNER_EMAIL` entries removed; explanatory comment block added explaining family_config DB model

**Task 2 — Build verification:**
- `npm run build` passes without any legacy family-config env vars — ONBR-04 success criterion proven

**Task 3 — Human checkpoint: APPROVED**

User tested the full end-to-end wizard flow on local dev:
- Unauthenticated → `/` (sign-in)
- Sign-in → `/dashboard` → redirect to `/setup` (no family_config row)
- Step 1 (Perhetiedot), Step 2 (Kalenterit), Step 3 (Tarkista) → Tallenna ja jatka → Step 4 (Valmis)
- "Siirry aikatauluun" → `/dashboard` renders with schedule grid
- Re-visiting `/setup` while onboarded → redirect to `/dashboard` ✓

**Bugs found and fixed during checkpoint:**
1. Base UI `Button render={<Link>}` threw `nativeButton` warning — fixed by using `<Link className={buttonVariants()}>` directly
2. `redirect()` inside `try/catch` was swallowed (Next.js redirect works by throwing) — fixed by calling `redirect()` outside the catch block

**Task 4 — Operational followups added to STATE.md:**
- Remove legacy env vars from Vercel project settings (PARENT_*, APP_CHILDREN, APP_START_DATE, APP_FIRST_PARENT, APP_CALENDAR_OWNER_EMAIL)
- Redeploy after Vercel env cleanup; complete wizard on prod if family_config not seeded there
- CR-01 git history scrub pre-existing; Phase 12 added no new secrets to git

## Env Var Change Summary

| Var | Before | After |
|-----|--------|-------|
| GOOGLE_CLIENT_ID | required | required |
| GOOGLE_CLIENT_SECRET | required | required |
| DATABASE_URL | required | required |
| NEXT_PUBLIC_SUPABASE_URL | required | required |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | required | required |
| PARENT_FATHER_EMAIL | required | **removed** |
| PARENT_MOTHER_EMAIL | required | **removed** |
| APP_CHILDREN | required | **removed** |
| APP_START_DATE | required | **removed** |

## Self-Check

- [x] `src/env.ts` contains only 5 infra vars
- [x] `.env.example` mirrors trimmed contract with explanatory comment
- [x] `npm run build` exits 0 without legacy vars
- [x] Human checkpoint approved end-to-end wizard flow
- [x] STATE.md updated: Vercel cleanup todo added, current position → Phase 13
- [x] No `.env.local.bak` or working files committed
- [x] 47/47 vitest tests pass, `npx tsc --noEmit` clean

## Self-Check: PASSED
