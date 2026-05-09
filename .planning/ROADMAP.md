# Roadmap: Vuoroasuminen

## Milestones

- ✅ **v1.0 MVP** — Phases 1–4 (shipped 2026-04-20)
- ✅ **v1.1 Schedule Window Control** — Phases 5–7 (shipped 2026-05-06)
- 🚧 **v1.2 Supabase Auth Migration** — Phases 8–10 (in progress)

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

### 🚧 v1.2 Supabase Auth Migration (In Progress)

**Milestone Goal:** Replace Auth.js v5 with Supabase Auth and enable Row Level Security on all domain tables.

- [ ] **Phase 8: Supabase Auth Stack** - Wire Supabase Auth in parallel with Auth.js (non-destructive); validate end-to-end before proceeding
- [ ] **Phase 9: Row Level Security** - Enable RLS on all domain tables; enforce authenticated access only
- [ ] **Phase 10: Auth.js Removal** - Drop Auth.js tables, uninstall packages, remove dead config and imports

## Phase Details

### Phase 8: Supabase Auth Stack
**Goal**: Users can sign in via Supabase Google OAuth and GCal sync works end-to-end against the new token store
**Depends on**: Phase 7 (Auth.js still present; this phase runs in parallel without removing it)
**Requirements**: SAUTH-01, SAUTH-02, SAUTH-03, SAUTH-04, SAUTH-05, SAUTH-06, SAUTH-07, GCAL-01, GCAL-02
**Success Criteria** (what must be TRUE):
  1. User can sign in with Google via the new Supabase OAuth flow (PKCE) and is redirected to the dashboard
  2. User session survives a full browser refresh (cookie-based Supabase session persists)
  3. A row exists in `user_google_tokens` after sign-in; the row contains a non-null `refresh_token`
  4. Publishing the schedule triggers GCal sync using the `ownerEmail` token — calendar events are created correctly regardless of which parent pressed publish
  5. Dashboard shows a dismissible warning banner when the calendar owner's token row is absent
  6. GATE — these five criteria must all be verified before Phase 9 begins; RLS must not be enabled until GCal sync is confirmed working against `user_google_tokens`
**Plans**: TBD
**UI hint**: yes

### Phase 9: Row Level Security
**Goal**: All domain tables are protected by RLS — unauthenticated clients receive no data and Realtime respects the same policies
**Depends on**: Phase 8 (GATE must be passed)
**Requirements**: RLS-01, RLS-02, RLS-03, RLS-04
**Success Criteria** (what must be TRUE):
  1. An unauthenticated HTTP request to any domain table endpoint returns no rows (blocked by RLS policy)
  2. An authenticated user can read and write all rows on domain tables (`children`, `schedules`, `schedule_entries`, `gcal_events`)
  3. Each user can read and write only their own row in `user_google_tokens`; attempting to access the other parent's row returns no data
  4. Supabase Realtime live updates continue to work correctly for both parents after the authenticated JWT is passed to the subscription
**Plans**: TBD

### Phase 10: Auth.js Removal
**Goal**: Auth.js is fully removed — packages uninstalled, schema tables dropped, all import sites cleaned
**Depends on**: Phase 9
**Requirements**: CLEAN-01, CLEAN-02, CLEAN-03
**Success Criteria** (what must be TRUE):
  1. `next-auth` and `@auth/drizzle-adapter` are absent from `package.json` and `node_modules`
  2. Auth.js database tables (`verificationTokens`, `sessions`, `accounts`, `users`) are dropped from the database; no orphaned FK constraints remain
  3. All Auth.js environment variables (`AUTH_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`) are removed from `.env` and deployment config
  4. Both parents have re-signed in under the new auth stack and GCal sync works correctly on first publish after deployment
**Plans**: TBD

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
| 8. Supabase Auth Stack | v1.2 | 0/? | Not started | - |
| 9. Row Level Security | v1.2 | 0/? | Not started | - |
| 10. Auth.js Removal | v1.2 | 0/? | Not started | - |
