---
phase: 06-extend-schedule
audited: 2026-05-06
asvs_level: 1
auditor: gsd-security-auditor
result: SECURED
threats_total: 14
threats_closed: 14
threats_open: 0
---

# Security Audit — Phase 06: Extend Schedule

## Result: SECURED

**Threats Closed:** 14/14
**ASVS Level:** 1

---

## Threat Verification

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-06-01 | S — Spoofing | mitigate | CLOSED | src/actions/schedule.ts:106 — `await requireAuthorizedParent()` is first executable statement in `extendSchedule` |
| T-06-02 | T — Tampering | mitigate | CLOSED | schedule.ts:113-116 `parseISO`+`isValid` on `scheduleEndDate`; :120-121 `parseISO`+`isValid` on `endDate`; :134 `!Number.isInteger(weeks) \|\| weeks < 1 \|\| weeks > 52`; :128 `daysDelta > 730` |
| T-06-03 | T — Tampering | mitigate | CLOSED | schedule.ts:153,165-175 — all DB operations via `db.insert(...).values(insertValues)` with typed Drizzle builder; no raw SQL or string concatenation; string inputs parsed with `parseISO` before use |
| T-06-04 | R — Repudiation | accept | CLOSED | Accepted: deferred to AUDT-01; two-user app with inherent inter-parent trust acceptable at v1.1 |
| T-06-05 | I — Info disclosure | accept | CLOSED | Accepted: auth errors are "Not authenticated"/"Forbidden" (schedule.ts:19,21); validation errors are Finnish user-facing strings; no PII or token data in any error path |
| T-06-06 | D — DoS | mitigate | CLOSED | schedule.ts:134 `weeks > 52`; :128 `daysDelta > 730`; worst-case 730 days × 2 children = 1,460 rows — bounded within batch-insert capacity |
| T-06-07 | D — DoS | mitigate | CLOSED | schedule.ts:175 — `.onConflictDoNothing()` on unique index `(childId, day)`; replaying the same range inserts zero new rows |
| T-06-08 | E — EoP | mitigate | CLOSED | schedule.ts:106 — `requireAuthorizedParent()` checks `config.parents` email allowlist (schedule.ts:20-21); same guard as all other actions |
| T-06-09 | T — Tampering | mitigate | CLOSED | extend-panel.tsx:131-132 `min={1}` `max={52}` are UX hints only; server-side validation at schedule.ts:134 is authoritative source of truth |
| T-06-10 | I — Info disclosure | accept | CLOSED | Accepted: error strings are Finnish user-facing text (e.g., "Viikkojen määrän on oltava 1–52"); no stack traces or DB internals; rendered at extend-panel.tsx:224 |
| T-06-11 | T — Tampering | mitigate | CLOSED | extend-panel.tsx:90 — `navigateTo(result.newStartDate)` uses server-returned ISO date string; user-typed strings never reflected into URL; URLSearchParams pass-through of existing params only |
| T-06-12 | E — EoP | accept | CLOSED | Accepted: route is auth-guarded server-side; even if button renders for an unexpected user, `requireAuthorizedParent()` blocks the action call (T-06-01/T-06-08) |
| T-06-13 | R — Repudiation | accept | CLOSED | Accepted: same rationale as T-06-04; deferred to AUDT-01 |
| T-06-14 | D — DoS | mitigate | CLOSED | extend-panel.tsx:208 `disabled={isPending \|\| !rangeEnd}` on Vahvista; :217 `disabled={isPending}` on Peruuta; `finally` block at :95 always resets `isPending` |

---

## Accepted Risks Log

| Threat ID | Risk | Rationale | Deferred To |
|-----------|------|-----------|-------------|
| T-06-04 | No server-side audit trail of who triggered extendSchedule | Two-user co-parenting app; database-level trust between parents is acceptable at v1.1. Both parents are known, authenticated Google account holders. | AUDT-01 (v1.1 future requirements) |
| T-06-05 | Auth error specifics ("Not authenticated", "Forbidden") | Strings are generic and match existing action patterns in the file. No PII, no token values, no internal stack traces in any error path. | — (permanent accept) |
| T-06-10 | User-visible Finnish error strings | Error messages are authored in the server action and validated to contain no internal details. Reviewed: "Virheellinen aikataulun päättymispäivä", "Viikkojen määrän on oltava 1–52", "Päättymispäivä on liian kaukana (max 2 vuotta)". | — (permanent accept) |
| T-06-12 | Extend trigger button visible to any authenticated user | Server action is the enforcement boundary; UI visibility alone grants no privilege. `requireAuthorizedParent()` blocks non-parent callers unconditionally. | — (permanent accept) |
| T-06-13 | No client-side audit of extend trigger | Same rationale as T-06-04. | AUDT-01 (v1.1 future requirements) |

---

## Unregistered Threat Flags

None. Both 06-01-SUMMARY.md and 06-02-SUMMARY.md explicitly report no new threat surface beyond the registered threat model.

---

## Files Audited

- `src/actions/schedule.ts` (extendSchedule function, lines 98-178)
- `src/components/schedule/extend-panel.tsx` (full file, 232 lines)
- `.planning/phases/06-extend-schedule/06-01-PLAN.md` (threat model source)
- `.planning/phases/06-extend-schedule/06-02-PLAN.md` (threat model source)
- `.planning/phases/06-extend-schedule/06-01-SUMMARY.md`
- `.planning/phases/06-extend-schedule/06-02-SUMMARY.md`
