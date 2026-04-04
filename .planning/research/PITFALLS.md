# Pitfalls Research

**Domain:** Co-parenting custody scheduling web app with Google Calendar integration and real-time collaboration
**Researched:** 2026-04-04
**Confidence:** HIGH (OAuth/Calendar API behavior verified against official Google docs; real-time patterns from multiple corroborating sources)

---

## Critical Pitfalls

### Pitfall 1: Refresh Token Not Returned on Subsequent Logins

**What goes wrong:**
When a user who has previously authorized the app logs in again, Google does not return a new refresh token — only an access token. If the previously stored refresh token was lost (cleared database, dev environment reset, token rotation mistake), the user's Calendar integration silently breaks. Calendar syncs fail with 401 errors and no recovery path exists without forcing the user through OAuth consent again.

**Why it happens:**
Google only returns a refresh token the first time a user grants consent, or when `prompt=consent` is explicitly forced. Developers often assume a new login always yields a new refresh token. The refresh token is then stored carelessly (in session, not persisted to database), lost during database migrations, or never stored at all.

**How to avoid:**
- Always request `access_type=offline` and `prompt=consent` on the initial OAuth flow — or on any re-authorization flow.
- Persist the refresh token to the database immediately on receipt (within the same transaction as creating/updating the user record).
- On subsequent logins where no refresh token is returned by Google, do NOT overwrite the stored token with null — keep the existing one.
- Implement a "reconnect calendar" UI pathway that forces `prompt=consent` when the stored token is revoked/missing.

**Warning signs:**
- Calendar sync calls return 401 or 403 after a dev environment reset.
- Only happens to some users but not others (those who re-authenticated without `prompt=consent`).
- "Token invalid" errors that cannot be reproduced from scratch.

**Phase to address:**
Auth setup phase (Google OAuth integration). Must be correct before any Calendar API code is written.

---

### Pitfall 2: Refresh Tokens Expire in 7 Days While App is in Testing Mode

**What goes wrong:**
If the Google Cloud project's OAuth consent screen is in "Testing" publishing status, all issued refresh tokens expire after exactly 7 days. For a two-user app where both parents need persistent calendar access, this means calendar sync breaks silently every week until the app is verified and moved to "Production" publishing status.

**Why it happens:**
Developers build and test the app in Testing mode, assume it works, then deploy to real users without realizing the 7-day expiry applies even in "production-like" environments. There is no obvious error — the refresh token just becomes invalid after 7 days.

**How to avoid:**
- Move the OAuth consent screen publishing status to "Production" before giving the app to real users, even if it is a private two-person app. This requires completing Google's verification process for sensitive scopes (Google Calendar read/write).
- For a private app used by only 2 known users, an alternative is to keep it in Testing mode and add both users as explicit test users — but the 7-day re-authorization requirement remains and will create friction.
- Budget time for the Google OAuth verification process: typically 3-5 business days, but potentially longer.

**Warning signs:**
- Calendar sync stops working exactly 7 days after a user first connected.
- Errors only affect users who have not recently re-authenticated.
- Works fine in testing (because testers re-authenticate frequently) but breaks for real users.

**Phase to address:**
Deployment / go-live phase. Must be resolved before handing the app to real users.

---

### Pitfall 3: Google Calendar Scope Triggers OAuth Verification Requirement

**What goes wrong:**
Any scope that reads or writes Google Calendar events is classified by Google as "sensitive." Publishing an app that requests sensitive scopes to external users (anyone outside the Google Workspace org) without completing the OAuth App Verification process results in an "unverified app" warning screen shown to users. For a two-parent app where both parents need to authorize, this blocks adoption.

**Why it happens:**
Developers focus on building the integration and defer the verification step as "admin work." The verification requirement is easy to overlook until the app is ready to ship.

**How to avoid:**
- Request the minimum required scope: `https://www.googleapis.com/auth/calendar.events.owned` (create, change, delete events on calendars the user owns) rather than the full `calendar` scope.
- Start the OAuth verification process early — it takes 3-5 business days and may require a privacy policy URL, app description, and a demo video.
- If both users have the same Google Workspace domain (unlikely for co-parents), configure the app as internal to skip external verification.

