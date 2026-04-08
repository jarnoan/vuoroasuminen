# Phase 4: Google Calendar Sync - Research

**Researched:** 2026-04-08
**Domain:** Google Calendar API v3 + googleapis npm + OAuth2 token management
**Confidence:** HIGH (all findings verified against official Google docs and googleapis source)

---

## Q1: googleapis OAuth2 Pattern

**CORRECTED — the pattern in the prompt has a subtle but critical flaw.**

The proposed pattern using `setCredentials({ refresh_token })` and relying on auto-refresh is correct in principle, but the implementation detail matters:

**Confirmed correct pattern (from google-auth-library-nodejs source):**
```ts
import { google } from "googleapis"

const oauth2Client = new google.auth.OAuth2(
  process.env.AUTH_GOOGLE_ID,
  process.env.AUTH_GOOGLE_SECRET,
  // redirect_uri is optional for server-side token exchange
)
oauth2Client.setCredentials({ refresh_token: refreshToken })
// DO NOT set access_token here unless you also have expiry_date.
// Providing access_token WITHOUT expiry_date causes the library to
// assume the token is valid and skip auto-refresh.
const calendar = google.calendar({ version: "v3", auth: oauth2Client })
```

**Auto-refresh behavior — confirmed HIGH confidence:**
- `getAccessTokenAsync()` in google-auth-library checks: `if (!this.credentials.access_token || this.isTokenExpiring())`
- If `access_token` is absent (only `refresh_token` set), it immediately calls `refreshAccessTokenAsync()` on the first API call
- If `access_token` is present but `expiry_date` is missing, it assumes valid and does NOT refresh — this is the silent-failure trap

**CONTEXT.md specifics note:**
- `src/auth.ts` lines 31-47 already do a manual `fetch` to `https://oauth2.googleapis.com/token` to get a fresh `access_token`
- For `client.ts`, either approach works:
  - (A) Call the token endpoint manually (same as `auth.ts`), get `access_token`, pass `{ access_token, expiry_date }`
  - (B) Pass only `{ refresh_token }` and let googleapis auto-refresh
  - **Recommendation: Option A** — more explicit, easier to reason about, consistent with existing auth.ts pattern, avoids the "auto-refresh silently skipped" trap

**CONTEXT.md D-03 WARNING — see Q5 for critical issue.**

