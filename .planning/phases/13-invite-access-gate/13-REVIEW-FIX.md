---
phase: 13-invite-access-gate
fixed_at: 2026-05-17T14:00:00Z
review_path: .planning/phases/13-invite-access-gate/13-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 4
skipped: 1
status: partial
---

# Phase 13: Code Review Fix Report

**Fixed at:** 2026-05-17T14:00:00Z
**Source review:** .planning/phases/13-invite-access-gate/13-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (CR-01, CR-02, WR-01, WR-02, WR-03)
- Fixed: 4
- Skipped: 1 (WR-01 — reviewer explicitly stated no code change required)

## Fixed Issues

### CR-01: Race condition — two valid invite tokens can coexist briefly

**Files modified:** `src/actions/invite.ts`
**Commit:** 8363a1d
**Applied fix:** Wrapped the `delete` + `insert` in `db.transaction()` so the two operations are atomic. Also captured `user.email` into a `const createdBy` before the transaction so TypeScript's narrowing holds inside the async callback (without this, `tsc` reported `string | undefined` errors on the transaction body even though the outer guard already checked `user.email`).

---

### CR-02: `invite_token` cookie missing `Secure` flag conditional — breaks dev

**Files modified:** `src/app/invite/[token]/invite-sign-in-button.tsx`
**Commit:** 4f5aeac
**Applied fix:** Replaced the hard-coded `; Secure` suffix with a conditional based on `window.location.protocol === "https:"`. On `http://localhost` the flag is omitted so the browser actually sets the cookie; on production HTTPS the flag is included as before. Updated the JSDoc comment to document the rationale.

---

### WR-02: `handleCopy` swallows `navigator.clipboard` errors silently

**Files modified:** `src/components/invite/invite-section.tsx`, `src/app/setup/steps/step-complete.tsx`
**Commit:** c0bd104
**Applied fix:** Wrapped both `await navigator.clipboard.writeText(inviteUrl)` calls in `try/catch`. On error the catch block swallows the exception gracefully (the user can still copy manually from the read-only input). The `setCopied(true)` + timeout remain inside the `try` block so the button visual feedback only fires on success.

---

### WR-03: `supabase.auth.signOut()` called after `errorRedirect` is already built

**Files modified:** `src/proxy.ts`
**Commit:** 912fd91
**Applied fix:** Moved `await supabase.auth.signOut()` to run before `NextResponse.redirect(...)` is constructed. The redirect response is then built and the post-signOut cookie state is copied onto it in a single pass. This eliminates the redundant first cookie copy and the ordering hazard where the same cookie name could be set twice with live-then-cleared values.

---

## Skipped Issues

### WR-01: Invite page leaks token timing via DB query (timing oracle)

**File:** `src/app/invite/[token]/page.tsx:25-34`
**Reason:** Reviewer explicitly stated "No code change required" and "it is acceptable to defer" for this two-parent app. The UI already presents identical HTML for all invalid states. No actionable fix was prescribed.
**Original issue:** The DB query structure allows a timing oracle to distinguish "token not in DB" from "token in DB but invalid". Low severity for a two-parent application.

---

_Fixed: 2026-05-17T14:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
