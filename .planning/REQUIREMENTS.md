# Requirements — v1.2 Supabase Auth Migration

**Milestone:** v1.2  
**Goal:** Replace Auth.js v5 with Supabase Auth to unify the auth stack and enable Row Level Security on all domain tables.  
**Last updated:** 2026-05-09

---

## v1.2 Requirements

### Supabase Auth (SAUTH)

- [x] **SAUTH-01**: User can sign in with Google via Supabase OAuth flow (PKCE)
- [x] **SAUTH-02**: User session persists across page refreshes via Supabase cookie-based session
- [x] **SAUTH-03**: User can sign out
- [x] **SAUTH-04**: Unauthenticated users are redirected to sign-in when accessing protected routes
- [x] **SAUTH-05**: Sign-in always forces `access_type:offline` + `prompt:consent` so Google re-issues a refresh token on every sign-in (prevents `invalid_grant`)
- [x] **SAUTH-06**: Google refresh token is captured from the OAuth callback and stored in `user_google_tokens` table; failed capture redirects to an explicit error page (not silent dashboard redirect)
- [x] **SAUTH-07**: Dashboard shows a dismissible warning when the calendar owner's token row is absent (GCal sync would fail on publish)

### GCal Owner Model (GCAL)

- [x] **GCAL-01**: GCal sync uses `ownerEmail` from calendar config to look up credentials, regardless of which parent triggers publish
- [x] **GCAL-02**: `app.ts` calendar config includes an `ownerEmail` field per calendar entry

### Row Level Security (RLS)

- [ ] **RLS-01**: RLS enabled on all domain tables (`children`, `schedules`, `schedule_entries`, `gcal_events`) — unauthenticated requests return no data
- [ ] **RLS-02**: Any authenticated user can read and write all rows on domain tables (v1.2 baseline; per-household isolation is future work)
- [ ] **RLS-03**: Each user can read and write only their own row in `user_google_tokens`
- [ ] **RLS-04**: Supabase Realtime subscription uses authenticated Supabase JWT so RLS is enforced on live updates

### Auth.js Cleanup (CLEAN)

- [ ] **CLEAN-01**: `next-auth` and `@auth/drizzle-adapter` packages uninstalled
- [ ] **CLEAN-02**: Auth.js database tables dropped via safe migration (FK order: `verificationTokens` → `sessions` → `accounts` → `users`)
- [ ] **CLEAN-03**: Auth.js environment variables removed (`AUTH_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` replaced by Supabase Dashboard config)

---

## Future Requirements

- Household/family model for multi-tenant data isolation (AUDT-adjacent, SaaS foundation)
- Per-cell change history: who changed a cell and when (AUDT-01, AUDT-02) — depends on `auth.uid()` being available, enabled by this milestone
- Onboarding wizard: first-run UI to configure parents, children, and calendar IDs (ONBR-01, ONBR-02)

---

## Out of Scope

- Per-household RLS isolation — v1.2 uses `USING (true)` for all authenticated users; household scoping requires a family model (future milestone)
- Email/password auth — Google OAuth only
- Multiple OAuth providers — Google only
- Custom JWT claims — Supabase Auth default claims are sufficient for v1.2 RLS policies

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SAUTH-01 | Phase 8 | Complete |
| SAUTH-02 | Phase 8 | Complete |
| SAUTH-03 | Phase 8 | Complete |
| SAUTH-04 | Phase 8 | Complete |
| SAUTH-05 | Phase 8 | Complete |
| SAUTH-06 | Phase 8 | Complete |
| SAUTH-07 | Phase 8 | Complete |
| GCAL-01 | Phase 8 | Complete |
| GCAL-02 | Phase 8 | Complete |
| RLS-01 | Phase 9 | Pending |
| RLS-02 | Phase 9 | Pending |
| RLS-03 | Phase 9 | Pending |
| RLS-04 | Phase 9 | Pending |
| CLEAN-01 | Phase 10 | Pending |
| CLEAN-02 | Phase 10 | Pending |
| CLEAN-03 | Phase 10 | Pending |
