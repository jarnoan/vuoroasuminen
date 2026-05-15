---
status: complete
phase: 10-auth-js-removal
source: [10-01-SUMMARY.md, 10-02-SUMMARY.md, 10-03-SUMMARY.md, 10-04-SUMMARY.md]
started: "2026-05-15T00:00:00Z"
updated: "2026-05-15T10:00:00Z"
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server. Start fresh with `npm run dev`. Server boots without errors, home/login page loads in browser.
result: pass

### 2. Father Signs In
expected: Visit the app. Click "Sign in with Google". Complete OAuth with Father's account. Dashboard loads with the custody schedule visible.
result: pass

### 3. Mother Signs In
expected: Sign out (or use another browser/incognito). Sign in with Mother's Google account. Dashboard loads with the same custody schedule visible.
result: pass

### 4. Schedule Data Intact
expected: The custody schedule shows the same data as before Phase 10 (no lost entries). Children assignments and dates are correct.
result: pass

### 5. GCal Publish Round-Trip
expected: Click "Julkaise" (Publish). The events appear in the signed-in parent's Google Calendar. No errors shown in the UI.
result: issue
reported: "Maximum update depth exceeded in ScheduleTable.useEffect at schedule-table.tsx:100 — onDaysChangeRef.current?.(days) inside useEffect with [days] dependency"
severity: major

### 6. Old Auth Routes Return 404
expected: Visit `/api/auth/signin` (or any `/api/auth/*` URL). The browser shows a 404 response — no NextAuth handler exists anymore.
result: pass

## Summary

total: 6
passed: 5
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "Click Julkaise — events appear in Google Calendar, no errors in UI"
  status: failed
  reason: "User reported: Maximum update depth exceeded in ScheduleTable.useEffect at schedule-table.tsx:100 — onDaysChangeRef.current?.(days) inside useEffect with [days] dependency"
  severity: major
  test: 5
  artifacts: [src/components/schedule/schedule-table.tsx]
  missing: []