**Warning signs:**
- OAuth consent screen shows "unverified app" warning when testing with accounts not listed as test users.
- Users are blocked by a "Google hasn't verified this app" interstitial screen.

**Phase to address:**
Auth setup phase (scope selection). Verification process must start at least 1 week before planned user handoff.

---

### Pitfall 4: Duplicate Google Calendar Events From Retry-on-Failure Sync Logic

**What goes wrong:**
When a calendar sync call fails mid-execution (network timeout, 500 error, rate limit), the sync is retried. If the first call partially succeeded (event was created in Google Calendar but the response was lost), the retry creates a second identical event. The result is two "Emma @ dad" events on the same day, which cannot be automatically deduplicated without knowing which one to delete.

**Why it happens:**
Google Calendar's events.insert endpoint uses POST semantics and is not idempotent. A retried POST creates a new event rather than finding the existing one. Developers implement retry logic without accounting for partial success.

**How to avoid:**
- Store Google Calendar event IDs in your own database at the moment of creation — this is the source of truth for which event represents which custody day.
- Use `extendedProperties.private` on Calendar events to tag them with your own internal ID (e.g., `vuoroasuminen_day_id: "2026-04-15_child_1_parent_a"`). This allows reconciliation: before creating, query by your internal ID to check if the event already exists.
- For each custody day row, store `gcal_event_id_parent_a` and `gcal_event_id_parent_b` columns. Upsert logic: if the column is populated, call `events.patch`; if null, call `events.insert` and store the returned ID.
- Never retry a create without checking if the event already exists first.

**Warning signs:**
- Parents report seeing duplicate events in Google Calendar.
- Database has a `gcal_event_id` column but it is sometimes NULL after sync.
- Sync code uses a simple retry loop without checking for existing events.

**Phase to address:**
Calendar sync implementation phase.

---

### Pitfall 5: Orphaned Events When Custody Days Are Deleted or Reassigned

**What goes wrong:**
When a parent reassigns a custody day (e.g., child moves from parent A to parent B), the old Google Calendar event on parent A's calendar is never deleted. Over time, both parents accumulate stale events that no longer reflect the actual schedule. There is no built-in cleanup mechanism.

**Why it happens:**
The sync logic only creates and updates events; it does not implement delete. Developers focus on "push current state" and forget "remove stale state." The problem is invisible during development (small amount of test data) but grows in production.

**How to avoid:**
- Treat each custody day as having two Google Calendar event IDs: one per parent calendar. On every publish (draft → published transition), reconcile by:
  1. If child is with parent A: ensure event exists in parent A's calendar, delete from parent B's calendar if present.
  2. If child is with parent B: reverse.
- Store both event IDs in the database for every custody day per child. A NULL event ID means "not currently on that parent's calendar."
- Implement a reconcile/audit function that can scan all published days, check the database IDs, and delete orphaned events on demand.

**Warning signs:**
- Parents report events appearing on the wrong parent's calendar.
- Database has no column for "which calendar is this event currently in."
- Event deletion is never called in the sync code.

**Phase to address:**
Calendar sync implementation phase. Must be designed alongside event creation, not added later.

---

### Pitfall 6: Full-Day Events and Timezone Misalignment Between Parents

**What goes wrong:**
Full-day events in Google Calendar use `start.date` and `end.date` with the format `YYYY-MM-DD` (no time, no timezone). This seems simple, but if the server constructs dates in UTC and one parent is east of UTC while the other is west, the same "2026-04-15" in UTC may render as April 14 in one parent's calendar and April 15 in the other's. The custody schedule appears to shift by one day for one parent.

**Why it happens:**
Developers store custody days as timestamps (UTC datetime) in the database rather than plain calendar dates. When converting to a Google Calendar all-day event, the UTC date is used, which may differ from the parent's local date near midnight.

**How to avoid:**
- Store custody days as plain `date` values (e.g., PostgreSQL `DATE` type, not `TIMESTAMP WITH TIME ZONE`) in the database. A custody day is "April 15, 2026" — it is not a point in time.
- Pass `YYYY-MM-DD` strings directly to Google Calendar's `start.date` and `end.date` fields. Never derive the date from a UTC timestamp at runtime.
- The Google Calendar all-day event `timeZone` field has no meaning for `date`-type events — do not set it.
- For end dates: Google Calendar all-day events are exclusive-end. An event on April 15 needs `start.date: "2026-04-15"` and `end.date: "2026-04-16"`.

