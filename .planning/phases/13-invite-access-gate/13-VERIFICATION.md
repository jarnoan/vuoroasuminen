---
phase: 13-invite-access-gate
verified: 2026-05-17T13:37:58Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Full invite acceptance flow — visit /invite/<valid-token>, click sign-in, complete Google OAuth, land on /dashboard"
    expected: "Parent B lands on /dashboard; family_config.parent2_email updated to Parent B's email; invite_tokens.usedAt stamped"
    why_human: "Requires live OAuth roundtrip and DB state inspection — cannot verify cookie-to-callback chain programmatically"
  - test: "Dashboard invite section hides after Parent B joins"
    expected: "Logged in as Parent A, visit /dashboard — InviteSection visible. Log in as Parent B via invite. Return to /dashboard as Parent A — InviteSection absent"
    why_human: "Requires two separate sessions and user_google_tokens row creation to observe conditional render"
  - test: "Copy button 2-second icon toggle"
    expected: "Click copy button — icon changes from Copy to Check (green) for 2 seconds, then reverts"
    why_human: "Time-based UI state change requires browser interaction"
  - test: "Regenerate button updates InviteSection without page reload"
    expected: "Click 'Luo uusi linkki' in dashboard — Loader2 spins, then new URL appears in Input"
    why_human: "Requires live Server Action call and UI state update observation"
  - test: "Middleware unrecognized email gate"
    expected: "Sign in as a Google account not matching parent1_email or parent2_email — redirected to /auth/error?error=unauthorized_email with 'Paasy estetty' page, session cleared"
    why_human: "Requires a third Google account and live Supabase session invalidation check"
---

# Phase 13: Invite + Access Gate Verification Report

**Phase Goal:** First parent can share an invite link; second parent opens it, signs in with Google, and gets app access automatically. Unauthenticated or un-onboarded users are redirected to the appropriate setup step.
**Verified:** 2026-05-17T13:37:58Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | First parent can generate a shareable invite URL from within the app | VERIFIED | `generateInviteToken` called on mount in `StepComplete` + regenerate in `InviteSection`; both wired to `src/actions/invite.ts` |
| 2 | Second parent opens invite URL, signs in with Google, and lands on schedule — no manual config required | VERIFIED | `/invite/[token]/page.tsx` validates token + `InviteSignInButton` sets cookie; `auth/callback/route.ts` consumes cookie, updates `parent2Email`, redirects to `/dashboard` |
| 3 | An expired or used invite token is rejected with a clear Finnish error message | VERIFIED | `page.tsx` checks `row.usedAt === null && row.expiresAt > new Date()`; invalid state renders `AlertTitle: "Kutsu ei ole enää voimassa"` with no sign-in button |
| 4 | Visiting the schedule URL without being signed in redirects to the sign-in page | VERIFIED | `proxy.ts` Tier 1: `if (!user && !isExempt) return NextResponse.redirect(new URL("/", request.url))` |
| 5 | Visiting the schedule URL signed in but with onboarding incomplete redirects to the setup wizard | VERIFIED | `proxy.ts` Tier 2: `if (!configRow) return NextResponse.redirect(new URL("/setup", request.url))` |

