---
status: complete
phase: 04-google-calendar-sync
source: [04-VERIFICATION.md]
started: 2026-04-08T21:57:00Z
updated: 2026-04-12T21:45:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Server-side observability smoke test (NEW — from plan 04-02)
expected: With server running, make one cell change to create a draft entry, then click Publish. Server stdout shows [GCal sync] Published entries in window: N, per-parent log lines for entry count / orphan deletes / creates, and [publishDraft] syncResult: with the full JSON object.
result: issue
reported: "Logs appear and syncResult is present, but success: false — both parents fail with invalid_grant 'Token has been expired or revoked' for jarnoan@gmail.com. Signing out and back in does not fix it."
severity: blocker

### 2. Sync failure toast smoke test (NEW — from plan 04-02)
expected: Temporarily set an invalid calendarId for one parent in src/config/app.ts, then publish a draft. "Published N entries" success toast appears immediately; a second "Calendar sync failed: parentId: ..." warning toast appears with 10-second duration.
result: pass

### 3. End-to-end GCal sync smoke test (re-test after fix)
expected: Server logs show syncResult with created: N for at least one parent; the corresponding all-day event appears in that parent's Google Calendar with the format "ChildName @ ParentName"
result: pass
prior_result: issue
prior_reported: "after publishing, I don't see any syncResult in server output, and no calendar events appear in google calendars. No errors in server output or browser."
fix_applied: "plan 04-02 added [GCal sync] logging and [publishDraft] syncResult log — re-test to verify sync is now observable"

### 4. Orphan cleanup on custody switch
expected: After toggling one day's custody to the other parent and publishing again, the event disappears from the original parent's calendar and appears in the new parent's calendar. No duplicates exist in either calendar.
result: pass
prior_result: blocked
prior_blocked_by: test-3

### 5. Idempotency on re-publish
expected: Second publish (no cell changes) returns created: 0, deleted: 0 for both parents. No duplicate events in either calendar.
result: skipped
reason: Publish button is disabled when no draft changes exist — UI prevents re-publish, making this a non-scenario in practice.

## Summary

total: 5
passed: 3
issues: 1
pending: 0
skipped: 1
blocked: 0

## Gaps

- truth: "GCal sync completes successfully after signing in — tokens in DB are valid"
  status: failed
  reason: "User reported: invalid_grant on token exchange even after signing out and back in. Re-sign-in issues a new refresh_token to the JWT cookie but does not update the accounts table in DB. DB retains the original first-sign-in token which Google has revoked."
  severity: blocker
  test: 1
  root_cause: "jwt callback `if (account)` branch updates the JWT cookie but not the accounts table. DrizzleAdapter.linkAccount only runs on first sign-in. Subsequent sign-ins leave DB refresh_token stale."
  fix: "In jwt callback, when `account` is present, fire-and-forget db.update(accounts) with the new tokens (same pattern as the refresh path already does)."
  artifacts:
    - src/auth.ts (jwt callback, if (account) branch, ~line 19)
  missing: []
