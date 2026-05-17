---
phase: 11-production-deploy
reviewed: 2026-05-16T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - src/proxy.ts
  - scripts/generate-app-config.js
  - .env.example
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-05-16
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Three files reviewed for the production deploy phase: the Next.js middleware auth proxy, the build-time app config generator, and the environment variable template. `src/proxy.ts` is clean — the `getUser()` vs `getSession()` distinction is correctly applied and the per-request Supabase client instantiation avoids the session-leak pitfall on warm Vercel instances.

The config generator script has a concrete bug: `APP_CHILDREN` is missing from its runtime validation array but accessed unconditionally on the next line, causing an uncaught `TypeError` if the variable is absent rather than the clean `FATAL: missing required env vars` error the script intends to surface. A stale comment in the same file also lists env var names with the old `APP_` prefix that were renamed to `PARENT_` in the actual implementation.

`.env.example` has a misleading comment about the Supabase connection URL that could cause confusion when operators set up the production environment.

---

## Warnings

### WR-01: `APP_CHILDREN` Missing from Required-Vars Validation in generate-app-config.js

**File:** `scripts/generate-app-config.js:36`

**Issue:** `APP_CHILDREN` is used unconditionally on line 36 (`process.env.APP_CHILDREN.split(",")`) but is absent from the `required` array declared on lines 17-26. When `APP_CHILDREN` is not set, the missing-vars check on lines 28-34 passes without error, then line 36 throws `TypeError: Cannot read properties of undefined (reading 'split')` — a raw Node crash instead of the intended clean error message. The top-of-file comment (line 3) correctly lists `APP_CHILDREN` as required, confirming the omission from the array is an oversight.

**Fix:** Add `"APP_CHILDREN"` to the `required` array:

```js
const required = [
  "PARENT_FATHER_EMAIL",
  "PARENT_FATHER_CALENDAR_ID",
  "PARENT_MOTHER_EMAIL",
  "PARENT_MOTHER_CALENDAR_ID",
  "APP_CHILDREN",         // add this line
  "APP_START_DATE",
  "APP_FIRST_PARENT",
  "APP_CALENDAR_OWNER_EMAIL",
]
```

---

### WR-02: Misleading DATABASE_URL Comment in .env.example

**File:** `.env.example:9`

**Issue:** The comment reads "Use the direct connection (port 5432) for local dev — NOT the pooler (port 6543)", but the example URL template on the same line uses the host pattern `aws-0-[region].pooler.supabase.com`, which is Supabase's Supavisor pooler endpoint — not the direct connection. The direct connection host pattern is `db.[project-ref].supabase.co`. An operator following the comment will copy the pooler URL and believe they are using a direct connection, which can cause unexpected query behaviour (e.g., prepared statements are unsupported on the transaction pooler).

**Fix:** Replace the example URL with the correct direct-connection template and keep the pooler URL as a commented-out alternative:

```
# Use the direct connection for local dev — NOT the transaction pooler (port 6543)
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@db.[project-ref].supabase.co:5432/postgres

# For production, the pooler (Session mode, port 5432) is acceptable:
# DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
```

---

## Info

### IN-01: Stale Env Var Names in Script Header Comment

**File:** `scripts/generate-app-config.js:3-7`

**Issue:** The header comment on lines 3-4 references `APP_FATHER_NAME`, `APP_FATHER_EMAIL`, `APP_FATHER_CALENDAR_ID`, `APP_MOTHER_NAME`, `APP_MOTHER_EMAIL`, `APP_MOTHER_CALENDAR_ID` — these use the old `APP_` prefix. The actual env vars used throughout the script are `PARENT_FATHER_NAME`, `PARENT_FATHER_EMAIL`, `PARENT_FATHER_CALENDAR_ID`, `PARENT_MOTHER_NAME`, `PARENT_MOTHER_EMAIL`, `PARENT_MOTHER_CALENDAR_ID`. A developer reading the header to know which vars to set will use wrong names.

**Fix:** Update the comment to use the current `PARENT_` prefix:

```js
// Required env vars: PARENT_FATHER_NAME, PARENT_FATHER_EMAIL, PARENT_FATHER_CALENDAR_ID,
//   PARENT_MOTHER_NAME, PARENT_MOTHER_EMAIL, PARENT_MOTHER_CALENDAR_ID,
//   APP_CHILDREN (comma-separated), APP_START_DATE, APP_FIRST_PARENT,
//   APP_CALENDAR_OWNER_EMAIL
```

---

### IN-02: No Runtime Validation of APP_FIRST_PARENT Value

**File:** `scripts/generate-app-config.js:73`

**Issue:** `APP_FIRST_PARENT` is checked only for presence (line 22), not for validity. It is injected into the generated TypeScript file with `as ParentId` (a type assertion), meaning any arbitrary string — including a typo such as `"Father"` or `"dad"` — will silently produce invalid generated code that TypeScript will not catch. The bug would only surface at runtime when the alternating pattern initialises with an unrecognised parent ID.

**Fix:** Add a value check immediately after the missing-vars guard:

```js
const validFirstParents = ["father", "mother"]
if (!validFirstParents.includes(process.env.APP_FIRST_PARENT)) {
  console.error(
    `generate-app-config: FATAL: APP_FIRST_PARENT must be "father" or "mother", got: "${process.env.APP_FIRST_PARENT}"`
  )
  process.exit(1)
}
```

---

_Reviewed: 2026-05-16_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
