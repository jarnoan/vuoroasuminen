# Requirements: Vuoroasuminen

**Defined:** 2026-05-16
**Core Value:** Both parents always see the same up-to-date custody schedule, reflected in their Google Calendars, without manual coordination.

## v1.3 Requirements

### Deploy

- [x] **DPLY-01**: User can access the app at a stable production URL (Vercel linked to repo, main branch auto-deploys)
- [x] **DPLY-02**: Google OAuth sign-in works on the production domain (Supabase callback URL registered in Google Cloud Console)
- [x] **DPLY-03**: Supabase Auth accepts sign-ins from the production domain (Site URL + redirect allowlist configured)
- [x] **DPLY-04**: Build fails loudly when required env vars are missing (generate-app-config.js exits 1, not 0)
- [x] **DPLY-05**: Next.js 16 middleware compliance (middleware.ts renamed to proxy.ts)

### Onboarding

- [ ] **ONBR-03**: First parent can configure family setup through a UI wizard (parent names, emails, children names, calendar IDs — no env file editing required)
- [ ] **ONBR-04**: Family config is stored in DB and read at runtime (APP_PARENT* env vars no longer required for app function)
- [ ] **ONBR-05**: First parent can generate a shareable invite link for the second parent
- [ ] **ONBR-06**: Second parent can accept the invite link, sign in with Google, and access the app automatically
- [ ] **ONBR-07**: App redirects unauthenticated or un-onboarded users to the setup flow (schedule view requires both parents configured)

## Future Requirements

### Onboarding

- **ONBR-01**: *(Being implemented in v1.3 as ONBR-03 through ONBR-07)*
- **ONBR-02**: Mobile-optimized layout refinements

### Audit

- **AUDT-01**: Per-cell change history: who changed a cell
- **AUDT-02**: Per-cell change history: when a cell was changed

## Out of Scope

| Feature | Reason |
|---------|--------|
| Staging environment | Deferred — adds infrastructure complexity; production-only deploy is sufficient for a two-user app |
| Smoke test as a formal phase | Done manually by both parents after deploy; not a gated requirement |
| Email invite | Requires email sending infrastructure; share link is sufficient for cooperative co-parents |
| Multiple families per instance | Two-parent design is intentional |
| Supabase Pro upgrade | Operational task, not a code requirement; tracked in STATE.md |
| Google OAuth app verification | Operational task with 3–5 day wait; tracked in STATE.md |
| Git history scrub (CR-01) | Deferred to after deploy; tracked in STATE.md |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DPLY-01 | Phase 11 | Complete |
| DPLY-02 | Phase 11 | Complete |
| DPLY-03 | Phase 11 | Complete |
| DPLY-04 | Phase 11 | Complete |
| DPLY-05 | Phase 11 | Complete |
| ONBR-03 | Phase 12 | Pending |
| ONBR-04 | Phase 12 | Pending |
| ONBR-05 | Phase 13 | Pending |
| ONBR-06 | Phase 13 | Pending |
| ONBR-07 | Phase 13 | Pending |

**Coverage:**
- v1.3 requirements: 10 total
- Mapped to phases: 10 (Phases 11–13)
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-16*
*Last updated: 2026-05-16 after v1.3 roadmap creation*
