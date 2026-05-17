---
status: partial
phase: 13-invite-access-gate
source: [13-VERIFICATION.md]
started: 2026-05-17T00:00:00Z
updated: 2026-05-17T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Full invite acceptance OAuth flow
expected: Cookie set in browser survives Google OAuth roundtrip; after sign-in, family_config.parent2_email updated to actual sign-in email; invite_tokens.used_at stamped; redirect to /dashboard
result: [pending]

### 2. Dashboard invite section hides after Parent B joins
expected: When signed in as Parent A, InviteSection is visible when Parent B has not yet joined; after Parent B completes invite flow, InviteSection disappears from dashboard
result: [pending]

### 3. Copy button 2-second icon toggle
expected: Clicking copy button switches to Check icon (green) for 2 seconds, then reverts to Copy icon; no toast notification
result: [pending]

### 4. Regenerate button updates without page reload
expected: Clicking "Luo uusi linkki" button calls generateInviteToken Server Action, updates invite URL in Input field, resets status to active — no page reload
result: [pending]

### 5. Unrecognized email middleware gate
expected: Signing in with a Google account whose email is not parent1_email or parent2_email in family_config results in redirect to /auth/error?error=unauthorized_email and session is signed out
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
