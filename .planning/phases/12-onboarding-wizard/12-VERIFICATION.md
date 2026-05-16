---
phase: 12-onboarding-wizard
verified: 2026-05-16T00:00:00Z
status: human_needed
score: 9/9 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Visit /setup in a browser while signed in with no family_config row — confirm wizard Step 1 renders (Perhetiedot)"
    expected: "Wizard loads at Step 1 with parent name pre-filled from Google account; calendar Combobox loads on Step 2; all 4 steps complete and family_config row is written to DB"
    why_human: "Full wizard flow requires a live browser, Google OAuth session, and Supabase DB with a real Google OAuth token row for listCalendars to succeed"
  - test: "Visit /setup while signed out — confirm redirect to /"
    expected: "Browser is redirected to / without seeing wizard UI"
    why_human: "Requires a live browser session to test server-side redirect behavior"
  - test: "Visit /setup while already onboarded (family_config row exists) — confirm redirect to /dashboard"
    expected: "Browser is redirected to /dashboard immediately"
    why_human: "Requires a live browser and a pre-existing family_config row"
---

# Phase 12: Onboarding Wizard Verification Report

**Phase Goal:** First parent can configure family setup through a UI wizard; app no longer requires PARENT_*/APP_* env vars
**Verified:** 2026-05-16
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | family_config and invite_tokens tables exist in PostgreSQL | ✓ VERIFIED | `export const familyConfig` and `export const inviteTokens` in `src/db/schema/domain.ts`; SUMMARY confirms tables created in live Supabase DB with verification SQL |
| 2 | family_config has CHECK (id = 1) constraint enforced at DB level | ✓ VERIFIED | `supabase/policies.sql` line 164: `ADD CONSTRAINT family_config_single_row CHECK (id = 1)`; SUMMARY confirms applied to live DB |
| 3 | RLS enabled on both new tables with explicit policies | ✓ VERIFIED | `policies.sql` contains `ENABLE ROW LEVEL SECURITY` for both `family_config` and `invite_tokens`; SELECT-only for authenticated, writes via service_role |
| 4 | getAppConfig() async function reads from family_config and returns existing AppConfig shape | ✓ VERIFIED | `src/config/app.ts` exports `getAppConfig`, `AppConfig`, `ParentId`; no default export; DB query at lines 37-39 reads `familyConfig WHERE id = 1`; ownerEmail=parent1Email for both entries |
| 5 | saveWizardConfig Server Action validates input with Zod and writes to family_config | ✓ VERIFIED | `src/actions/setup.ts`: `"use server"`, `WizardInputSchema` Zod validation, auth check, Monday gate, `onConflictDoUpdate` upsert |
| 6 | listCalendars Server Action returns the authenticated user's Google calendars | ✓ VERIFIED | `src/actions/setup.ts`: auth check + `buildGCalClient(user.email)` + `calendar.calendarList.list()` |
| 7 | All server-side code reads config via await getAppConfig() instead of legacy default import | ✓ VERIFIED | `sync.ts`, `queries.ts`, `schedule.ts`, `dashboard/page.tsx` all use `const config = await getAppConfig()`; `grep` returns 0 non-test default import matches |
| 8 | Dashboard redirects to /setup when family_config is missing (D-10) | ✓ VERIFIED | `src/app/dashboard/page.tsx` lines 31-36: `try { config = await getAppConfig() } catch { redirect("/setup") }` |
| 9 | Visiting /setup while signed in renders the 4-step wizard | ✓ VERIFIED (code) | `src/app/setup/page.tsx`: auth gate, redirect-if-already-onboarded, renders `<SetupWizard>`; all 4 step components exist and are wired; Step 2 calls `listCalendars()` in `useEffect`; Step 3 calls `saveWizardConfig` |
| 10 | Visiting /setup while signed out redirects to / | ✓ VERIFIED (code) | `src/app/setup/page.tsx` line 15: `if (!user) redirect("/")` |
| 11 | Step 3 'Tallenna ja jatka' invokes saveWizardConfig; on success advances to Step 4 | ✓ VERIFIED (code) | `setup-wizard.tsx` line 37: `const result = await saveWizardConfig({...})`; `setStep(4)` on success |
| 12 | Step 4 shows 'Asennus valmis!' with link to /dashboard and Phase 13 hand-off note | ✓ VERIFIED | `step-complete.tsx`: "Asennus valmis!", "Toisen vanhemman kutsuminen on tulossa", `href="/dashboard"` |
| 13 | src/env.ts no longer requires PARENT_* or APP_* family-config env vars | ✓ VERIFIED | `src/env.ts` has exactly 5 vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY; 0 occurrences of PARENT_/APP_ vars |
| 14 | scripts/generate-app-config.js deleted; package.json build is 'next build' only | ✓ VERIFIED | File absent; `package.json` line 7: `"build": "next build"` |

