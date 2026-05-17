---
phase: 13-invite-access-gate
reviewed: 2026-05-17T13:33:44Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - src/actions/invite.ts
  - src/app/auth/callback/route.ts
  - src/app/auth/error/page.tsx
  - src/app/dashboard/page.tsx
  - src/app/invite/[token]/invite-sign-in-button.tsx
  - src/app/invite/[token]/page.tsx
  - src/app/setup/setup-wizard.tsx
  - src/app/setup/steps/step-complete.tsx
  - src/components/invite/invite-section.tsx
  - src/proxy.ts
findings:
  critical: 2
  warning: 3
  info: 3
  total: 8
status: issues_found
---

# Phase 13: Code Review Report

**Reviewed:** 2026-05-17T13:33:44Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

This phase implements the invite-and-access-gate feature: Parent A generates a single-use invite link, Parent B opens it and signs in via Google OAuth, the callback redeems the token and registers Parent B, and the middleware enforces that only the two configured parents can access protected routes.

The overall design is sound and the security intent is correct. Two critical issues were found: a race condition in token generation that could allow a second valid token to exist simultaneously, and a cookie attribute that strips the `Secure` flag in non-HTTPS environments (making the invite token readable by JavaScript in development, which trains bad habits and could bite in staging). Three warnings cover an unprotected invite page server component exposing token timing details, a missing `try/catch` around a clipboard operation, and a silent no-op when `signOut()` is called before the redirect response object is wired. Three informational items cover minor quality points.

---

## Critical Issues

### CR-01: Race condition — two valid invite tokens can coexist briefly

**File:** `src/actions/invite.ts:37-49`

**Issue:** The action deletes prior unused tokens and then inserts a new one as two separate, non-transactional statements. If two concurrent requests call `generateInviteToken()` for the same user (e.g., a double-click or two open browser tabs), both see zero unused rows during the delete phase and both successfully insert a new token. The D-06 constraint ("one outstanding token per creator") is violated for the window between the two inserts. The second insert will succeed because the unique constraint is on the `token` column (random value), not on `(created_by, used_at IS NULL)`.

**Fix:** Wrap the delete + insert in a single transaction so the constraint is atomic:

```typescript
await db.transaction(async (tx) => {
  await tx.delete(inviteTokens).where(
    and(
      eq(inviteTokens.createdBy, user.email),
      isNull(inviteTokens.usedAt),
    )
  )
  await tx.insert(inviteTokens).values({
    token,
    createdBy: user.email,
    expiresAt,
  })
})
```

---

### CR-02: `invite_token` cookie missing `HttpOnly` — token exposed to JavaScript in non-HTTPS environments

**File:** `src/app/invite/[token]/invite-sign-in-button.tsx:26`

**Issue:** The invite token cookie is written with `document.cookie`, which cannot set `HttpOnly` (the browser silently ignores any `HttpOnly` attribute set via `document.cookie`). The comment on line 15 acknowledges this. However, the `Secure` attribute is also included in the string:

```
document.cookie = `invite_token=${token}; Max-Age=600; Path=/; SameSite=Lax; Secure`
```

On `http://localhost`, the `Secure` flag causes browsers to silently drop the cookie entirely — the invite flow will fail in development with no visible error. The token will never reach `/auth/callback` and the invite cannot be redeemed locally.

In addition, because `HttpOnly` is absent, any XSS on any page served from the same origin within the 10-minute window can read `document.cookie` and exfiltrate the invite token to pre-empt redemption. For a two-person app the XSS risk is low, but the development breakage is a definite bug.

**Fix:** Conditionally include `Secure` based on environment, and add a comment explaining why `HttpOnly` is not used here:

```typescript
const isSecure = window.location.protocol === "https:"
const secureFlag = isSecure ? "; Secure" : ""
document.cookie = `invite_token=${token}; Max-Age=600; Path=/; SameSite=Lax${secureFlag}`
```

An even better alternative is to skip the `document.cookie` approach entirely and instead pass the token as a query parameter to the OAuth `redirectTo` URL, then read it back server-side from the state or a custom query param after the OAuth callback. That approach avoids the `HttpOnly` limitation. However, the query-param route requires changes to the callback handler as well, so the conditional `Secure` fix is the minimal correct change.

---

## Warnings

### WR-01: Invite page leaks token timing via DB query (timing oracle)

**File:** `src/app/invite/[token]/page.tsx:25-34`

**Issue:** The server component queries the database unconditionally using the raw token value from the URL. If the token does not exist, the query returns no rows quickly. If the token exists but is expired or used, the query returns a row and then inspects fields. An attacker who can observe response latency (or measure server-side timing via repeated requests) can distinguish "token not in DB" from "token in DB but invalid". This is a minor timing oracle for token existence.

More practically: the page renders identical HTML for all invalid states (expired, used, nonexistent) which is the right UX behavior, but the DB query structure gives slightly more information than necessary.

**Fix:** This is low severity for a two-parent app, but the cleanest fix is to use a constant-time lookup that always fetches the row (as it does today) and ensure the error path is identical regardless of which invalid state was hit — which the current code already does for the UI. No code change required for the UI. Consider adding a short `sleep` to equalize latency if timing attacks become a concern, but for this use case it is acceptable to defer.

The more actionable concern on this page: the component directly queries the database (`db.select().from(inviteTokens)`) without any authentication gate. This means the invite page is world-readable for anyone who can guess a token — which is expected and acceptable — but it also means the DB connection pool is consumed by unauthenticated traffic. For a two-user app this is fine, but it is worth documenting. No code change needed.

---

### WR-02: `handleCopy` swallows `navigator.clipboard` errors silently