**Source:** [google-auth-library-nodejs OAuth2Client source](https://github.com/googleapis/google-auth-library-nodejs/blob/main/src/auth/oauth2client.ts), [Issue #2350](https://github.com/googleapis/google-api-nodejs-client/issues/2350)

---

## Q2: All-Day Event Format

**CRITICAL CORRECTION: D-10 in CONTEXT.md is WRONG. End date is EXCLUSIVE, not inclusive.**

**Confirmed from official Google Calendar API docs (HIGH confidence):**

The `end` field is explicitly documented as **"The (exclusive) end time of the event."**

For a single-day all-day event on `2026-04-08`:
```ts
start: { date: "2026-04-08" }
end: { date: "2026-04-09" }  // Next day — exclusive
```

**Official example from Google Calendar guides:**
```ts
// All-day event on May 28, 2015:
start: { date: "2015-05-28" }
end:   { date: "2015-05-29" }
```

**Impact on implementation:**
- The `end.date` must always be the day after `entry.day`
- Use `date-fns` `addDays` + `format`: `format(addDays(parseISO(entry.day), 1), "yyyy-MM-dd")`
- Do NOT use `end: { date: entry.day }` — this creates a zero-duration event that Google Calendar renders incorrectly (it may appear in the calendar but displays as 0 days or causes the event to be invisible)

**CONTEXT.md D-10 needs correction**: Change `end: { date: entry.day }` → `end: { date: nextDay }` where `nextDay = format(addDays(parseISO(entry.day), 1), "yyyy-MM-dd")`.

**Source:** [Events resource reference](https://developers.google.com/calendar/api/v3/reference/events#resource), [Create events guide](https://developers.google.com/workspace/calendar/api/guides/create-events)

---

## Q3: events.insert / events.delete

**CONFIRMED CORRECT with notes.**

**events.insert (creating new events):**
```ts
const response = await calendar.events.insert({
  calendarId: parent.calendarId,
  requestBody: {
    summary: `${childName} @ ${parentName}`,
    start: { date: entry.day },
    end: { date: nextDay },       // exclusive — day after
  },
})
const googleEventId = response.data.id  // persist to gcal_events table
```
- Returns the created event resource including `id` (the `googleEventId` to store)
- Only `start` and `end` are required; `summary` is strongly recommended for usability
- No gotchas for basic insert

**events.delete (deleting orphan events):**
```ts
await calendar.events.delete({
  calendarId: parent.calendarId,
  eventId: gcalEvent.googleEventId,
})
```
- Returns empty response body on success
- **404 is expected and must be handled** — if the event was manually deleted in Google Calendar or the `googleEventId` is stale, the API returns 404. Always catch 404 on delete and treat as success (the event is gone, which is what we wanted). See Q7.
- **410 Gone** — can also be returned for already-deleted events. Treat the same as 404.

**Gotcha — `resource` vs `requestBody`:**
- Older googleapis examples use `resource: event` (v3 API param name)
- Current googleapis TypeScript types use `requestBody: event`
- In Node.js googleapis v171, use `requestBody` — `resource` still works but is deprecated

**Source:** [events.insert reference](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert), [events.delete reference](https://developers.google.com/workspace/calendar/api/v3/reference/events/delete), [Create events guide](https://developers.google.com/workspace/calendar/api/guides/create-events)

---

## Q4: Batch Requests

**NOT SUPPORTED in googleapis Node.js client. Recommendation: Promise.all per parent, sequential per event.**

**Findings (MEDIUM confidence — based on official GitHub issues):**
- The googleapis Node.js client does NOT have built-in batch request support
- The global batch endpoint (`www.googleapis.com/batch`) was turned down by Google
- Per-API batch methods do not exist for Calendar API in the Node.js client
- Community libraries (`googleapis-batcher`, `google-batch`) exist but are not production-ready or maintained

**Recommendation for 84 events max:**
- **Do not batch.** Serialize events.insert calls within each parent's sync, or use `Promise.all` within a single parent's events
- The Google Calendar API allows 1,000,000 queries/day per user account (Calendar API). For a 2-parent app with max 84 events (2 children × 84 days / 2 parents = ~168 events total on full republish), this is not a concern
- Use `Promise.allSettled` to collect partial failures without aborting

**Recommended approach for this app:**
```ts
// Per parent: run inserts concurrently (small N = safe)
const results = await Promise.allSettled(
  eventsToCreate.map(entry => calendar.events.insert({ ... }))
)
// Per parent pair: run both parents concurrently
const [fatherSync, motherSync] = await Promise.allSettled([
  syncParent(config.parents[0]),
  syncParent(config.parents[1]),
])
```

**Source:** [Issue #740 — batch support removed](https://github.com/googleapis/google-api-nodejs-client/issues/740), [googleapis-batcher library](https://github.com/jrmdayn/googleapis-batcher)

---

## Q5: Token Storage Gap — CRITICAL ISSUE WITH D-03

**HIGH CONFIDENCE — D-03 in CONTEXT.md contains a factual error about `providerAccountId`.**

**The problem with D-03:**

D-03 says: `"retrieve refresh_token from the accounts table by querying WHERE providerAccountId = parent.email"`

This is **incorrect**. Auth.js stores Google's numeric `sub` claim (e.g., `"111788689787958170610"`) in `providerAccountId`, NOT the email address. The email lives in the `users` table.

**Verified from:** Auth.js Google provider source maps `id: profile.sub` for `providerAccountId`. Multiple GitHub issues and discussions confirm this is a numeric Google user ID.

**Correct token lookup strategy:**
```ts
// Option A: Join users → accounts on userId, filter by users.email
const result = await db
  .select({ refresh_token: accounts.refresh_token })
  .from(accounts)
  .innerJoin(users, eq(accounts.userId, users.id))
  .where(
    and(
      eq(users.email, parentEmail),
      eq(accounts.provider, "google")
    )
  )
  .limit(1)
```

**Why the join is needed:** The `accounts` table has `userId` (FK to `users.id`) and `providerAccountId` (Google's sub). The `users.email` field holds the Google account email. To go from email → refresh_token, you must join through `users`.

**Refresh token rotation risk:**
- Google does NOT rotate refresh tokens on normal use (unlike some OAuth providers)
- A refresh token becomes invalid only when: user revokes access, token unused for 6 months, user changes password (for Gmail scopes), or the 100-token-per-client limit is hit
- For calendar scopes and a 2-user app, rotation is not a practical concern
- The `accounts` table `refresh_token` column (written at first sign-in by Auth.js DrizzleAdapter) remains valid indefinitely unless the user revokes access
- **No need to update `accounts.refresh_token` after server-side use** — Google does not issue a new refresh token on each use

**Source:** [Auth.js Google provider discussion #788](https://github.com/nextauthjs/next-auth/discussions/788), [Issue #12808](https://github.com/nextauthjs/next-auth/issues/12808), [Google OAuth2 token expiration docs](https://developers.google.com/identity/protocols/oauth2#expiration)

---

## Q6: calendarId Format

**CONFIRMED — email-format IDs work directly as calendarId.**

The `calendarId` parameter accepts:
1. `"primary"` — the authenticated user's primary calendar
2. An email-like calendar identifier (e.g., `"abc123xyz@group.calendar.google.com"` or `"user@gmail.com"`) — retrieved from Google Calendar settings or `calendarList.list`

**For this app:**
- Each parent's dedicated custody calendar will have an ID like `"abc123@group.calendar.google.com"` (if a separate calendar was created) or their Gmail address (if using their primary calendar)
- D-01/D-02 in CONTEXT.md correctly puts these IDs in `src/config/app.ts` as `calendarId: string`
- The ID is used directly: `calendar.events.insert({ calendarId: parent.calendarId, ... })`
- No special encoding or formatting needed

**Important note on calendar ownership:**
- The OAuth2 client must be authenticated as the calendar's OWNER to write to it
- If parent A's `calendarId` is a calendar owned by parent A's Google account, the server must call the API authenticated as parent A (using parent A's refresh token), not parent B's
- This is already the design: `buildGCalClient(parentEmail)` retrieves that parent's own refresh token → that parent's access token → writes to that parent's own calendar

**Source:** [events.insert calendarId docs](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert), community confirmation of email-format IDs

---

## Q7: Error Codes

**CONFIRMED from official Google Calendar API error docs (HIGH confidence).**

| Code | Reason | Handle How |
|------|--------|------------|
| 400 Bad Request | Malformed request, invalid date format, missing required field | Log + fail fast — this is a code bug, not a runtime condition |
| 401 Unauthorized | Access token expired or invalid | Retry once after re-fetching fresh access token; if still 401, log and surface error |
| 403 Rate Limit / User Rate Limit | Per-calendar or per-user quota exceeded | Exponential backoff; for this app (84 events, 2 users) this should never occur in normal use |
| 403 Insufficient Permissions | Calendar scope not granted or calendar not owned by authenticated user | Fatal for this event — log error with details, do not retry |
| 404 Not Found | Event or calendar not found | On **delete**: treat as success (already gone). On **insert**: indicates invalid `calendarId` — fatal, log |
| 409 Conflict | Event ID already exists (only relevant if using custom eventId) | Not applicable here since we let Google generate event IDs; if it occurs, log and skip |
| 410 Gone | Deleted resource requested | Treat same as 404 on delete — success (already gone) |
| 500/503 Server Error | Transient Google-side error | Retry with exponential backoff (max 2 retries for a publish action) |

**Additional scope note:**
- The OAuth scope required for write access: `https://www.googleapis.com/auth/calendar`
- The scope `https://www.googleapis.com/auth/calendar.events` is sufficient for events only (write events but not create/delete calendars) — this is the appropriate minimal scope
- Verify the Google OAuth app (configured via `AUTH_GOOGLE_ID`) requests one of these scopes

**Source:** [Google Calendar API error reference](https://developers.google.com/calendar/api/guides/errors)

---

## Key Risks

### Risk 1 (HIGH SEVERITY): D-03 Token Lookup Query Is Wrong
`providerAccountId` stores Google's numeric `sub` ID, not the email. The `WHERE providerAccountId = parent.email` query will always return 0 rows. Every `buildGCalClient()` call will silently fail to find a refresh token. **Fix before implementing**: use an `innerJoin(users, ...)` on `users.email` instead.

### Risk 2 (HIGH SEVERITY): D-10 All-Day Event End Date Is Wrong
`end: { date: entry.day }` (same as start) creates a zero-duration all-day event. Google Calendar treats end date as exclusive. For `2026-04-08`, use `end: { date: "2026-04-09" }`. **Fix before implementing**: add `addDays(parseISO(entry.day), 1)` for end date computation.

### Risk 3 (MEDIUM SEVERITY): googleapis Not Installed
`googleapis` is NOT in `package.json` as of today. The CONTEXT.md says "already installed" but this is incorrect — it must be added to dependencies before any code can be written.

---

## Recommended Implementation Pattern

### googleapis not installed — install first
```bash
npm install googleapis
```

### client.ts — Build authenticated calendar client
```ts
import { google } from "googleapis"
import { db } from "@/db"
import { accounts } from "@/db/schema/auth"
import { users } from "@/db/schema/auth"
import { eq, and } from "drizzle-orm"
import type { calendar_v3 } from "googleapis"

export async function buildGCalClient(
  parentEmail: string
): Promise<calendar_v3.Calendar> {
  // Correct join: users.email → accounts.userId → accounts.refresh_token
  // providerAccountId is Google's numeric sub ID, NOT the email
  const [row] = await db
    .select({ refresh_token: accounts.refresh_token })
    .from(accounts)
    .innerJoin(users, eq(accounts.userId, users.id))
    .where(
      and(
        eq(users.email, parentEmail),
        eq(accounts.provider, "google")
      )
    )
    .limit(1)

  if (!row?.refresh_token) {
    throw new Error(`No refresh token found for ${parentEmail}`)
  }

  // Manual token exchange (consistent with auth.ts pattern)
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID!,
      client_secret: process.env.AUTH_GOOGLE_SECRET!,
      grant_type: "refresh_token",
      refresh_token: row.refresh_token,
    }),
  })
  if (!tokenResponse.ok) {
    const err = await tokenResponse.text()
    throw new Error(`Token exchange failed for ${parentEmail}: ${err}`)
  }
  const { access_token, expires_in } = await tokenResponse.json()

  const oauth2Client = new google.auth.OAuth2(
    process.env.AUTH_GOOGLE_ID,
    process.env.AUTH_GOOGLE_SECRET,
  )
  oauth2Client.setCredentials({
    access_token,
    expiry_date: Date.now() + (expires_in - 60) * 1000, // 60s buffer
  })

  return google.calendar({ version: "v3", auth: oauth2Client })
}
```

### sync.ts — Core sync function (all-day event, correct end date)
```ts
import { addDays, parseISO, format } from "date-fns"

// All-day event for entry.day = "2026-04-08":
const endDate = format(addDays(parseISO(entry.day), 1), "yyyy-MM-dd")

const response = await calendar.events.insert({
  calendarId: parent.calendarId,
  requestBody: {
    summary: `${childName} @ ${parentName}`,
    start: { date: entry.day },
    end: { date: endDate },     // EXCLUSIVE — must be day after
  },
})
const googleEventId = response.data.id!
// Persist to gcal_events table...
```

### Orphan delete — handle 404/410 gracefully
```ts
try {
  await calendar.events.delete({
    calendarId: orphan.calendarId,
    eventId: orphan.googleEventId,
  })
} catch (err: unknown) {
  const status = (err as { code?: number })?.code
  // 404 and 410 mean already deleted — treat as success
  if (status !== 404 && status !== 410) throw err
}
// Always delete from local gcal_events table regardless
await db.delete(gcalEvents).where(eq(gcalEvents.id, orphan.id))
```

### Concurrent sync — Promise.allSettled per parent
```ts
export async function syncCalendarsAfterPublish(): Promise<SyncResult> {
  const [fatherResult, motherResult] = await Promise.allSettled([
    syncParentCalendar(config.parents.find(p => p.id === "father")!),
    syncParentCalendar(config.parents.find(p => p.id === "mother")!),
  ])
  return {
    father: fatherResult.status === "fulfilled" ? fatherResult.value : { success: false, error: String(fatherResult.reason) },
    mother: motherResult.status === "fulfilled" ? motherResult.value : { success: false, error: String(motherResult.reason) },
  }
}
```

---

## CONTEXT.md Corrections Required

Before planning/implementation, these CONTEXT.md decisions must be corrected:

| Decision | Error | Correction |
|----------|-------|------------|
| **D-03** | `WHERE providerAccountId = parent.email` — providerAccountId is Google's numeric sub, not email | Query via `innerJoin(users, ...)` on `users.email` |
| **D-10** | `end: { date: entry.day }` — end date is exclusive, same-date creates 0-duration event | `end: { date: format(addDays(parseISO(entry.day), 1), "yyyy-MM-dd") }` |
| **D-14 prerequisite** | "googleapis already installed" in CONTEXT.md canonical refs — package is NOT in package.json | Run `npm install googleapis` as Wave 0 task |

---

## Sources

### Primary (HIGH confidence)
- [Google Calendar API — Events resource (end date exclusive)](https://developers.google.com/calendar/api/v3/reference/events#resource)
- [Google Calendar API — Create events guide (all-day example)](https://developers.google.com/workspace/calendar/api/guides/create-events)
- [Google Calendar API — events.insert reference](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert)
- [Google Calendar API — Error codes](https://developers.google.com/calendar/api/guides/errors)
- [Google Identity — OAuth2 token expiration and refresh token lifecycle](https://developers.google.com/identity/protocols/oauth2#expiration)
- [google-auth-library-nodejs OAuth2Client source — auto-refresh logic](https://github.com/googleapis/google-auth-library-nodejs/blob/main/src/auth/oauth2client.ts)

### Secondary (MEDIUM confidence)
- [googleapis Node.js client — Issue #2350: setCredentials with access_token but no expiry_date skips refresh](https://github.com/googleapis/google-api-nodejs-client/issues/2350)
- [googleapis Node.js client — Issue #740: batch requests not supported](https://github.com/googleapis/google-api-nodejs-client/issues/740)
- [nextauthjs — Discussion #788: providerAccountId is Google's numeric sub](https://github.com/nextauthjs/next-auth/discussions/788)
- [nextauthjs — Issue #12808: providerAccountId stores sub not email](https://github.com/nextauthjs/next-auth/issues/12808)
- [googleapis documentation — setCredentials and tokens event](https://googleapis.dev/nodejs/googleapis/latest/docs/index.html)
