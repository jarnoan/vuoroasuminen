---
phase: 14
slug: realtime-reliability-mobile-baseline
status: verified
threats_open: 0
asvs_level: 1
created: 2026-05-18
---

# Phase 14 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| client → Server Action | `getScheduleDays` is a `"use server"` function callable from client components | ScheduleDay[] (authenticated family's schedule data) |
| client visibilitychange → Server Action | `handleVisibilityChange` calls `getScheduleDays` when tab becomes visible | ScheduleDay[] (same data as above) |
| Server Action → Supabase DB | `getScheduleDays` queries `schedule_entries` via Drizzle; auth guard runs first | Row-level schedule data scoped to family by RLS |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-14-01 | Elevation of Privilege | `getScheduleDays` Server Action | mitigate | `requireAuthorizedParent()` is the first call at `src/actions/schedule.ts:240`; unauthenticated/unauthorized callers receive an error before any DB query runs | closed |
| T-14-02 | Information Disclosure | `getScheduleDays` return value | accept | Returns the same schedule data the authenticated parent already sees on screen; Supabase RLS policies additionally scope the DB query to the family's rows | closed |
| T-14-03 | Denial of Service | `handleVisibilityChange` | accept | Re-fetches on every hidden→visible transition; with two users and a cheap indexed DB query, load is negligible; no rate limiting warranted | closed |
| T-14-04 | Spoofing | `supabase.realtime.setAuth` | accept | Token sourced from `supabase.auth.getSession()` (localStorage, managed by Supabase auth client); the same JWT the user already holds — no new attack surface | closed |
| T-14-05 | Information Disclosure | `onRefresh` callback | accept | Delivers the same `ScheduleDay[]` data the authenticated user already sees; data stays within the same browser context and does not cross trust boundaries | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-14-01 | T-14-02 | `getScheduleDays` returns data the authenticated parent already has view access to; RLS is the enforcement layer at DB level | Jarno Antikainen | 2026-05-18 |
| AR-14-02 | T-14-03 | Two-user app with cheap indexed query; re-fetch on tab focus is a standard pattern; DoS risk is negligible without a high-volume multi-tenant scenario | Jarno Antikainen | 2026-05-18 |
| AR-14-03 | T-14-04 | `setAuth` token is the same JWT already held by the authenticated user; Supabase auth client manages token lifecycle; no escalation possible | Jarno Antikainen | 2026-05-18 |
| AR-14-04 | T-14-05 | `onRefresh` callback delivers data to the same browser context that made the request; no cross-boundary disclosure | Jarno Antikainen | 2026-05-18 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-18 | 5 | 5 | 0 | gsd-secure-phase (automated) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-18
