# Security Review — Vuoroasuminen

**Reviewed:** 2026-04-21
**Reviewer:** Claude (gsd-code-reviewer)
**Depth:** deep (cross-file analysis)
**Scope:** All source files under `src/`, plus `scripts/` and root config

---

## Summary

The application is a two-parent custody scheduling tool backed by Next.js 15, Auth.js v5, Drizzle ORM, Supabase Realtime, and Google Calendar API. The threat model is small (two trusted users, private deployment), but several findings represent real security risks regardless of scale.

The most serious issues are: (1) real credentials and personal data committed directly into `src/config/app.ts`, (2) a missing authorization check that lets either authenticated user modify any database row belonging to any entry — there is no ownership check beyond "is logged in," and (3) `allowDangerousEmailAccountLinking: true` in the Google OAuth provider, which allows account takeover if Google ever lets an attacker register a matching email. Additional findings cover information leakage via verbose error messages in public error paths and an unauthenticated `syncCalendars` Server Action.

---

## CRITICAL

### CR-01: Real personal email address and Google Calendar IDs committed to version control

**File:** `src/config/app.ts:20,24,27`

**Issue:** The production `app.ts` file contains a real Gmail address (`jarnoan@gmail.com`) and two full Google Calendar IDs embedded as string literals. Both parents' entries use the same email, which suggests placeholder replacement was incomplete, but the real email is still present. Anyone with read access to this repository (now or in git history) can see which Google accounts are involved and can target the calendar IDs for enumeration or spam if the calendars are not locked down.

**Remediation:** This data must be sourced entirely from environment variables at runtime or at build time via the existing `scripts/generate-app-config.js` mechanism. The real `app.ts` must be added to `.gitignore` immediately, and the committed version (including git history) must be scrubbed with `git filter-repo` or BFG Repo Cleaner. The `app.example.ts` file already shows the correct placeholder pattern — use it.

```gitignore
# .gitignore addition
src/config/app.ts
```

```bash
# Immediate remediation
git filter-repo --path src/config/app.ts --invert-paths
```

---

### CR-02: Server Actions have no authorization — any authenticated user can mutate any row

**File:** `src/actions/schedule.ts:13-22, 24-33`

**Issue:** `toggleCell` and `saveNotes` check only that a session exists (`session?.user`). They then execute `db.update(scheduleEntries).where(eq(scheduleEntries.id, entryId))` with a caller-supplied `entryId` — no check that the entry belongs to the window, or that the caller is one of the two configured parents. In a two-user private app this is low-exploitation-probability, but it is a structural authorization bypass: any Google-authenticated third party who discovers the deployment URL could call these Server Actions (since Google OAuth with `allowDangerousEmailAccountLinking: true` makes sign-up trivially easy) and overwrite schedule entries.

Combined with CR-03 below, the attack surface is wider than it appears.

**Remediation:** After verifying the session, check that `session.user.email` appears in `config.parents.map(p => p.email)` before executing any mutation:

```typescript
// src/actions/schedule.ts — add after auth() call
const session = await auth()
if (!session?.user?.email) throw new Error("Not authenticated")

const isAuthorized = config.parents.some(p => p.email === session.user.email)
if (!isAuthorized) throw new Error("Forbidden")
```

Apply the same guard to `publishSchedule` and `syncCalendars`.

---

### CR-03: `allowDangerousEmailAccountLinking: true` enables account takeover

**File:** `src/auth.config.ts:7`

**Issue:** The `allowDangerousEmailAccountLinking` flag instructs Auth.js to link any Google account whose email matches an existing user record, without verifying that the incoming OAuth flow originated from the same identity provider as the stored account. If an attacker can register a Google account with the same email as an existing user (or if a second provider is added later), they can authenticate as the existing user. Auth.js explicitly calls this option "dangerous" in the API name for this reason.

For a two-person private app where Google is the only provider, the practical risk is low today, but the flag provides no benefit here — remove it.

**Remediation:**

```typescript
// src/auth.config.ts — remove the flag entirely
Google({
  // allowDangerousEmailAccountLinking: true  <-- remove this line
  authorization: { ... }
})
```

---

## HIGH

### HI-01: `syncCalendars` Server Action has no authentication check

