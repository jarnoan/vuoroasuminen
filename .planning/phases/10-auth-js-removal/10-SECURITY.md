---
phase: 10
slug: auth-js-removal
status: verified
threats_open: 0
asvs_level: 1
created: 2026-05-15
---

# Phase 10 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Developer machine → Supabase Postgres | psql connection over TLS using DATABASE_URL secret | Destructive DDL (DROP TABLE) |
| Repo working tree → Git history | DROP SQL committed to expose migration in audit trail | Migration SQL (intentional) |
| Repo working tree → CI/build | Source deletions must not leave dangling imports breaking TypeScript | TypeScript module graph |
| .env.example (public) → repo readers | Template must not advertise env var names with no effect | Env var names (no secrets) |
| Runtime env validation → process start | env.ts throws on missing GOOGLE_CLIENT_* | Required env var names |
| Production deployment ↔ both parents' browsers | Re-sign-in flow must complete before GCal sync works | OAuth session cookies |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-10-01 | Tampering | DROP migration file itself | mitigate | Committed to git (auditable); SQL wrapped in BEGIN/COMMIT so partial application rolls back | closed |
| T-10-02 | Repudiation | Untracked destructive DB change | mitigate | Migration SQL committed at `.planning/phases/10-auth-js-removal/10-01-DROP.sql`; git commit f2eabf9 | closed |
| T-10-03 | Denial of Service | Dropping users/accounts before Supabase auth verified | mitigate | Pre-flight check on `user_google_tokens` row count (2 rows confirmed before drop) | closed |
| T-10-04 | Information Disclosure | DATABASE_URL leaked into shell history | accept | Sourced from .env.local, not echoed; accepted developer-machine threat model | closed |
| T-10-05 | Elevation of Privilege | Migration grants no new permissions | n/a | DROP TABLE creates no roles, policies, or grants | closed |
| T-10-06 | Tampering | Stale references to deleted modules | mitigate | Plan 04 build fails phase if any TS reference to @/auth, next-auth, or @auth/drizzle-adapter survives; grep gate passed | closed |
| T-10-07 | Information Disclosure | Test mock leaking into prod bundle | n/a | vi.mock is vitest-only devDependency; Next.js excludes *.test.ts from production builds | closed |
| T-10-08 | Denial of Service | Middleware matcher misconfiguration | mitigate | Exact matcher `["/((?!_next/static|_next/image|favicon.ico).*)"]` at middleware.ts:29; build verified | closed |
| T-10-09 | Tampering | Empty api/auth directory left behind | mitigate | rmdir on directory tree; `src/app/api/auth/` confirmed absent | closed |
| T-10-10 | Elevation of Privilege | Auth.js code paths re-enabled via stale imports | mitigate | All 6 Auth.js source files deleted; build catches any orphan import | closed |
| T-10-11 | Spoofing | Stale AUTH_* env vars in .env.example | mitigate | All AUTH_* names removed; replaced with GOOGLE_CLIENT_* names in .env.example | closed |
| T-10-12 | Tampering | Future developer accidentally re-importing next-auth | mitigate | Package uninstalled from package.json and node_modules | closed |
| T-10-13 | Repudiation | No-op db:clear-tokens script pointing to deleted file | mitigate | Script entry removed from package.json scripts | closed |
| T-10-14 | Information Disclosure | GOOGLE_CLIENT_SECRET still required | mitigate | env.ts requires GOOGLE_CLIENT_SECRET; missing-secret deploys throw at startup | closed |
| T-10-15 | Denial of Service | Renaming env vars without updating deployment | mitigate | Explicit checkpoint in 10-03-SUMMARY.md; operator confirmed vars renamed in Vercel + .env.local | closed |
| T-10-16 | Elevation of Privilege | AUTH_SECRET removal | mitigate | AUTH_SECRET absent from env.ts and .env.example; eliminates stale secret from env surface | closed |
| T-10-17 | Spoofing | Stale browser cookie from old Auth.js session | mitigate | Human verification used fresh incognito sessions for both parents | closed |
| T-10-18 | Tampering | Surviving import of next-auth in bundle | mitigate | Grep gate passed in 10-04-SUMMARY.md Task 1; zero matches across full Auth.js token list | closed |
| T-10-19 | Repudiation | Phase marked complete without operator verification | mitigate | Blocking human checkpoint in Plan 04 Task 3; operator `approved` recorded 2026-05-15 | closed |
| T-10-20 | Information Disclosure | Old Auth.js JWT cookies resolve to user in middleware | mitigate | middleware.ts:15 uses `supabase.auth.getUser()` exclusively; Auth.js cookie unparseable by Supabase | closed |
| T-10-21 | Denial of Service | One parent fails to re-sign-in | mitigate | Both parents (Father and Mother) signed in before operator approval per 10-04-SUMMARY.md | closed |
| T-10-22 | Elevation of Privilege | RLS bypass via deleted /api/auth route | mitigate | Route directory deleted, matcher updated at middleware.ts:29, /api/auth/* returns 404 (operator-confirmed) | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · n/a (not applicable)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-10-01 | T-10-04 | DATABASE_URL sourced from .env.local and not echoed to shell; standard developer-machine threat model; no remediation required | Jarno Antikainen | 2026-05-15 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-15 | 22 | 22 | 0 | gsd-security-auditor (claude-sonnet-4-6) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / n/a)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-15