**Score:** 9/9 primary must-haves verified (all truths pass at code level)

### Deferred Items

None — all phase truths are substantively verified at code level.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/schema/domain.ts` | familyConfig and inviteTokens table definitions | ✓ VERIFIED | Both tables exported with all columns; `integer` import present |
| `src/config/app.ts` | Async getAppConfig() function, no default export | ✓ VERIFIED | Exports `getAppConfig`, `AppConfig`, `ParentId`; 0 `export default` occurrences |
| `src/actions/setup.ts` | saveWizardConfig + listCalendars Server Actions | ✓ VERIFIED | 134 lines, both functions present and substantive |
| `supabase/policies.sql` | RLS policies for family_config and invite_tokens | ✓ VERIFIED | Phase 12 block added with CHECK constraint and SELECT policies |
| `src/lib/gcal/sync.ts` | Uses await getAppConfig() | ✓ VERIFIED | Line 65: `const config = await getAppConfig()` |
| `src/lib/schedule/queries.ts` | Uses await getAppConfig() | ✓ VERIFIED | Line 11: `const config = await getAppConfig()` |
| `src/lib/schedule/generate-default.ts` | Accepts startDate and firstParent params | ✓ VERIFIED | Lines 21-22: `startDate: string`, `firstParent: ParentId` in signature |
| `src/actions/schedule.ts` | Uses await getAppConfig() | ✓ VERIFIED | Lines 23 + 150: two `const config = await getAppConfig()` calls |
| `src/app/dashboard/page.tsx` | try/catch + redirect('/setup') + parentsForUI | ✓ VERIFIED | Lines 31-36 redirect pattern; line 57: `parentsForUI`; lines 67-68: props passed |
| `src/components/schedule/dashboard-shell.tsx` | parents + childCount props | ✓ VERIFIED | Lines 18-19: `parents: Array<...>`, `childCount: number` |
| `src/components/schedule/schedule-with-realtime.tsx` | parents prop forwarded | ✓ VERIFIED | Line 22: `parents: Array<...>`; forwarded to StatsPanel and ScheduleTable |
| `src/components/schedule/schedule-table.tsx` | parents prop forwarded to ScheduleCell | ✓ VERIFIED | Line 25: `parents: Array<...>`; line 271: `parents={parents}` to ScheduleCell |
| `src/components/schedule/schedule-cell.tsx` | parents prop, no config import | ✓ VERIFIED | Line 12: `parents: Array<...>`; uses `parents.find()` for display name |
| `src/components/schedule/stats-panel.tsx` | parents prop, computeStats(days, parents) | ✓ VERIFIED | Line 9: `parents: Array<...>` |
| `src/components/schedule/clear-panel.tsx` | childCount prop, no config import | ✓ VERIFIED | Lines 15+18: `childCount: number` prop |
| `src/app/setup/page.tsx` | Server component auth gate + wizard render | ✓ VERIFIED | Auth gate at line 15; redirect-if-onboarded via configExists flag outside catch; renders SetupWizard |
| `src/app/setup/setup-wizard.tsx` | Client orchestrator, 4-step state | ✓ VERIFIED | 107 lines; `"use client"`; useState for step; imports and calls saveWizardConfig |
| `src/app/setup/step-indicator.tsx` | 4 steps with aria-current | ✓ VERIFIED | Perhetiedot, Kalenteri, Tarkista, Valmis; `aria-current="step"` present |
| `src/app/setup/steps/step-family-data.tsx` | Step 1 with 6 fields and Finnish validation | ✓ VERIFIED | 268 lines; isMonday gate; "Aloituspäivän on oltava maanantai"; "+ Lisää lapsi" |
| `src/app/setup/steps/step-calendars.tsx` | Step 2 with listCalendars + Combobox | ✓ VERIFIED | 259 lines; listCalendars() in useEffect; Combobox (Popover+Command); "Mistä löydät" |
| `src/app/setup/steps/step-review.tsx` | Step 3 review + save trigger | ✓ VERIFIED | "Tarkista tiedot"; "Tallenna ja jatka"; "Tallennetaan…" loading state |
| `src/app/setup/steps/step-complete.tsx` | Step 4 completion screen | ✓ VERIFIED | "Asennus valmis!"; Phase 13 hand-off note; `/dashboard` link |
| `src/env.ts` | Only 5 infrastructure vars | ✓ VERIFIED | Exactly 5 vars; 0 PARENT_/APP_ occurrences |
| `.env.example` | Removed legacy vars, kept infra vars | ✓ VERIFIED | GOOGLE_CLIENT_ID and DATABASE_URL present; no PARENT_/APP_ vars |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/config/app.ts` | family_config table | `db.select().from(familyConfig).where(eq(familyConfig.id, 1))` | ✓ WIRED | Lines 37-39: real DB query |
| `src/actions/setup.ts saveWizardConfig` | family_config table | `db.insert(familyConfig).onConflictDoUpdate` | ✓ WIRED | Lines 70-100: insert + conflict update |
| `src/actions/setup.ts listCalendars` | Google Calendar API | `buildGCalClient + calendar.calendarList.list` | ✓ WIRED | Lines 123-125: GCal client + list call |
| `src/app/dashboard/page.tsx` | /setup | `redirect()` in catch block | ✓ WIRED | Line 35: `redirect("/setup")` inside catch |
| `src/actions/schedule.ts requireAuthorizedParent` | family_config via getAppConfig | `config.parents.some(p => p.email === email)` | ✓ WIRED | Uses `await getAppConfig()` then `config.parents.some()` |
| `src/app/dashboard/page.tsx` | DashboardShell | `parents={parentsForUI}` prop | ✓ WIRED | Lines 67-68: both parents and childCount props passed |
| `setup-wizard.tsx` | saveWizardConfig | `import { saveWizardConfig } from '@/actions/setup'` + call | ✓ WIRED | Line 37: awaited call with all wizard data |
| `step-calendars.tsx` | listCalendars | `useEffect → await listCalendars()` | ✓ WIRED | Lines 48-60: useEffect calls listCalendars on mount |
| `src/app/setup/page.tsx` | getAppConfig | try/catch to determine redirect | ✓ WIRED | Lines 20-27: real check for existing config |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `src/config/app.ts` | `row` from `familyConfig` | `db.select().from(familyConfig).where(eq(familyConfig.id, 1))` | Yes — real Drizzle DB query | ✓ FLOWING |
| `src/actions/setup.ts listCalendars` | `items` from `calendarList.list()` | `buildGCalClient(user.email)` + `calendar.calendarList.list()` | Yes — real Google API call | ✓ FLOWING |
| `src/components/schedule/schedule-cell.tsx` | `parents` prop | Traces to `parentsForUI` in `dashboard/page.tsx` via `getAppConfig()` → `familyConfig` DB row | Yes — real data chain | ✓ FLOWING |
| `src/components/schedule/stats-panel.tsx` | `parents` prop | Same chain as schedule-cell | Yes | ✓ FLOWING |
| `src/components/schedule/clear-panel.tsx` | `childCount` prop | `config.children.length` from `getAppConfig()` | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 25 unit tests pass (app.test.ts + setup.test.ts + schedule.test.ts) | `npx vitest run src/config/app.test.ts src/actions/setup.test.ts src/actions/schedule.test.ts` | PASS (25) FAIL (0) | ✓ PASS |
| app.ts exports only getAppConfig, AppConfig, ParentId | `node -e "..."` | `['export type ParentId', 'export interface AppConfig', 'export async function getAppConfig']` | ✓ PASS |
| setup.ts exports saveWizardConfig and listCalendars | `node -e "..."` | `['export type WizardInput', 'export async function saveWizardConfig', 'export async function listCalendars']` | ✓ PASS |
| env.ts has no legacy vars | `grep -c "PARENT_\|APP_CHILDREN\|APP_START_DATE" src/env.ts` | 0 | ✓ PASS |
| generate-app-config.js deleted | `test -f scripts/generate-app-config.js` | DELETED | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| ONBR-03 | 12-04, 12-05 | First parent can configure family setup through a UI wizard | ✓ SATISFIED | 4-step wizard at `/setup`; StepFamilyData, StepCalendars, StepReview, StepComplete all wired; saveWizardConfig called on Step 3 submit; human checkpoint APPROVED per 12-05 SUMMARY |
| ONBR-04 | 12-01, 12-02, 12-05 | Family config stored in DB; APP_PARENT* env vars no longer required | ✓ SATISFIED | `family_config` DB table; `getAppConfig()` reads from it; `src/env.ts` has 0 PARENT_/APP_ vars; `npm run build` passes without legacy vars |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app/setup/steps/step-family-data.tsx` | 181, various | `placeholder=` HTML attribute | ℹ️ Info | Input placeholder copy — not a code stub, expected UI pattern |
| `src/db/reset.ts`, `src/db/seed.ts` | various | Legacy `import config from "@/config/app"` | ⚠️ Warning | Dev utilities only, not production paths; noted in SUMMARY as out of Phase 12 scope |

No blockers found.

### Human Verification Required

The automated checks verify the wizard exists, is wired, and all unit tests pass. The 12-05 SUMMARY documents that the human checkpoint was APPROVED by the developer during Plan 05 execution. However, because full end-to-end verification requires a live browser, Google OAuth session, and Supabase DB with a user's Google tokens row, these remain as human verification items for ongoing confidence.

#### 1. Wizard Happy Path

**Test:** Sign in with Google, navigate to /dashboard (with no family_config row), complete all 4 wizard steps with valid data, click "Siirry aikatauluun"
**Expected:** Dashboard loads showing the schedule grid with parent names and correct child count; DB has a family_config row with entered values
**Why human:** Requires live browser, real Google OAuth, real Supabase DB, and user_google_tokens row for listCalendars to return real calendars

#### 2. Auth Guards

**Test:** Visit /setup while signed out; visit /setup while already onboarded
**Expected:** Signed-out → redirect to /; already-onboarded → redirect to /dashboard
**Why human:** Server-side redirect behavior requires browser session testing

#### 3. Validation Inline Error Messages

**Test:** In Step 1, submit with same email for both parents; try a non-Monday start date
**Expected:** Finnish error messages appear inline per UI-SPEC ("Toisen vanhemman sähköposti ei voi olla sama kuin omasi", "Aloituspäivän on oltava maanantai")
**Why human:** Client-side validation requires browser interaction

### Gaps Summary

No gaps identified. All 14 phase must-haves across all 5 plans are verified at code level. Unit test suite passes (25/25). The phase goal is achieved: the wizard UI exists and is wired, DB tables are created, env vars are removed.

The `human_needed` status reflects that visual flow verification, auth guard testing, and real-browser behavior cannot be confirmed programmatically — not that any gaps were found. Per the 12-05 SUMMARY, the developer ran the full human checkpoint and reported "APPROVED" during Plan 05 execution.

---

_Verified: 2026-05-16_
_Verifier: Claude (gsd-verifier)_