**File:** `src/actions/schedule.ts:60-77`

**Issue:** `syncCalendars` is a `"use server"` action that triggers Google Calendar writes. Unlike `toggleCell`, `saveNotes`, and `publishSchedule`, it performs no `auth()` check at all. Any caller (including an unauthenticated one via a crafted POST) can trigger calendar synchronization, which causes OAuth token retrieval, external HTTP calls to Google, and potential rate-limit consumption.

**Remediation:** Add the same authentication and authorization guard as CR-02:

```typescript
export async function syncCalendars(): Promise<SyncResult> {
  const session = await auth()
  if (!session?.user?.email) throw new Error("Not authenticated")
  const isAuthorized = config.parents.some(p => p.email === session.user.email)
  if (!isAuthorized) throw new Error("Forbidden")
  // ... rest of function
}
```

---

### HI-02: Token exchange errors leak sensitive error body from Google to server logs in plain text

**File:** `src/lib/gcal/client.ts:54-58`

**Issue:** When the OAuth token exchange fails, the raw HTTP response body from Google is read with `tokenResponse.text()` and included verbatim in a thrown `Error`:

```typescript
const errBody = await tokenResponse.text()
throw new Error(
  `Token exchange failed for ${parentEmail} (HTTP ${tokenResponse.status}): ${errBody}`)
```

The `parentEmail` is included in the error message. This error propagates up through `syncCalendarsAfterPublish`, then through `syncCalendars`, and is ultimately serialized as `String(result.reason)` in the `parentResults` array, which is returned to the client and displayed in a toast notification. The parent's email address and raw Google OAuth error body (which may include token fragments or detailed grant information) are thus transmitted to the browser.

**Remediation:** Log the full error server-side only; return a sanitized message to the client:

```typescript
// In client.ts
if (!tokenResponse.ok) {
  const errBody = await tokenResponse.text()
  // Log full detail server-side only
  console.error(`[GCal] Token exchange failed for ${parentEmail} (HTTP ${tokenResponse.status}): ${errBody}`)
  throw new Error(`Calendar authentication failed. The parent must sign in again.`)
}
```

---

### HI-03: `publishSchedule` does not restrict who can publish — no owner check

**File:** `src/actions/schedule.ts:35-58`

**Issue:** `publishSchedule` updates ALL draft entries in the window to `published`, for any authenticated caller. Beyond the missing authorization check (CR-02), there is no concept of a "last reviewed by" owner. If a malicious or mistaken user calls `publishSchedule`, it permanently locks draft entries without any co-parent confirmation. Given that the schedule is shared, publishing should require that the caller is one of the two configured parents (see CR-02 remediation).

This is partially a design concern but the lack of an email-based allowlist makes it a concrete security gap in the current implementation.

---

## MEDIUM

### ME-01: Supabase Realtime subscription accepts and casts unvalidated data from the wire

**File:** `src/components/schedule/realtime-provider.tsx:46-55`

**Issue:** The Realtime payload is received as `{ new: Record<string, unknown> }` and immediately cast to the internal `RealtimePayload["new"]` type via `as` — no runtime validation of field types, lengths, or allowed values. The `parentId` field is cast with `as ParentId` without checking that it is actually `"father"` or `"mother"`. A malformed or injected Supabase CDC event (possible if the Supabase anon key is compromised, or if Row Level Security is misconfigured) could push arbitrary string values into client-side state, causing incorrect rendering.

**Remediation:** Validate the payload before using it. A minimal guard:

```typescript
const VALID_PARENT_IDS = ["father", "mother"] as const
const row = payload.new as RealtimePayload["new"]
if (!row.id || !row.child_id || !row.day) return  // ignore malformed events
const parentId = VALID_PARENT_IDS.includes(row.parent_id as ParentId)
  ? row.parent_id as ParentId
  : config.firstParent  // safe fallback
```

For stronger guarantees, add a Zod schema for the payload.

---

### ME-02: `toggleCell` accepts arbitrary `newParentId` from the client without validation

**File:** `src/actions/schedule.ts:13-22`

**Issue:** The `newParentId` parameter is typed as `ParentId` in TypeScript, but at runtime (since Server Actions receive serialized POST bodies) the value is not validated. A caller could pass any string as `newParentId` and it would be written directly to the `parentId` column of `schedule_entries`. Because `parentId` is a plain `text` column with no DB enum constraint, invalid values will persist.

