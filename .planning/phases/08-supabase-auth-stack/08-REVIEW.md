---
phase: 08-supabase-auth-stack
reviewed: 2026-05-10T09:31:24Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - scripts/generate-app-config.js
  - src/actions/auth.ts
  - src/actions/schedule.ts
  - src/app/auth/callback/route.ts
  - src/app/auth/error/page.tsx
  - src/app/dashboard/page.tsx
  - src/app/page.tsx
  - src/components/layout/header.tsx
  - src/components/owner-warning-banner.tsx
  - src/components/schedule/dashboard-shell.tsx
  - src/components/sign-in-button.tsx
  - src/components/ui/alert.tsx
  - src/config/app.example.ts
  - src/db/index.ts
  - src/db/schema/tokens.ts
  - src/lib/gcal/client.ts
  - src/lib/gcal/sync.ts
  - src/lib/supabase/middleware.ts
  - src/lib/supabase/server.ts
  - src/middleware.ts
findings:
  critical: 2
  warning: 5
  info: 3
  total: 10
status: issues_found
---

# Phase 08: Code Review Report

**Reviewed:** 2026-05-10T09:31:24Z
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

This phase delivers the Supabase auth stack: Google OAuth via Supabase, refresh token capture in `user_google_tokens`, and Google Calendar sync triggered by publish. The architecture is sound — the callback/session cookie pitfall is correctly handled, middleware uses `getUser()` (not `getSession()`), and the GCal retry/orphan-cleanup logic is well-designed.

Two critical issues were identified: an orphan schedule row is created before children are validated in `extendSchedule`, and the GCal token exchange does not validate the `access_token` field before trusting it. Five warnings cover missing UUID validation on entry IDs, a non-null assertion on a GCal API response field, the `rejectUnauthorized: false` SSL setting, an `APP_FIRST_PARENT` value that is never validated against the `ParentId` union, and an inline `createBrowserClient` call in two components that bypass the centralized singleton. Three info items note console-heavy logging, a dead `schedules` table insert in `extendSchedule`, and the owner-warning redirect flow having no confirmed authorization gate.

---

## Critical Issues

### CR-01: Orphan `schedules` row created before children validation in `extendSchedule`

**File:** `src/actions/schedule.ts:156-165`

**Issue:** A `schedules` row is inserted at line 156 before the `missingChildren` guard at lines 159-165. When `missingChildren.length > 0`, the function returns an error but the `schedules` row already exists in the database with no entries referencing it. Over time this leaves unreferenced rows in the `schedules` table.

```ts
// Line 156 — inserts schedule row first
const [schedule] = await db.insert(schedules).values({}).returning()

// Line 159 — only THEN checks whether children exist
const missingChildren = config.children.filter(name => !childNameToId.has(name))
if (missingChildren.length > 0) {
  return { success: false, error: `...` }
  // schedule row orphaned — never cleaned up
}
```

**Fix:** Move the children validation before the `schedules` insert:

```ts
// Validate children FIRST
const allChildren = await db.select().from(children)
const orderedChildren = config.children
  .map(name => allChildren.find(c => c.name === name))
  .filter((c): c is typeof allChildren[number] => c != null)
const childNameToId = new Map(orderedChildren.map(c => [c.name, c.id]))

const missingChildren = config.children.filter(name => !childNameToId.has(name))
if (missingChildren.length > 0) {
  return { success: false, error: `Lapsia ei löydy tietokannasta: ${missingChildren.join(", ")}` }
}

// Only insert schedule row once we know the operation will succeed
const [schedule] = await db.insert(schedules).values({}).returning()
```

---

### CR-02: GCal token exchange response not validated — `access_token` silently undefined crashes at runtime

**File:** `src/lib/gcal/client.ts:62-76`

**Issue:** After fetching a new access token, the code casts the response body to `{ access_token: string; expires_in: number }` without checking whether those fields are actually present. Google's token endpoint can return error JSON (e.g. `{ "error": "invalid_grant" }`) even with an HTTP 200 in some edge cases; in those scenarios `access_token` is `undefined`, and `oauth2Client.setCredentials({ access_token: undefined })` will produce an authenticated client that silently fails all API calls rather than throwing a clear error.

```ts
// Line 62-64 — unchecked cast; no guard on undefined
const { access_token, expires_in } = (await tokenResponse.json()) as {
  access_token: string
  expires_in: number
}
```

**Fix:** Add an explicit field guard:

```ts
const tokenJson = await tokenResponse.json() as {
  access_token?: string
  expires_in?: number
  error?: string
}

if (!tokenJson.access_token || !tokenJson.expires_in) {
  console.error(`[GCal] Token exchange returned unexpected body for ${ownerEmail}:`, tokenJson)
  throw new Error(`Calendar authentication failed for ${ownerEmail}. Owner must sign in again.`)
}

const { access_token, expires_in } = tokenJson
```

---

## Warnings

### WR-01: `entryId` not validated as UUID format before DB query in `toggleCell`, `saveNotes`, `clearCell`

**File:** `src/actions/schedule.ts:28-54, 183-195`

**Issue:** `toggleCell`, `saveNotes`, and `clearCell` check that `entryId` is truthy (line 31, 189) but do not validate that it is a properly-formed UUID. Since these are Server Actions callable from the browser, a malformed string such as a SQL fragment or very long string reaches the `WHERE` clause of the Drizzle query. Drizzle ORM parameterizes queries, so SQL injection is not possible, but a deliberately malformed value triggers a PostgreSQL error that surfaces as an unhandled exception thrown out of the action rather than a clean `{ success: false }` return.

**Fix:** Add a UUID format check, or use Zod to validate the input:

```ts
import { z } from "zod"
const UUIDSchema = z.string().uuid()

export async function toggleCell(entryId: string, newParentId: ParentId) {
  await requireAuthorizedParent()
  if (!UUIDSchema.safeParse(entryId).success) throw new Error("Invalid entryId")
  // ...
}
```

---

### WR-02: Non-null assertion on `response.data.id` in GCal event insert

**File:** `src/lib/gcal/sync.ts:232`

**Issue:** `response.data.id!` uses a non-null assertion. The Google Calendar API does not guarantee that `id` is present in the insert response — if the event was created but the `id` field is absent (API contract gap, network truncation), the subsequent `db.insert(gcalEvents)` will write an empty string or `undefined` cast to string as the `googleEventId`, silently corrupting the `gcal_events` table and making future orphan cleanup impossible.

```ts
const googleEventId = response.data.id! // line 232 — trusts API, no guard
```

**Fix:**

```ts
const googleEventId = response.data.id
if (!googleEventId) {
  throw new Error(`GCal insert succeeded but returned no event ID for entry ${entry.id}`)
}
```

---

### WR-03: `APP_FIRST_PARENT` env var written verbatim to generated config without validating it is `"father"` or `"mother"`

**File:** `scripts/generate-app-config.js:71`

**Issue:** The script validates that `APP_FIRST_PARENT` is present (line 25) but never checks that its value matches the `ParentId` union (`"father" | "mother"`). It is written directly into the generated TypeScript with a type assertion `as ParentId`. An invalid value such as `"Father"` or a typo passes the env check, generates a syntactically valid file, and produces a runtime mismatch between the config value and the string literals used in schedule logic.

```js
firstParent: ${JSON.stringify(process.env.APP_FIRST_PARENT)} as ParentId,
// No validation that value === "father" || value === "mother"
```

**Fix:** Add a validation step before writing the file:

```js
const VALID_PARENT_IDS = ["father", "mother"]
if (!VALID_PARENT_IDS.includes(process.env.APP_FIRST_PARENT)) {
  console.error(`generate-app-config: APP_FIRST_PARENT must be "father" or "mother", got: ${process.env.APP_FIRST_PARENT}`)
  process.exit(1)
}
```

---

### WR-04: `rejectUnauthorized: false` disables TLS certificate verification for the database connection

**File:** `src/db/index.ts:10`

**Issue:** `ssl: { rejectUnauthorized: false }` instructs the PostgreSQL client to skip certificate chain validation. This is commonly set for local development against Supabase's self-signed certificate but should not be the default for production connections. A man-in-the-middle attacker on the network path could intercept database traffic including refresh tokens.

**Fix:** Make this conditional on environment, or use Supabase's session pooler which does not require disabling cert verification:

```ts
ssl: process.env.NODE_ENV === "production"
  ? true                            // Node pg verifies the cert against system trust store
  : { rejectUnauthorized: false },  // local dev only
```

---

### WR-05: `auth/error` page and `OwnerWarningBanner` create inline Supabase browser clients instead of using the centralized singleton

**File:** `src/app/auth/error/page.tsx:8-11`, `src/components/owner-warning-banner.tsx:15-18`

**Issue:** Both components call `createBrowserClient(url, anonKey)` from `@supabase/ssr` directly, duplicating environment variable reads and bypassing the module-level singleton in `src/lib/supabase/client.ts`. `sign-in-button.tsx` correctly imports `createBrowserClient` from the centralized module. The inconsistency means these two components do not share the realtime subscription instance and do not benefit from the `eventsPerSecond: 10` rate limit set in the singleton.

**Fix:** In both files, replace the inline `createBrowserClient` call with the singleton:

```ts
// src/app/auth/error/page.tsx and src/components/owner-warning-banner.tsx
import { createBrowserClient } from "@/lib/supabase/client"

// ...
const supabase = createBrowserClient()
```

---

## Info

### IN-01: Heavy `console.log` in production code paths

**Files:** `src/lib/gcal/sync.ts:32,86,89,135,165,197,247`, `src/app/auth/callback/route.ts:51,54,73`, `src/actions/schedule.ts:97`

**Issue:** All GCal sync progress steps and auth callback events are logged via `console.log`. In Vercel production, every invocation of `syncCalendarsAfterPublish` (which runs per-publish) emits 7+ log lines including the full `parentResults` JSON. The auth callback logs the user's email and token presence status on every sign-in. This is acceptable for initial development but adds noise and should be gated behind a debug flag before the app is shared with real users.

**Fix:** Gate verbose logs behind an environment variable:

```ts
const DEBUG = process.env.GCAL_DEBUG === "1"
if (DEBUG) console.log("[GCal sync] ...")
```

---

### IN-02: `scheduleId` foreign key is written but the `schedules` table insertion appears unused by the query layer

**File:** `src/actions/schedule.ts:156`

**Issue:** `extendSchedule` inserts a row into `schedules` and uses its ID as the `scheduleId` on new `scheduleEntries`. However, if the rest of the query layer (e.g. `getScheduleWindow`) selects entries without filtering by `scheduleId`, the `schedules` table rows accumulate without being queried — making the insert a dead-code overhead. This is an architectural note rather than a bug; verify whether `scheduleId` is used in queries and, if not, consider removing the extra insert and the foreign key.

---

### IN-03: Missing heading in `auth/error` page

**File:** `src/app/auth/error/page.tsx:31-43`

**Issue:** The error page renders explanatory text and a retry button but no `<h1>` heading. This is a minor accessibility gap — screen readers will not announce a page title, and the browser tab title will fall back to the app-level title from `layout.tsx`.

**Fix:** Add a heading:

```tsx
<h1 className="text-2xl font-semibold">Kirjautumisvirhe</h1>
<p className="text-muted-foreground">...</p>
```

---

_Reviewed: 2026-05-10T09:31:24Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