**File:** `src/components/invite/invite-section.tsx:59-63` and `src/app/setup/steps/step-complete.tsx:38-42`

**Issue:** Both `handleCopy` functions call `await navigator.clipboard.writeText(inviteUrl)` without a `try/catch`. The Clipboard API throws `DOMException` when:
- The page does not have focus (common when the user switches tabs while clicking)
- The site is not served over HTTPS (development)
- The browser permission is denied

When the exception is thrown, the `copied` state is never set to `true`, but there is no error feedback either. The user clicks "Copy", nothing happens, no error is shown. This is silent failure.

**Fix:**

```typescript
async function handleCopy() {
  if (!inviteUrl) return
  try {
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  } catch {
    // clipboard not available — fall back to selection
    // (could also show a toast/error state here)
  }
}
```

At minimum, wrap the call and avoid the unhandled rejection. A richer fix shows a fallback "select all" on the input or a brief error message.

---

### WR-03: `supabase.auth.signOut()` called after `errorRedirect` is already built — session cookies may not clear

**File:** `src/proxy.ts:82-94`

**Issue:** The sign-out sequence is:
1. Build `errorRedirect` (line 82)
2. Copy cookies from `response` to `errorRedirect` (line 86–88) — `response` has not been modified by `signOut` yet
3. Call `await supabase.auth.signOut()` (line 89) — this writes cookie-clearing `Set-Cookie` headers into `response`
4. Copy cookies again from `response` to `errorRedirect` (line 91–93) — this second copy should pick up the signOut cookies

The intent (second copy after signOut) is correct in principle, but `createSupabaseMiddlewareClient` wires `setAll` to write cookies into `response` (line 26 of `src/lib/supabase/middleware.ts`). So the second copy on lines 91–93 should work. However, if the Supabase client internally calls `setAll` synchronously during `signOut()`, the cookies on `response` at line 91 will include the clearing headers. If it calls `setAll` asynchronously (after the `await` resolves), this is also fine because the `await` on line 89 ensures completion before line 91.

The real concern is the first copy (lines 86–88) is redundant and potentially misleading — at that point `response` only has the session-refresh cookies from `getUser()`, not the signOut cookies. The first copy could be removed without changing behavior. If it is kept, there is a small risk that the signOut cookies from the second copy overwrite the first-copy cookies with stale values, depending on how `cookies.set` handles duplicate names. This could result in the session cookie being set twice on `errorRedirect` — once with the live session value and once with the cleared value — with the last-write winning.

**Fix:** Remove the first cookie copy and keep only the post-signOut copy:

```typescript
// Sign out first, THEN build redirect with the cleared cookies
await supabase.auth.signOut()

const errorRedirect = NextResponse.redirect(
  new URL("/auth/error?error=unauthorized_email", request.url),
)
response.cookies.getAll().forEach(({ name, value, ...options }) => {
  errorRedirect.cookies.set(name, value, options)
})
return errorRedirect
```

This ensures `response` contains only the post-signOut cookie state when copied to `errorRedirect`.

---

## Info

### IN-01: `getActiveInviteToken` returns `status: "expired"` with `token: ""` for the no-token case — callers must handle the empty string

**File:** `src/actions/invite.ts:84-87`

**Issue:** When no token has ever been generated, the function returns `{ success: true, token: "", expiresAt: new Date(0), status: "expired" }`. The caller in `src/app/dashboard/page.tsx` passes this to `InviteSection` as `initialToken`. In `InviteSection`, `inviteUrl = token ? \`${origin}/invite/${token}\` : ""` correctly guards against the empty string. However, a `status: "none_yet"` variant would make the absence case explicit and prevent future callers from accidentally rendering an empty invite URL without the guard.

**Fix (optional):** Add `"none_yet"` to the status union and return it instead of `"expired"` when no row exists. Update `InviteSection.renderStatus()` to handle `"none_yet"` with a "No invite generated yet" message.

---

### IN-02: Commented-out `console.log` in production-bound code

**File:** `src/app/auth/callback/route.ts:52-55`

**Issue:** Three `console.log` calls at lines 52, 55, and 74 and additional ones at 80 and 110 are left in the callback route. These are informational/debug traces that will appear in production server logs. The `console.error` calls for genuine error paths are appropriate, but the informational `console.log` statements log every successful authentication event including user email addresses.

**Fix:** Remove or replace with a structured logger that respects log levels. At minimum, guard with `process.env.NODE_ENV !== "production"` or use `console.debug`.

---

### IN-03: `setup-wizard.tsx` advances to step 4 on `setStep(4)` but `StepIndicator` likely only shows steps 1–3

**File:** `src/app/setup/setup-wizard.tsx:52` and `src/app/setup/steps/step-complete.tsx`

**Issue:** The wizard has 4 steps but `StepComplete` is rendered outside the normal step flow (step 4 is a completion screen, not a wizard step). The `StepIndicator` component receives `current={step}` where step can be 4. If `StepIndicator` does not handle step 4 (e.g., it renders only 3 dots), the indicator may show an incorrect or out-of-bounds active state on the completion screen. This is a cosmetic issue — the code renders correctly for steps 1–3 and the `StepComplete` component is functional — but if `StepIndicator` uses array indexing or a hardcoded max step count, it may render an error or show no indicator at all.

**Fix:** Either exclude `StepIndicator` from rendering when `step === 4`, or ensure the indicator gracefully handles `current > maxStep`. A quick defensive fix in `setup-wizard.tsx`:

```typescript
{step < 4 && <StepIndicator current={step} />}
```

---

_Reviewed: 2026-05-17T13:33:44Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
