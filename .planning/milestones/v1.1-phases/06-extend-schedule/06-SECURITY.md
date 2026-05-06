---
phase: 06
slug: extend-schedule
status: verified
threats_open: 0
asvs_level: 1
created: 2026-05-06
---

# Phase 06 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Browser → Server Action `extendSchedule` | Untrusted JSON input crosses here | `scheduleEndDate` (string), `weeks` (number), `endDate` (string) |
| Server Action → Database | Auth established by `requireAuthorizedParent()`; SQL parameterized via Drizzle | `childId`, `day`, `assignedTo` — not PII, low sensitivity |
| Server Action → `generateDefaultEntries` | Pure in-process call | No boundary — internal only |
| Client Component → Server Action | Auth + input validation enforced server-side | Same as above |
| Client Component → `router.replace(?viewStart=...)` | `newStartDate` comes from server response, not user input | ISO date string — safe |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-06-01 | S — Spoofing | `extendSchedule` auth check | mitigate | `requireAuthorizedParent()` first line of action body (`schedule.ts:106`) | closed |
| T-06-02 | T — Tampering | Client-supplied `weeks` and `endDate` | mitigate | `weeks`: integer 1..52; `endDate`: valid ISO, ≤ 730 days from `scheduleEndDate` (`schedule.ts:113-116, 120-121, 128, 134`) | closed |
| T-06-03 | T — Tampering | SQL injection via input fields | mitigate | All writes via Drizzle typed `.values(insertValues)`; no raw SQL, no string concatenation (`schedule.ts:153, 165-175`) | closed |
| T-06-04 | R — Repudiation | No audit trail for who extended | accept | Deferred to AUDT-01 (v1.1); two-user app, inter-parent trust acceptable | closed |
| T-06-05 | I — Info disclosure | Auth-error specifics in errors | accept | Errors are "Not authenticated"/"Forbidden" — match existing pattern; no PII or token data | closed |
| T-06-06 | D — DoS | Massive `weeks` / far-future `endDate` | mitigate | Hard caps: `weeks ≤ 52`, `endDate ≤ 730 days`; worst-case 1,460 rows (`schedule.ts:128, 134`) | closed |
| T-06-07 | D — DoS | Repeated extension calls inflate row count | mitigate | `.onConflictDoNothing()` on unique `(childId, day)` index — idempotent on replay (`schedule.ts:175`) | closed |
| T-06-08 | E — EoP | Non-parent caller invokes action | mitigate | `requireAuthorizedParent()` checks `config.parents` email allowlist (`schedule.ts:106, 20-21`) | closed |
| T-06-09 | T — Tampering | Client-side validation bypass | mitigate | Server-side is source of truth; client `min=1 max=52` is UX hint only (`extend-panel.tsx:131-132`, enforced at `schedule.ts:134`) | closed |
| T-06-10 | I — Info disclosure | Error messages shown to user | accept | Finnish user-facing strings only; no stack traces or DB internals leaked | closed |
| T-06-11 | T — Tampering | Untrusted `searchParams` reflected into `router.replace` | mitigate | Component sets `viewStart` to `result.newStartDate` (server-returned ISO date only); user-typed strings never reflected into URL (`extend-panel.tsx:90`) | closed |
| T-06-12 | E — EoP | Trigger button visible to non-parent | accept | Route is auth-guarded server-side; action blocks non-parents via T-06-01/T-06-08 | closed |
| T-06-13 | R — Repudiation | No client-side audit of who triggered extend | accept | Same rationale as T-06-04; deferred to AUDT-01 | closed |
| T-06-14 | D — DoS | Spamming Vahvista clicks fires multiple parallel actions | mitigate | `disabled={isPending \|\| !rangeEnd}` on Vahvista; `disabled={isPending}` on Peruuta; `finally` always resets pending state (`extend-panel.tsx:208, 217, 95`) | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-06-01 | T-06-04, T-06-13 | No audit trail for extend actions — deferred to AUDT-01 in v1.1. Two-user app; database-level trust between parents is acceptable at this stage. | Jarno Antikainen | 2026-05-06 |
| AR-06-02 | T-06-05, T-06-10 | Error messages use user-friendly Finnish strings; no internal data exposed. Pattern matches existing actions. | Jarno Antikainen | 2026-05-06 |
| AR-06-03 | T-06-12 | Panel only renders for authenticated dashboard users; server-side auth blocks any call regardless. | Jarno Antikainen | 2026-05-06 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-06 | 14 | 14 | 0 | gsd-security-auditor (claude-sonnet-4-6) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-06