**Warning signs:**
- One parent's calendar shows custody days shifted by one day compared to the other's.
- Database schema uses `TIMESTAMP` instead of `DATE` for custody day records.
- Date construction involves `new Date(...)` or `.toISOString()` anywhere in the sync path.

**Phase to address:**
Data model design phase (before any calendar sync code is written). Fix the schema type; do not patch the sync logic.

---

### Pitfall 7: Real-Time Sync Breaking Silently Without Client Reconnection

**What goes wrong:**
The real-time subscription (WebSocket/Supabase Realtime) silently drops and stops delivering updates. One parent makes a change; the other parent's UI appears up to date but is actually stale. When both parents then edit based on stale state and publish, the last write wins — but the losing parent does not know their edit was overwritten.

**Why it happens:**
WebSocket connections drop due to network interruptions, idle timeouts, or server-side disconnection (rate limits exceeded). Libraries like Supabase JS auto-reconnect at the socket level, but do not re-fetch missed changes that occurred during the disconnection window. The UI shows stale data as if it were live.

**How to avoid:**
- On reconnect, always perform a full data re-fetch for the current schedule window. Do not trust that real-time events were received during the disconnection gap.
- Implement a visible "last updated" timestamp in the UI so parents can see if data is fresh.
- Add a visible connection status indicator (connected / reconnecting / offline) so parents know when real-time is not working.
- Use Supabase Realtime's `postgres_changes` subscription with a channel presence/status listener to detect disconnection events.

**Warning signs:**
- No reconnection + re-fetch logic in the client code.
- UI has no indication of real-time connection status.
- Integration tests do not simulate WebSocket reconnection after a gap.

**Phase to address:**
Real-time collaboration implementation phase.

---

### Pitfall 8: Last-Write-Wins Causing Silent Data Loss on Simultaneous Edits

**What goes wrong:**
Both parents have the schedule open at the same time. Parent A changes Monday to "Emma with dad." Simultaneously, Parent B changes the same Monday to "Emma with mom." Both see the other parent's change momentarily, then their own write wins (or vice versa, depending on timing). One parent's intent is silently discarded, and neither parent receives any notification that a conflict occurred.

**Why it happens:**
Last-write-wins is intentional per the project spec, but the implementation often lacks the feedback loop that makes it safe. Without acknowledging the overwrite to the losing editor, they may not realize their change was discarded and act on stale assumptions.

**How to avoid:**
- Last-write-wins is the correct conflict resolution policy for this use case. The key is making overwrites visible, not preventing them.
- When a real-time update arrives that changes a cell the current user just edited, flash the cell in the UI to indicate it was changed by the other parent.
- Include a `updated_by` and `updated_at` field on each custody day row. Show "Updated by [other parent's name] X seconds ago" in the UI.
- Ensure the real-time subscription delivers the overwrite event back to the originating client, not just to other clients.

**Warning signs:**
- No `updated_by` column in the schema.
- Real-time subscription only broadcasts to "other" clients, not back to the originator.
- UI has no visual indication when a cell is remotely modified.

**Phase to address:**
Real-time collaboration implementation phase and data model phase.

---

### Pitfall 9: Draft/Publish State Machine Implemented as Boolean Flags

**What goes wrong:**
The draft state is implemented as `is_draft: boolean` or `is_published: boolean` instead of an explicit state field. As requirements evolve ("partially published" — some days published, some still draft; "re-draft after publish"), the boolean breaks down. Queries become complicated combinations of flag checks, and invalid states become possible (e.g., `is_draft: true` AND `is_published: true`).

**Why it happens:**
Boolean flags are the path of least resistance for an MVP. When only two states exist initially, a boolean seems sufficient. Adding a third state requires a migration and refactoring of all flag-based logic.

