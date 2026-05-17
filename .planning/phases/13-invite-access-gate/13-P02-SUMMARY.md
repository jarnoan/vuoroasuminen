---
phase: 13-invite-access-gate
plan: P02
subsystem: invite-ui
tags: [invite, dashboard, setup-wizard, copy-to-clipboard, parent-b-detection]
dependency_graph:
  requires: [P01]
  provides: [invite-url-display, dashboard-invite-section, parent-b-join-detection]
  affects: [src/app/setup/steps/step-complete.tsx, src/app/dashboard/page.tsx]
tech_stack:
  added: []
  patterns: [client-component-calls-server-action, server-component-conditional-render, host-header-origin-construction]
key_files:
  created:
    - src/actions/invite.ts
    - src/components/invite/invite-section.tsx
  modified:
    - src/app/setup/steps/step-complete.tsx
    - src/app/setup/setup-wizard.tsx
    - src/app/dashboard/page.tsx
decisions:
  - "invite.ts created in P02 worktree as Rule 3 deviation (P01 not yet merged into this worktree)"
  - "InviteSection is a Client Component receiving initial token state as props from the Server Component dashboard"
  - "Origin built from Host header on server to avoid client-side window.location dependency in dashboard"
metrics:
  duration: "~7 minutes"
  completed: "2026-05-16"
  tasks_completed: 2
  files_created: 3
  files_modified: 3
---

# Phase 13 Plan 02: Invite UI Surfaces Summary

## One-liner

StepComplete and Dashboard wired to invite Server Actions — real invite URL with copy button replaces placeholder alert; dashboard invite section shows link status and hides once Parent B has joined.

## What Was Built

### Task 1: StepComplete updated with invite URL + copy button

`src/app/setup/steps/step-complete.tsx` was rewritten from a placeholder alert into a fully functional invite entry point:

- Calls `generateInviteToken()` on mount via `useEffect`
- Displays the URL in a read-only `Input` with `font-mono` styling
- Copy button toggles to `Check` icon (green) for 2 seconds then reverts to `Copy` icon — no toast
- Loading state: `Loader2 animate-spin` while token generates
- Error state: `Alert variant="destructive"` inline if generation fails
- Label includes `parent2Name` ("Kutsu {name} liittymään")
- `SetupWizard` updated to pass `familyData.parent2Name` to `StepComplete`

### Task 2: Dashboard invite section + Parent B join detection

`src/components/invite/invite-section.tsx` (new Client Component):

- Receives `initialToken`, `initialExpiresAt`, `initialStatus`, and `origin` as props
- Status rendering: "Linkki voimassa N tuntia" (active), "Linkki vanhentunut — luo uusi" (expired, `text-destructive`), "Toinen vanhempi on liittynyt" (used)
- Copy button — same 2s Check icon pattern as StepComplete
- Regenerate button: `variant="outline" size="sm"` with `RefreshCw` icon; shows `Loader2` while in-flight; updates token/expiresAt/status on success; shows inline `Alert` on error
- Input and copy button disabled when link is not active

`src/app/dashboard/page.tsx` updated:

- Imports `InviteSection` and `getActiveInviteToken`
- Extends `Promise.all` to include: parent2 token row query + `getActiveInviteToken()` call
- `parentBJoined` flag derived from `user_google_tokens` row existence for `parent2Email`
- Origin built from `headers().get("host")` — avoids client-side construction
- Returns `<>` fragment with `InviteSection` (conditional) above `DashboardShell`

### Rule 3 Deviation: invite.ts created in P02 worktree

`src/actions/invite.ts` was also created in this worktree because the P01 worktree ran in parallel and its work had not yet merged. This satisfies P02's blocking dependency without waiting. When P01 merges, one version will be kept — both are identical in contract and implementation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created invite.ts in P02 worktree**
- **Found during:** Task 1 start
- **Issue:** `src/actions/invite.ts` did not exist in this worktree (P01 runs in parallel wave, not yet merged). P02 imports from it — TypeScript would fail without it.
- **Fix:** Created `src/actions/invite.ts` with `generateInviteToken` and `getActiveInviteToken` per the P01 plan spec. Implementation is identical to what P01 produces.
- **Files modified:** `src/actions/invite.ts` (new)
- **Commit:** f0a907c

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced by P02. All new surfaces are UI-only Client Components calling existing Server Actions. The `generateInviteToken` Server Action (defined in `invite.ts`) enforces auth via `supabase.auth.getUser()` — covered by T-13-P02-01 in the plan's threat model.

## Known Stubs

None. All data paths are wired: `generateInviteToken` calls DB, `getActiveInviteToken` reads DB, parent2 join detection queries `user_google_tokens`.

## Acceptance Criteria Verification

- [x] `src/app/setup/steps/step-complete.tsx` starts with `"use client"`
- [x] Imports `generateInviteToken` from `@/actions/invite`
- [x] `parent2Name` prop in interface
- [x] `navigator.clipboard.writeText(inviteUrl)` present
- [x] `setTimeout(() => setCopied(false), 2000)` present
- [x] `Check` and `Copy` icon imports from `lucide-react`
- [x] `Kutsu ${parent2Name} liittymään` label text
- [x] `Siirry aikatauluun` link present
- [x] Old placeholder Alert ("Toisen vanhemman kutsuminen on tulossa") removed
- [x] `setup-wizard.tsx` passes `parent2Name={familyData.parent2Name}` to `StepComplete`
- [x] `src/components/invite/invite-section.tsx` exists and starts with `"use client"`
- [x] Exports `InviteSection`
- [x] Imports `generateInviteToken` from `@/actions/invite`
- [x] Contains "Kutsu toinen vanhempi" heading
- [x] Contains "Luo uusi linkki" button text
- [x] Contains "Linkki voimassa" in status rendering
- [x] Contains "Linkki vanhentunut" in status rendering
- [x] Contains "Toinen vanhempi on liittynyt" in status rendering
- [x] `dashboard/page.tsx` imports `InviteSection`
- [x] `dashboard/page.tsx` imports `getActiveInviteToken`
- [x] `dashboard/page.tsx` queries `userGoogleTokens` for `parent2Email`
- [x] `dashboard/page.tsx` contains `parentBJoined`
- [x] `dashboard/page.tsx` conditionally renders `InviteSection` when `!parentBJoined`
- [x] `npx tsc --noEmit` exits 0

## Self-Check: PASSED