**Remediation:** Validate on the server side before the DB write:

```typescript
const VALID_PARENTS: ParentId[] = ["father", "mother"]
if (!VALID_PARENTS.includes(newParentId)) {
  throw new Error("Invalid parentId")
}
```

---

### ME-03: Notes field has no length limit — unbounded user input written to the database

**File:** `src/actions/schedule.ts:24-33`, `src/db/schema/domain.ts:36`

**Issue:** `saveNotes` writes the caller-supplied `notes` string directly to the database with no length check. The schema column is `text("notes")` with no constraint. A caller can submit an arbitrarily large string, consuming storage and potentially causing oversized payloads in Supabase Realtime broadcasts or calendar event titles.

**Remediation:** Add a server-side length check and a DB-level constraint:

```typescript
// actions/schedule.ts
if (notes.length > 500) throw new Error("Notes too long (max 500 characters)")
```

```typescript
// schema/domain.ts — consider adding a check constraint via Drizzle
// (Drizzle does not natively support CHECK constraints yet; enforce at application layer)
```

---

### ME-04: `getScheduleWindow` auto-seeds schedule entries on first load without rate limiting

**File:** `src/lib/schedule/queries.ts:27-48`

**Issue:** If no entries exist for the current window, `getScheduleWindow` inserts a full 84-day schedule (84 days × number of children entries) on every concurrent request that hits before the first insert completes. This is a TOCTOU (time-of-check-time-of-use) race: two simultaneous requests both find `entries.length === 0`, both create a `schedules` row, and both attempt to insert overlapping `schedule_entries`. There is no unique constraint on `(day, child_id)` in the schema, so duplicate rows can be silently inserted.

While this is a correctness/data-integrity issue, it also has a security dimension: an attacker who can trigger many simultaneous unauthenticated page loads (the dashboard page itself calls this server-side, but the middleware allows the home page unauthenticated) cannot directly trigger this path, but a legitimate user with a slow connection and multiple open tabs can.

**Remediation:** Add a unique constraint on `(child_id, day)` in `schedule_entries` and handle the conflict:

```typescript
// schema/domain.ts
}, (table) => [
  uniqueIndex("schedule_entries_child_day_unique").on(table.childId, table.day),
])
```

```typescript
// queries.ts — use onConflictDoNothing() for the bulk insert
await db.insert(scheduleEntries).values(insertValues).onConflictDoNothing()
```

---

### ME-05: Error from Google token exchange includes parent email address in thrown Error message

**File:** `src/lib/gcal/client.ts:36-39`

**Issue:** The error thrown when no refresh token is found includes the parent's email address in the message string:

```typescript
throw new Error(
  `No Google refresh token found for ${parentEmail}. ...`)
```

This error propagates to the client toast (see HI-02). The email address is configuration-internal data and should not be surfaced in client-visible error messages.

**Remediation:** Use an opaque message client-side; log the email only server-side.

---

## LOW

### LO-01: `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` accessed via `process.env` with non-null assertion throughout

**File:** `src/auth.ts:56-57`, `src/lib/gcal/client.ts:47-48`

**Issue:** `process.env.AUTH_GOOGLE_ID!` and `process.env.AUTH_GOOGLE_SECRET!` are accessed with TypeScript non-null assertions at multiple call sites. If these variables are missing at runtime (misconfigured deployment), the code will pass `undefined` to the OAuth2 client and to the token endpoint POST body, producing a confusing "invalid_client" error from Google rather than a clear startup failure.

**Remediation:** Validate all required environment variables at startup in `src/env.ts` (currently this file only loads the `.env.local` file via dotenv):