**How to avoid:**
- Use a single explicit `status` enum column per custody day: `draft | published`. This is the correct cardinality for this app's requirements.
- If the planning horizon means some days in a range are always draft and some are published, model this at the day level (each row has its own status), not at a "plan" level.
- Define valid state transitions explicitly in the API layer: only `draft → published` is allowed (a publish action); there is no "unpublish" unless explicitly designed.

**Warning signs:**
- Schema has `is_draft` and/or `is_published` boolean columns.
- API has no transition validation — any combination of flag values is accepted.
- Queries filter by multiple boolean columns to determine effective state.

**Phase to address:**
Data model design phase.

---

### Pitfall 10: Google Calendar API Rate Limits Hit During Bulk Publish

**What goes wrong:**
When a parent publishes a 12-week draft, the sync code generates up to 84 days × 2 children × 2 parent calendars = 336 individual Calendar API calls, all at once. This can exhaust the per-minute quota, resulting in 403/429 errors, partial syncs, and an inconsistent state where some calendar events are created and others are not.

**Why it happens:**
The sync logic iterates over all dirty days and fires one API call per event. Developers test with small datasets (a few days) and do not discover the quota problem until a large publish is triggered.

**How to avoid:**
- Batch Calendar API writes: use the Google Calendar batch endpoint or queue writes with a delay between them.
- Process sync writes sequentially with a small delay between calls (e.g., 50ms) rather than firing all concurrently.
- Track which days have been synced successfully (update `gcal_event_id` in the database after each successful write) so a partial sync can be resumed rather than restarted.
- On 429/403 rate-limit errors, implement exponential backoff with jitter (not a fixed retry loop).
- Display sync progress to the user for large publishes rather than blocking the UI on a single operation.

**Warning signs:**
- Sync code uses `Promise.all()` on all calendar API calls simultaneously.
- No per-event tracking of sync status in the database.
- 403 errors with `usageLimits` reason appear in logs after bulk publishes.

