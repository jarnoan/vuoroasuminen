---
phase: 06-extend-schedule
fixed_at: 2026-05-06T00:00:00Z
fix_scope: critical_warning
findings_in_scope: 5
fixed: 5
skipped: 0
iteration: 1
status: all_fixed
---

# Phase 06: Code Review Fix Report

**Fixed:** 2026-05-06
**Scope:** critical + warning
**Status:** all_fixed

## Fixes Applied

### CR-01 — Hardcoded email in config/app.ts
**Commit:** df57d69 + 407bd59
`src/config/app.ts` (gitignored) and `src/config/app.example.ts` updated to use
`process.env.PARENT_FATHER_EMAIL`, `PARENT_MOTHER_EMAIL`, `PARENT_FATHER_CALENDAR_ID`,
`PARENT_MOTHER_CALENDAR_ID`. Values moved to `.env.local`. Test env vars added to
`vitest.config.ts` so the `@/config/app` alias keeps working in CI/test environments.

### CR-02 — Mutual exclusion: both endDate and weeks accepted silently
**Commit:** cfe32df
Added early return at top of extendSchedule input validation:
```ts
if (input.endDate !== undefined && input.weeks !== undefined) {
  return { success: false, error: "Anna joko viikot tai päättymispäivä, ei molempia" }
}
```

### WR-01 — Non-null assertion on missing child name
**Commit:** 66be396
Added explicit guard before building insertValues in extendSchedule:
```ts
const missingChildren = config.children.filter(name => !childNameToId.has(name))
if (missingChildren.length > 0) {
  return { success: false, error: `Lapsia ei löydy tietokannasta: ${missingChildren.join(", ")}` }
}
```

### WR-02 — insertCallCount not reset between setupDbMocks calls
**Commit:** a1c78ac
Moved `let insertCallCount = 0` to module scope in `schedule.test.ts`.
Added explicit `insertCallCount = 0` reset inside `setupDbMocks()`.

### WR-03 — toggleCell silent no-op on null entryId
**Commit:** 8f01f5c
Added guard at top of `toggleCell`:
```ts
if (!entryId) throw new Error("Missing entryId")
```

## Skipped

None — all 5 in-scope findings fixed.

## Verification

All 142 tests pass after fixes (`npx vitest run`).

---

_Fixer: Claude Sonnet 4.6_
_Iteration: 1_