```typescript
// src/env.ts — add validation
const required = ["AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET", "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`)
}
```

---

### LO-02: `newTokens` from Google token refresh is not validated before use

**File:** `src/auth.ts:62-68`

**Issue:** After `response.json()` the code accesses `newTokens.access_token`, `newTokens.expires_in`, and `newTokens.refresh_token` without checking that they exist or have the expected types. If Google returns an unexpected shape (e.g., an error JSON with `ok: false` before the `throw` on line 63 — which is correct — but also in edge cases like network truncation returning partial JSON), `newTokens.access_token` could be `undefined`, which would then be stored in the DB.

The `if (!response.ok) throw` on line 63 covers the normal error case, but `response.json()` is called on line 62 before the check on line 63. If the response body is not valid JSON, the `response.json()` promise rejects and the outer `catch` block on line 87 swallows the error silently with only `{ ...token, error: "RefreshTokenError" }`.

**Remediation:** Parse after the ok check:

```typescript
if (!response.ok) throw new Error("Refresh failed")
const newTokens = await response.json()
if (!newTokens.access_token || typeof newTokens.expires_in !== "number") {
  throw new Error("Unexpected token response shape")
}
```

---

### LO-03: `db/reset.ts` and `db/clear-tokens.ts` are destructive scripts with no confirmation prompt

**File:** `src/db/reset.ts`, `src/db/clear-tokens.ts`

**Issue:** Both scripts delete all rows from their respective tables immediately on execution, with no `--yes` flag or interactive confirmation. A mistyped command in a production environment deletes all schedule data or all OAuth tokens with no undo path.

**Remediation:** Add a `--yes` flag requirement or an interactive confirmation:

```javascript
if (!process.argv.includes("--yes")) {
  console.error("Pass --yes to confirm destructive operation.")
  process.exit(1)
}
```

---

### LO-04: Supabase anon key is a NEXT_PUBLIC variable — accessible in all client bundles

**File:** `src/lib/supabase/client.ts:8-9`

**Issue:** `NEXT_PUBLIC_SUPABASE_ANON_KEY` is intentionally public (Supabase's anon key is designed for client-side use), but there is no evidence in the codebase that Supabase Row Level Security (RLS) is enabled on the `schedule_entries` table. If RLS is not enabled, any browser that has the anon key can query or modify the table directly via the Supabase REST API, bypassing all Next.js Server Actions and their authentication checks entirely.

**Remediation:** Enable RLS on all tables in Supabase and add policies that restrict access to authenticated sessions. Since the app's auth is handled by Auth.js (not Supabase Auth), use a service-role key for all server-side DB operations and the anon key only for Realtime subscriptions with RLS-restricted `SELECT` policies.

---

### LO-05: Calendar IDs are used as authorization tokens for Google Calendar write access

**File:** `src/lib/gcal/sync.ts:180,222`

**Issue:** The `calendarId` values from `config.parents[].calendarId` are passed directly to `calendar.events.delete` and `calendar.events.insert`. These IDs are now committed to git history (see CR-01). Anyone who obtains both the calendar ID and a valid OAuth token for the associated Google account can write to that calendar. The calendar ID itself is not a secret, but the combination of exposed ID + exposed email makes targeted attacks easier.

This is a consequence of CR-01 and is resolved by the same remediation.

---

## Findings Summary

| ID    | Severity | Title |
|-------|----------|-------|
| CR-01 | CRITICAL | Real email and calendar IDs committed to git |
| CR-02 | CRITICAL | No authorization check in schedule mutation actions |
| CR-03 | CRITICAL | `allowDangerousEmailAccountLinking` enables account takeover |
| HI-01 | HIGH     | `syncCalendars` has no authentication check |
| HI-02 | HIGH     | Token exchange errors leak email and OAuth details to client |
| HI-03 | HIGH     | `publishSchedule` has no owner/authorization check |
| ME-01 | MEDIUM   | Realtime payload cast without runtime validation |
| ME-02 | MEDIUM   | `newParentId` not validated server-side in `toggleCell` |
| ME-03 | MEDIUM   | Notes field has no length limit |
| ME-04 | MEDIUM   | Race condition in schedule auto-seeding, no unique constraint |
| ME-05 | MEDIUM   | Parent email leaked in error messages |
| LO-01 | LOW      | Required env vars not validated at startup |
| LO-02 | LOW      | Token refresh response not validated before use |
| LO-03 | LOW      | Destructive DB scripts have no confirmation guard |
| LO-04 | LOW      | Supabase RLS posture not confirmed — anon key bypasses all app auth |
| LO-05 | LOW      | Calendar IDs in git history compound CR-01 exposure |

---

_Reviewed: 2026-04-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