**Phase to address:**
Calendar sync implementation phase.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store `gcal_event_id` on the schedule table only, not per parent | Simpler schema | Cannot independently track which parent's calendar has the event; orphan cleanup is impossible | Never — add both `gcal_event_id_parent_a` and `gcal_event_id_parent_b` from the start |
| Use `TIMESTAMP` instead of `DATE` for custody days | Familiar type | Timezone-dependent date extraction causes calendar events to appear on wrong day | Never — custody days are dates, not timestamps |
| Skip the `updated_by` / `updated_at` on custody day rows | Less schema columns | Last-write-wins produces silent data loss with no audit trail | Never — add from the start; cost is negligible |
| Sync calendar in-request (synchronous HTTP calls to Google during the publish API call) | Simpler architecture | User waits for all Calendar API calls to complete; partial failures block publish response | Acceptable for MVP; refactor to background job before scale |
| Keep OAuth app in "Testing" publishing status | Skip verification process | Refresh tokens expire every 7 days; users must re-authorize weekly | Never for real users — move to Production before first external user |
| Request the full `calendar` scope instead of `calendar.events.owned` | One scope, no thought required | Users see a more alarming permissions screen; harder to pass OAuth verification | Never — use minimum required scope |
| No reconnection re-fetch after WebSocket drop | Simpler client code | Stale data served as live; edits based on stale state get silently overwritten | Never — always re-fetch on reconnect |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Google OAuth | Not requesting `access_type=offline` | Always include `access_type=offline` in the initial auth URL |
| Google OAuth | Not forcing `prompt=consent` on re-authorization flows | Use `prompt=consent` when re-authorizing to guarantee a new refresh token |
| Google OAuth | Overwriting stored refresh token with NULL when re-login returns no token | Only update the stored refresh token when a new, non-null token is received |
| Google Calendar API | Using `dateTime` fields for all-day events | Use `start.date` / `end.date` with `YYYY-MM-DD` format; do not set `start.dateTime` |
| Google Calendar API | All-day event end date equals start date | End date must be the day after the event: a single-day event on April 15 needs `end.date: "2026-04-16"` |
| Google Calendar API | Using POST (insert) for retries without checking existence | Store the returned event ID; use PATCH/update for existing events, INSERT only for new ones |
| Google Calendar API | Firing all sync writes concurrently | Serialize with delay or batch to stay within per-minute quota |
| Google Calendar API | Not storing `extendedProperties.private` with your internal ID | Tag every created event with your custody-day ID so you can find it without a full list scan |
| Supabase Realtime | Assuming no changes were missed after reconnect | Re-fetch full schedule window on every reconnect event |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Synchronous bulk Calendar API calls on publish | UI hangs for 10-60s during large publishes; intermittent 429 errors | Move to async background job with per-event status tracking | Any publish of more than ~20 days |
| Statistics computed from full table scan on every view | Stats panel is slow for larger date windows | Compute via indexed query on `DATE` column with a covering index on `(child_id, parent_id, status, day)` | Not a concern at 2-user scale; fine for MVP |
| Re-syncing all calendar events on every publish (not just changed ones) | Quota exhausted on moderate-sized publishes | Track `is_dirty` or `last_synced_at` per custody day; only sync rows that changed since last sync | Any incremental edit-and-publish cycle |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing Google refresh tokens in client-accessible storage (localStorage, cookies without `httpOnly`) | Token theft allows attacker to read/write both parents' Google Calendars | Store refresh tokens server-side only, never sent to the browser |
| Not validating that the user making a schedule edit belongs to this specific co-parenting pair | User A could edit User C's custody schedule if IDs are enumerable | Enforce at RLS/query level: every custody day write must verify the user is one of the two parents in the household |
| Accepting any Google account as valid — not restricting to the two known parents | Any Google user who discovers the app URL could register and create a new "household" | Application-layer: after OAuth login, check if the Google user is pre-registered as parent A or B; reject unknown accounts |
| Logging refresh tokens or access tokens in application logs | Tokens in logs = tokens in log aggregation services = wide exposure | Never log token values; log only token presence (e.g., `refresh_token: [present]`) |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No indication of real-time connection status | Parent edits thinking they're seeing live data; edits overwritten without notice | Show a subtle "live" / "reconnecting" / "offline" indicator in the schedule header |
| Calendar sync progress not communicated during large publish | Parent clicks "Publish" and sees a spinner for 30+ seconds with no feedback | Show per-day sync progress, or "Syncing X of Y events to Google Calendar" |
| Ambiguous "publish" button with no confirmation of scope | Parent accidentally publishes 12 weeks of draft changes | Show summary: "Publishing 14 changes across 2 children for Apr 15 – Jul 15" with a confirm step |
| No indication when another parent's edit overwrites your recent change | Parent acts on stale data, coordination breaks down | Flash changed cells in the schedule table when a remote update arrives |
| Refresh token revocation (password change, app uninstall) causes silent calendar sync failure | Custody schedule updates stop appearing in Google Calendar without explanation | Detect 401/403 on sync calls, surface a banner: "Google Calendar connection lost — reconnect your account" |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Google OAuth:** Appears to work in dev/testing — verify that `access_type=offline` is set and a refresh token is actually stored in the database (not just in session).
- [ ] **Calendar sync:** Events appear in Google Calendar — verify that each created event has its ID stored in the database AND tagged with `extendedProperties.private` containing your internal day ID.
- [ ] **Orphan cleanup:** Events are updated when custody changes — verify that when a child moves from parent A to parent B, the old event is DELETED from parent A's calendar (not just a new one created on parent B's).
- [ ] **All-day event dates:** Events appear on the correct day — verify with a user in UTC+3 and a user in UTC-8 that the same day renders identically in both Google Calendars.
- [ ] **Reconnect behavior:** Real-time updates appear live — verify that if you close the laptop lid and reopen it 5 minutes later, the schedule re-fetches current state before accepting new edits.
- [ ] **OAuth publishing status:** Calendar sync works in testing — verify the Google Cloud Console shows "Production" (not "Testing") publishing status before giving app to real users.
- [ ] **Draft/publish state:** Publish button works — verify that re-publishing an already-published day calls `events.patch` (not `events.insert`, which would create a duplicate).
- [ ] **Statistics:** Stats panel shows correct numbers — verify the query counts days by the `DATE` column value, not by timestamp-derived date.

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Duplicate calendar events | MEDIUM | Query Google Calendar for all events with your internal `extendedProperties` tag; identify duplicates by same day/child/parent; delete extras; update database IDs |
| Orphaned calendar events (missing from DB) | MEDIUM | Run a reconciliation script: for each DB row with a non-null `gcal_event_id`, verify the event still exists in Google Calendar; for events not in DB, search by `extendedProperties` tag and re-link or delete |
| Lost refresh token (user must re-authorize) | LOW | Implement "Reconnect Google Calendar" button that forces `prompt=consent`; one-time user action |
| Partial sync after rate limit hit | LOW | Per-event `gcal_synced_at` tracking means re-running sync only retries unsynced rows; no full resync needed |
| Wrong dates on calendar events (UTC vs local date bug) | HIGH | Requires data migration: delete all Google Calendar events, fix the `DATE` column type in DB, re-sync everything |
| OAuth app stuck in Testing mode (7-day token expiry) | MEDIUM | Update publishing status to Production in Google Cloud Console; affected users must re-authorize once |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Refresh token not stored on re-login | Auth setup | Verify DB has `refresh_token` column; confirm token is stored after OAuth callback; confirm existing token is NOT overwritten with null |
| 7-day token expiry in Testing mode | Pre-launch / deployment | Verify Google Cloud Console shows Production publishing status |
| OAuth sensitive scope verification | Auth setup (start process early) | Verify OAuth consent screen passes without "unverified app" warning for non-test-user accounts |
| Duplicate events from retried inserts | Calendar sync implementation | Verify: re-running sync on already-synced days does not create new events |
| Orphaned events on custody reassignment | Calendar sync implementation | Verify: changing a day from parent A to parent B deletes the old event from parent A's calendar |
| Date rendered on wrong day due to UTC/local mismatch | Data model design | Verify: schema uses `DATE` type; test with users in different timezones; confirm calendar shows same date for both |
| Stale data after WebSocket reconnect | Real-time collaboration | Verify: simulate disconnect (disable network 30s), reconnect, confirm schedule re-fetches |
| Silent overwrite without visual feedback | Real-time collaboration | Verify: two browser sessions, one edits a cell, other session sees cell flash as updated |
| Draft/publish implemented as boolean flags | Data model design | Verify: schema has single `status` enum, not `is_draft`/`is_published` booleans |
| Rate limit hit during bulk publish | Calendar sync implementation | Verify: publishing a 12-week window completes without 429 errors; per-event sync status tracked in DB |