**Score:** 5/5 roadmap success criteria verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/actions/invite.ts` | generateInviteToken + getActiveInviteToken Server Actions | VERIFIED | Both functions exported; `"use server"` directive; 43-char base64url token; 72h expiry; prior-token cleanup with `isNull` |
| `src/app/invite/[token]/page.tsx` | Invite acceptance page — server-side token validation | VERIFIED | Server Component; queries `inviteTokens` with `eq(inviteTokens.token, token)`; checks `usedAt === null && expiresAt > new Date()`; renders valid/invalid states |
| `src/app/invite/[token]/invite-sign-in-button.tsx` | Client Component — sets cookie, triggers OAuth | VERIFIED | `"use client"`; sets `invite_token` cookie with `Max-Age=600; SameSite=Lax; Secure`; calls `signInWithOAuth` with `prompt:consent + access_type:offline` |
| `src/app/setup/steps/step-complete.tsx` | StepComplete — fetches invite token and shows copy-to-clipboard URL | VERIFIED | `"use client"`; calls `generateInviteToken()` in `useEffect`; copy button with 2s `Check` icon; `parent2Name` prop injected from `SetupWizard` |
| `src/components/invite/invite-section.tsx` | InviteSection — dashboard invite card with copy + regenerate | VERIFIED | `"use client"`; all three status variants rendered; regenerate calls `generateInviteToken()`; Input + copy button disabled when link not active |
| `src/app/dashboard/page.tsx` | Dashboard — conditionally renders InviteSection | VERIFIED | Queries `user_google_tokens` for `parent2Email`; `parentBJoined` flag controls render; `getActiveInviteToken()` result passed as props |
| `src/app/auth/callback/route.ts` | Invite cookie consumption — validates, updates parent2_email, marks used | VERIFIED | Reads `invite_token` cookie; validates with `isNull + gt`; updates `familyConfig.parent2Email`; stamps `usedAt/usedBy`; clears cookie with `maxAge: 0`; wrapped in try/catch |
| `src/app/auth/error/page.tsx` | Auth error page — unauthorized_email Finnish variant | VERIFIED | `useSearchParams` detects `?error=unauthorized_email`; renders "Pääsy estetty" with no Button; default calendar-scope variant with retry button preserved; `Suspense` boundary wrapping |
| `src/proxy.ts` | Three-tier middleware gate | VERIFIED | Tier 1: unauthenticated → `/`; Tier 2: no config → `/setup`; Tier 3: unrecognized email → signOut + `/auth/error?error=unauthorized_email`; exempt routes: `/`, `/auth/*`, `/invite/*`, `/setup` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/actions/invite.ts` | `invite_tokens` DB table | `db.insert(inviteTokens)` + `db.delete(inviteTokens)` | WIRED | `isNull(inviteTokens.usedAt)` delete filter present; insert wired correctly |
| `src/app/invite/[token]/page.tsx` | `auth/callback` | `invite_token` cookie set in `InviteSignInButton` before OAuth redirect | WIRED | Cookie set via `document.cookie = "invite_token=..."` with `Max-Age=600`; `redirectTo: .../auth/callback` |
| `src/app/auth/callback/route.ts` | `invite_tokens` DB table | `db.update(inviteTokens).set({ usedAt, usedBy })` | WIRED | Update executes when `tokenRow` found |
| `src/app/auth/callback/route.ts` | `family_config.parent2_email` | `db.update(familyConfig).set({ parent2Email: userEmail })` | WIRED | Update with `.where(eq(familyConfig.id, 1))`; `updatedAt` also set |
| `src/app/auth/error/page.tsx` | `?error=unauthorized_email` query param | `useSearchParams().get("error")` | WIRED | `errorType === "unauthorized_email"` branch renders "Pääsy estetty" variant |
| `src/proxy.ts` | `family_config` DB table | `db.select({parent1Email, parent2Email}).from(familyConfig)` | WIRED | Inside `proxy()` function body (not module scope — D-13 compliant) |
| `src/proxy.ts` | `/auth/error?error=unauthorized_email` | `NextResponse.redirect` on unrecognized email | WIRED | `supabase.auth.signOut()` called; cookies copied to redirect response |
| `src/app/setup/steps/step-complete.tsx` | `src/actions/invite.ts` | `generateInviteToken()` call in `useEffect` | WIRED | Import present; called on mount |
| `src/components/invite/invite-section.tsx` | `src/actions/invite.ts` | `generateInviteToken()` in `handleRegenerate` | WIRED | Import present; called on regenerate button click |
| `src/app/dashboard/page.tsx` | `user_google_tokens` table | `db.select().from(userGoogleTokens).where(eq(..., parent2Email))` | WIRED | `parentBJoined = !!parent2TokenRow` used in JSX conditional |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `InviteSection` | `initialToken, initialExpiresAt, initialStatus` | `getActiveInviteToken()` → DB `select` from `invite_tokens` | Yes — queries `invite_tokens` table via Drizzle | FLOWING |
| `StepComplete` | `inviteUrl` | `generateInviteToken()` → DB `insert` into `invite_tokens` | Yes — inserts to DB and returns real token | FLOWING |
| `dashboard/page.tsx` → `InviteSection` | `activeInvite.{token,expiresAt,status}` | `getActiveInviteToken()` in `Promise.all` | Yes — not hardcoded; from DB | FLOWING |
| `dashboard/page.tsx` → `parentBJoined` | `parent2TokenRow` | `db.select().from(userGoogleTokens)` for `parent2Email` | Yes — real DB query | FLOWING |

### Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| `generateInviteToken` exported | `content.includes('export async function generateInviteToken(')` | true | PASS |
| `getActiveInviteToken` exported | `content.includes('export async function getActiveInviteToken(')` | true | PASS |
| base64url token generation | `content.includes('base64url')` | true | PASS |
| 72h expiry calculation | `content.includes('72 * 60 * 60 * 1000')` | true | PASS |
| Prior-token cleanup | `content.includes('isNull(inviteTokens.usedAt)')` | true | PASS |
| TypeScript compilation | `npx tsc --noEmit` | Exit 0, no output | PASS |
| All 6 commit hashes from SUMMARYs | git log --oneline | f081686, 441b2f6, f0a907c, b41091b, fc139e0, 02cf600 all present | PASS |
| Old placeholder removed from StepComplete | grep for "Toisen vanhemman kutsuminen on tulossa" | 0 matches | PASS |
| unauthorized_email variant: no retry Button | JS parse of block between "unauthorized_email" and "Default variant" | `<Button>` not present in block | PASS |
| Exempt routes include /invite/* | `proxy.ts` contains `pathname.startsWith("/invite/")` | true | PASS |
| proxy.ts uses getUser() not getSession() | `proxy.ts` contains `supabase.auth.getUser()` | true | PASS |
| D-13 compliant: familyConfig read inside proxy() | DB query inside function body, not module scope | true (line 48) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| ONBR-05 | P01, P02 | First parent can generate a shareable invite link for the second parent | SATISFIED | `generateInviteToken` Server Action wired to `StepComplete` (wizard) and `InviteSection` (dashboard); URL displayed in read-only Input with copy button |
| ONBR-06 | P01, P03 | Second parent can accept the invite link, sign in with Google, and access the app automatically | SATISFIED | `/invite/[token]` validates token and triggers OAuth with cookie; `auth/callback` consumes cookie, updates `parent2_email`, redirects to `/dashboard` |
| ONBR-07 | P04 | App redirects unauthenticated or un-onboarded users to the setup flow | SATISFIED | `proxy.ts` three-tier gate: unauthenticated → `/`, no family_config → `/setup`, unrecognized email → `/auth/error?error=unauthorized_email` + signOut |

All three requirement IDs (ONBR-05, ONBR-06, ONBR-07) claimed in plan frontmatter are mapped in REQUIREMENTS.md to Phase 13 and are substantively implemented.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | No stubs, placeholders, or empty implementations in any phase file |

No placeholder alerts, TODO comments, empty return values, or disconnected data paths found across all 9 files verified.

### Human Verification Required

#### 1. Full Invite Acceptance Flow

**Test:** As Parent A, generate an invite link from the dashboard. Copy the URL. Open it in an incognito window (or as Parent B). Click "Kirjaudu Google-tilillä". Complete Google OAuth. Verify landing on /dashboard.
**Expected:** Parent B lands on /dashboard; check DB: `family_config.parent2_email` updated to Parent B's Google email; `invite_tokens.used_at` stamped with current timestamp; `invite_tokens.used_by` = Parent B email.
**Why human:** Requires a live OAuth roundtrip — the cookie-to-callback chain cannot be verified without a real browser session and Google OAuth handshake.

#### 2. Dashboard Invite Section Visibility Gate

**Test:** Log in as Parent A. Visit /dashboard. Confirm InviteSection is visible. Now complete the invite acceptance flow (Human Test 1) as Parent B. Return to /dashboard as Parent A.
**Expected:** InviteSection is no longer rendered after Parent B joins (a `user_google_tokens` row for `parent2_email` now exists).
**Why human:** Requires two separate active sessions and cannot be tested with grep/static analysis.

#### 3. Copy Button 2-Second Icon Toggle

**Test:** With an active invite URL showing in StepComplete or InviteSection, click the copy button.
**Expected:** Icon changes from Copy to Check (green, `text-green-600`) for exactly 2 seconds, then reverts to Copy. No toast notification appears.
**Why human:** Time-based UI state change requires browser interaction.

#### 4. Regenerate Button Updates InviteSection Without Page Reload

**Test:** On /dashboard with InviteSection visible, click "Luo uusi linkki".
**Expected:** Button shows Loader2 spinner while in-flight. New invite URL appears in the Input field after action completes. No page navigation occurs.
**Why human:** Requires live Server Action call and React state update observation in browser.

#### 5. Unrecognized Email Middleware Gate

**Test:** Sign in with a Google account whose email does not match `parent1_email` or `parent2_email` in `family_config`. Attempt to visit /dashboard.
**Expected:** Immediately redirected to `/auth/error?error=unauthorized_email`. Page shows "Pääsy estetty" heading with no retry button. Supabase session cleared (subsequent navigation requires re-login).
**Why human:** Requires a third Google account and live Supabase session invalidation verification.

---

## Gaps Summary

No gaps found. All 5 roadmap success criteria are verified against actual codebase implementations. All 9 required artifact files exist, are substantive (not stubs), are wired to real data sources, and connect to each other via the specified integration paths.

The `human_needed` status reflects 5 items requiring browser-based end-to-end verification (OAuth flow, real-time UI state, session invalidation) that cannot be confirmed through static code analysis.

---

_Verified: 2026-05-17T13:37:58Z_
_Verifier: Claude (gsd-verifier)_
