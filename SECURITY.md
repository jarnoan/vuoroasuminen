# SECURITY.md — Phase 10: auth-js-removal

**Generated:** 2026-05-15
**ASVS Level:** 1
**Phase:** 10 — auth-js-removal
**Threats Closed:** 20/20
**Threats Open:** 0/20
**Block Condition:** critical (none triggered)

---

## Threat Verification Results

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-10-01 | Tampering | mitigate | CLOSED | `.planning/phases/10-auth-js-removal/10-01-DROP.sql` exists and is committed to git; file contains `BEGIN;` / `COMMIT;` wrapping all 4 DROP statements |
| T-10-02 | Repudiation | mitigate | CLOSED | DROP.sql committed at `.planning/phases/10-auth-js-removal/10-01-DROP.sql`; git log records f2eabf9 with audit trail |
| T-10-03 | Denial of Service | mitigate | CLOSED | 10-01-SUMMARY.md records pre-flight check: `user_google_tokens` had 2 rows before drop; migration proceeded only after gate passed |
| T-10-04 | Information Disclosure | accept | CLOSED | Accepted: DATABASE_URL sourced from .env.local, not echoed; standard developer-machine threat — see accepted risks log below |
| T-10-05 | Elevation of Privilege | n/a | CLOSED | DROP TABLE creates no roles, grants, or policies; claim is reasonable |
| T-10-06 | Tampering | mitigate | CLOSED | Repo-wide grep returns zero Auth.js references in all tracked `.ts`/`.tsx`/`.js`/`.json` files; build exits 0 (10-04-SUMMARY.md Task 1 + Task 2) |
| T-10-07 | Information Disclosure | n/a | CLOSED | `vi.mock` is vitest-only; Next.js production bundle excludes `*.test.ts` files by design; claim is reasonable |
| T-10-08 | Denial of Service | mitigate | CLOSED | `src/middleware.ts:29` — matcher is exactly `["/((?!_next/static|_next/image|favicon.ico).*)"]`; no `api/auth` carveout; build exits 0 |
| T-10-09 | Tampering | mitigate | CLOSED | `src/app/api/auth/` directory confirmed absent (`test -d` returns non-zero); `rmdir` in Plan 02 Task 1 succeeded |
| T-10-10 | Elevation of Privilege | mitigate | CLOSED | All six Auth.js source files confirmed deleted; build exits 0 with no missing-module errors (10-04-SUMMARY.md) |
| T-10-11 | Spoofing | mitigate | CLOSED | `.env.example` contains zero `AUTH_*` names; `GOOGLE_CLIENT_ID=` and `GOOGLE_CLIENT_SECRET=` present at lines 4–5 |
| T-10-12 | Tampering | mitigate | CLOSED | `package.json` has no `next-auth` or `@auth/drizzle-adapter` in dependencies; `node_modules/next-auth` absent |
| T-10-13 | Repudiation | mitigate | CLOSED | `db:clear-tokens` script absent from `package.json` scripts (verified by `npm pkg` check: false) |
| T-10-14 | Information Disclosure | mitigate | CLOSED | `src/env.ts:6–7` — `GOOGLE_CLIENT_SECRET` is in `REQUIRED_ENV_VARS`; missing-secret deploys throw at startup |
| T-10-15 | Denial of Service | mitigate | CLOSED | Explicit operator reminder recorded in 10-03-SUMMARY.md "Operator Reminder" section; checkpoint confirmed in Plan 04 Task 3 |
| T-10-16 | Elevation of Privilege | mitigate | CLOSED | `AUTH_SECRET` absent from `src/env.ts` and `.env.example`; grep over src/ returns zero hits for `AUTH_SECRET` |
| T-10-17 | Spoofing | mitigate | CLOSED | 10-04-SUMMARY.md Task 3 records human verification using fresh incognito sessions for both parents |
| T-10-18 | Tampering | mitigate | CLOSED | Repo-wide grep gate passed (10-04-SUMMARY.md Task 1); zero matches for full Auth.js token list in tracked source |
| T-10-19 | Repudiation | mitigate | CLOSED | 10-04-SUMMARY.md Task 3 records operator reply `approved` received 2026-05-15 |
| T-10-20 | Information Disclosure | mitigate | CLOSED | `src/middleware.ts:15` calls `supabase.auth.getUser()` exclusively; no Auth.js cookie parsing present |
| T-10-21 | Denial of Service | mitigate | CLOSED | 10-04-SUMMARY.md Task 3 records both Father and Mother completed sign-in before approval |
| T-10-22 | Elevation of Privilege | mitigate | CLOSED | `src/app/api/auth/` directory deleted; middleware matcher updated; `/api/auth/*` returns 404 confirmed by operator in Task 3 step 4 |

---

## Accepted Risks Log

| Threat ID | Category | Rationale | Accepted By | Date |
|-----------|----------|-----------|-------------|------|
| T-10-04 | Information Disclosure | DATABASE_URL is sourced from `.env.local` and is never echoed to stdout during migration. Shell history exposure of secrets via `.env.local` is a standard developer-machine threat that cannot be fully eliminated without hardware security key workflows. The two-parent, private-use nature of this application makes this risk acceptable at ASVS Level 1. | Phase 10 plan author | 2026-05-15 |

---

## N/A Dispositions

| Threat ID | Claim | Assessment |
|-----------|-------|------------|
| T-10-05 | DROP TABLE creates no roles, grants, or permissions | Confirmed reasonable: SQL `DROP TABLE` DDL removes table objects only; no `GRANT`, `CREATE ROLE`, or `ALTER POLICY` statements present in `10-01-DROP.sql` |
| T-10-07 | `vi.mock` does not leak into production bundle | Confirmed reasonable: Next.js production build (`npm run build`) excludes all `*.test.ts` files; vitest is a devDependency not present in the production bundle |

---

## Unregistered Threat Flags

The `## Threat Flags` sections of the SUMMARY files contain no unregistered flags. The 10-02-SUMMARY.md `## Threat Flags` section explicitly states no new network endpoints, auth paths, or schema changes were introduced, and maps its observations directly to registered threats T-10-08 and T-10-09.

The 10-04-SUMMARY.md `## Threat Surface Scan` section confirms no new network endpoints, auth paths, or schema changes were introduced by the verification plan.

**Unregistered flags: none.**

---

## Phase Disposition

**SECURED** — all 20 threats verified closed. Phase 10 auth-js-removal is auditable and shippable.