---

## Sources

- Google OAuth 2.0 for Web Server Applications (official, verified): https://developers.google.com/identity/protocols/oauth2/web-server
- Google Calendar API Scopes (official): https://developers.google.com/workspace/calendar/api/auth
- Google Sensitive Scope Verification (official): https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification
- Google Calendar Sync Guide — sync tokens, 410 handling, incremental sync (official): https://developers.google.com/workspace/calendar/api/guides/sync
- Google Calendar API Events Reference — date vs dateTime fields (official): https://developers.google.com/workspace/calendar/api/v3/reference/events
- Google Calendar Extended Properties Guide (official): https://developers.google.com/workspace/calendar/api/guides/extended-properties
- Google Calendar API Quota Management (official): https://developers.google.com/workspace/calendar/api/guides/quota
- Google Automatic OAuth Token Revocation on Password Change (official): https://support.google.com/a/answer/6328616
- Supabase Realtime Limits (official): https://supabase.com/docs/guides/realtime/limits
- Supabase Realtime Authorization / RLS (official): https://supabase.com/docs/guides/realtime/authorization
- Google OAuth Testing Mode 7-day expiry (community, corroborated by multiple sources): https://forums.homeseer.com/forum/internet-or-network-related-plug-ins/internet-or-network-discussion/ak-google-calendar-alexbk66/1545936-refresh-token-expires-in-7-days-if-oauth-consent-screen-publishing-status-is-testing
- Nango Blog — "invalid_grant: Token has been expired or revoked" patterns (community, MEDIUM confidence): https://nango.dev/blog/google-oauth-invalid-grant-token-has-been-expired-or-revoked

---

*Pitfalls research for: Co-parenting custody scheduling app with Google Calendar integration (vuoroasuminen)*
*Researched: 2026-04-04*
