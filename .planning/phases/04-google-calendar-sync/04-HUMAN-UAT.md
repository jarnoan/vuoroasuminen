---
status: partial
phase: 04-google-calendar-sync
source: [04-VERIFICATION.md]
started: 2026-04-08T21:57:00Z
updated: 2026-04-12T21:45:00Z
---

## Current Test

[awaiting human testing — plan 04-02 added observability logging and UI error toast to help diagnose issues]

## Tests

### 1. Server-side observability smoke test (NEW — from plan 04-02)
expected: With server running, make one cell change to create a draft entry, then click Publish. Server stdout shows [GCal sync] Published entries in window: N, per-parent log lines for entry count / orphan deletes / creates, and [publishDraft] syncResult: with the full JSON object.
result: pending

### 2. Sync failure toast smoke test (NEW — from plan 04-02)
expected: Temporarily set an invalid calendarId for one parent in src/config/app.ts, then publish a draft. "Published N entries" success toast appears immediately; a second "Calendar sync failed: parentId: ..." warning toast appears with 10-second duration.
result: pending

### 3. End-to-end GCal sync smoke test (re-test after fix)
expected: Server logs show syncResult with created: N for at least one parent; the corresponding all-day event appears in that parent's Google Calendar with the format "ChildName @ ParentName"
result: pending
prior_result: issue
prior_reported: "after publishing, I don't see any syncResult in server output, and no calendar events appear in google calendars. No errors in server output or browser."
fix_applied: "plan 04-02 added [GCal sync] logging and [publishDraft] syncResult log — re-test to verify sync is now observable"

### 4. Orphan cleanup on custody switch
expected: After toggling one day's custody to the other parent and publishing again, the event disappears from the original parent's calendar and appears in the new parent's calendar. No duplicates exist in either calendar.
result: pending
prior_result: blocked
prior_blocked_by: test-3

### 5. Idempotency on re-publish
expected: Second publish (no cell changes) returns created: 0, deleted: 0 for both parents. No duplicate events in either calendar.
result: pending
prior_result: blocked
prior_blocked_by: test-3

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
