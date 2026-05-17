# Roadmap: Vuoroasuminen

## Milestones

- ✅ **v1.0 MVP** — Phases 1–4 (shipped 2026-04-20)
- ✅ **v1.1 Schedule Window Control** — Phases 5–7 (shipped 2026-05-06)
- ✅ **v1.2 Supabase Auth Migration** — Phases 8–10 (shipped 2026-05-15)
- **v1.3 Deploy + Onboarding** — Phases 11–13 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1–4) — SHIPPED 2026-04-20</summary>

- [x] Phase 1: Foundation (2/2 plans) — completed 2026-04-04
- [x] Phase 2: Schedule Table UI (3/3 plans) — completed 2026-04-05
- [x] Phase 3: Draft/Publish + Statistics (2/2 plans) — completed 2026-04-07
- [x] Phase 4: Google Calendar Sync (2/2 plans) — completed 2026-04-12

Full archive: [.planning/milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

<details>
<summary>✅ v1.1 Schedule Window Control (Phases 5–7) — SHIPPED 2026-05-06</summary>

- [x] Phase 5: View Window Control (4/4 plans) — completed 2026-05-04
- [x] Phase 6: Extend Schedule (2/2 plans) — completed 2026-05-05
- [x] Phase 7: Clear Entries (3/3 plans) — completed 2026-05-06

Full archive: [.planning/milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)

</details>

<details>
<summary>✅ v1.2 Supabase Auth Migration (Phases 8–10) — SHIPPED 2026-05-15</summary>

- [x] Phase 8: Supabase Auth Stack (8/8 plans) — completed 2026-05-10
- [x] Phase 9: Row Level Security (4/4 plans) — completed 2026-05-14
- [x] Phase 10: Auth.js Removal (4/4 plans) — completed 2026-05-15

Full archive: [.planning/milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)

</details>

### v1.3 Deploy + Onboarding (Phases 11–13)

- [x] **Phase 11: Production Deploy** - Build fixes + Vercel deployment + Google OAuth + Supabase auth configuration (completed 2026-05-16)
- [x] **Phase 12: Onboarding Wizard** - DB-driven family config replaces env vars; wizard UI for first parent (completed 2026-05-16)
- [ ] **Phase 13: Invite + Access Gate** - Invite link system for second parent; middleware gate enforcing setup completion

## Phase Details

### Phase 11: Production Deploy
**Goal**: The app is live at a stable production URL with Google OAuth and Supabase Auth fully configured for the production domain.
**Depends on**: Phase 10 (complete)
**Requirements**: DPLY-01, DPLY-02, DPLY-03, DPLY-04, DPLY-05
**Success Criteria** (what must be TRUE):
  1. Visiting the production URL loads the app (Vercel auto-deploys from main branch)
  2. Both parents can sign in with Google on the production domain without OAuth errors
  3. Supabase Auth accepts the production callback URL and issues a valid session
  4. Running the build with a missing required env var exits with a non-zero status and a clear error message (not a silent undefined)
  5. Next.js build completes without middleware-related errors (middleware.ts renamed to proxy.ts per Next.js 16 requirement)
**Plans**: 3 plans
- [x] 11-01-PLAN.md — Build script fix (exit 1 + dotenv) and .env.example documentation update (DPLY-04)
- [x] 11-02-PLAN.md — Rename src/middleware.ts to src/proxy.ts for Next.js 16 compliance (DPLY-05)
- [x] 11-03-PLAN.md — Vercel deploy, OAuth/Supabase configuration, end-to-end sign-in verification (DPLY-01, DPLY-02, DPLY-03)
**UI hint**: no

### Phase 12: Onboarding Wizard
**Goal**: First parent can configure parent names, emails, children names, and Google Calendar IDs through a UI wizard; config is stored in the DB and the app reads it at runtime instead of env vars.
**Depends on**: Phase 11
**Requirements**: ONBR-03, ONBR-04
**Success Criteria** (what must be TRUE):
  1. First parent can complete the setup wizard — entering parent names, emails, children names, and calendar IDs — without editing any env file or config code
  2. After wizard completion, the app reads parent and children config from the DB (APP_PARENT* env vars are no longer required for the app to function)
  3. Config entered through the wizard is immediately visible to both parents on next page load (it is stored in the shared DB, not locally)
**Plans**: 5 plans
- [x] 12-01-PLAN.md — Schema (familyConfig + inviteTokens) + drizzle-kit push + RLS policies + getAppConfig + setup Server Actions (ONBR-04)
- [x] 12-02-PLAN.md — Server-side call site refactor: gcal/sync, queries, generate-default, actions/schedule, dashboard redirect, delete generate-app-config (ONBR-04)
- [x] 12-03-PLAN.md — Client-side refactor: thread parents/childCount props from dashboard → DashboardShell → ScheduleCell/StatsPanel/ClearPanel (ONBR-04)
- [x] 12-04-PLAN.md — /setup wizard UI: 4-step Finnish wizard + shadcn primitives + listCalendars + saveWizardConfig wiring (ONBR-03)
- [x] 12-05-PLAN.md — Remove legacy env vars from src/env.ts + .env.example + end-to-end human verification checkpoint (ONBR-03, ONBR-04)
**UI hint**: yes

### Phase 13: Invite + Access Gate
**Goal**: First parent can share an invite link; second parent opens it, signs in with Google, and gets app access automatically. Unauthenticated or un-onboarded users are redirected to the appropriate setup step.
**Depends on**: Phase 12
**Requirements**: ONBR-05, ONBR-06, ONBR-07
**Success Criteria** (what must be TRUE):
  1. First parent can generate a shareable invite URL from within the app
  2. Second parent opens the invite URL, signs in with Google, and lands on the schedule view — no manual config or admin action required
  3. An invite token that has expired or has already been used is rejected with a clear error message
  4. Visiting the schedule URL without being signed in redirects to the sign-in page
  5. Visiting the schedule URL signed in but with onboarding incomplete redirects to the setup wizard
**Plans**: 4 plans
- [x] 13-P01-PLAN.md — generateInviteToken + getActiveInviteToken Server Actions + /invite/[token] acceptance page (ONBR-05, ONBR-06)
- [x] 13-P02-PLAN.md — StepComplete invite URL display + Dashboard invite section with Parent B join detection (ONBR-05)
- [x] 13-P03-PLAN.md — auth/callback invite cookie consumption + auth/error unauthorized_email variant (ONBR-06)
- [x] 13-P04-PLAN.md — proxy.ts three-tier middleware gate: auth + family_config + email match (ONBR-07)
**UI hint**: yes

## Coverage

- Requirements: 10 total
- Mapped: 10
- Unmapped: 0 ✓

| Requirement | Phase |
|-------------|-------|
| DPLY-01 | Phase 11 |
| DPLY-02 | Phase 11 |
| DPLY-03 | Phase 11 |
| DPLY-04 | Phase 11 |
| DPLY-05 | Phase 11 |
| ONBR-03 | Phase 12 |
| ONBR-04 | Phase 12 |
| ONBR-05 | Phase 13 |
| ONBR-06 | Phase 13 |
| ONBR-07 | Phase 13 |

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 2/2 | Complete | 2026-04-04 |
| 2. Schedule Table UI | v1.0 | 3/3 | Complete | 2026-04-05 |
| 3. Draft/Publish + Statistics | v1.0 | 2/2 | Complete | 2026-04-07 |
| 4. Google Calendar Sync | v1.0 | 2/2 | Complete | 2026-04-12 |
| 5. View Window Control | v1.1 | 4/4 | Complete | 2026-05-04 |
| 6. Extend Schedule | v1.1 | 2/2 | Complete | 2026-05-05 |
| 7. Clear Entries | v1.1 | 3/3 | Complete | 2026-05-06 |
| 8. Supabase Auth Stack | v1.2 | 8/8 | Complete | 2026-05-10 |
| 9. Row Level Security | v1.2 | 4/4 | Complete | 2026-05-14 |
| 10. Auth.js Removal | v1.2 | 4/4 | Complete | 2026-05-15 |
| 11. Production Deploy | v1.3 | 3/3 | Complete    | 2026-05-16 |
| 12. Onboarding Wizard | v1.3 | 5/5 | Complete    | 2026-05-16 |
| 13. Invite + Access Gate | v1.3 | 0/4 | Not started | - |
