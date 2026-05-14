---
phase: 09
plan: 02
subsystem: auth/callback
tags:
  - supabase
  - oauth
  - rls
  - tokens
dependency_graph:
  requires:
    - 09-01 (supabase/policies.sql with user_google_tokens RLS policy)
  provides:
    - OAuth callback token write path that is subject to per-user RLS enforcement
  affects:
    - src/app/auth/callback/route.ts
tech_stack:
  added: []
  patterns:
    - supabase.from().upsert() with snake_case column names for PostgREST writes
key_files:
  modified:
    - src/app/auth/callback/route.ts
decisions:
  - key: Remove admin Drizzle from OAuth callback token write
    rationale: D-06 — service_role bypasses RLS making the per-user policy cosmetic; switching to the authenticated Supabase client makes RLS actually enforce
  - key: Use snake_case column names in Supabase upsert
    rationale: PostgREST writes to raw DB column names, not Drizzle camelCase aliases; wrong names silently write NULL
  - key: Use new Date().toISOString() for updated_at
    rationale: PostgREST timestamp columns expect ISO-8601 strings, not Date objects
metrics:
  duration: "2m"
  completed_date: "2026-05-14"
  tasks_completed: 1
  tasks_total: 1
---

# Phase 09 Plan 02: OAuth Callback Token Upsert via Authenticated Supabase Client Summary

**One-liner:** Switched `user_google_tokens` upsert in the OAuth callback from admin Drizzle (service_role, bypasses RLS) to the already-authenticated Supabase server client, making the per-user RLS policy (`auth.email() = email`) actively enforce on token writes.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Replace Drizzle token upsert with supabase.from().upsert() | ccca3ff | src/app/auth/callback/route.ts |

## Before / After Diff

**Before** (admin Drizzle, bypasses RLS):
```typescript
import { db } from "@/db"
import { userGoogleTokens } from "@/db/schema/tokens"

// ... in handler:
try {
  await db
    .insert(userGoogleTokens)
    .values({
      email: userEmail,
      refreshToken: providerRefreshToken,  // camelCase Drizzle alias
      updatedAt: new Date(),               // Date object
    })
    .onConflictDoUpdate({
      target: userGoogleTokens.email,
      set: {
        refreshToken: providerRefreshToken,
        updatedAt: new Date(),
      },
    })
  console.log("[auth/callback] token row upserted for", userEmail)
} catch (err) {
  console.error("[auth/callback] db insert failed:", err)
  return NextResponse.redirect(new URL("/auth/error", request.url))
}
```

**After** (authenticated Supabase client, subject to RLS):
```typescript
// (db and userGoogleTokens imports removed)

// ... in handler:
const { error: upsertError } = await supabase
  .from('user_google_tokens')
  .upsert(
    {
      email: userEmail,
      refresh_token: providerRefreshToken,   // snake_case — raw DB column name
      updated_at: new Date().toISOString(),  // snake_case — raw DB column name
    },
    { onConflict: 'email' },
  )

if (upsertError) {
  console.error("[auth/callback] token upsert failed:", upsertError)
  return NextResponse.redirect(new URL("/auth/error", request.url))
}
console.log("[auth/callback] token row upserted for", userEmail)
```

## Import Cleanup

Removed from `src/app/auth/callback/route.ts`:
- `import { db } from "@/db"` — admin Drizzle no longer used in this route
- `import { userGoogleTokens } from "@/db/schema/tokens"` — Drizzle schema reference no longer needed

## What Was Not Changed

- **GCal sync (`src/lib/gcal/sync.ts`):** Still reads `user_google_tokens` via admin Drizzle (service_role) — D-07 unchanged. Sync runs server-side behind `requireAuthorizedParent()`; bypassing RLS is intentional for GCal reads.
- **All other callback logic:** `exchangeCodeForSession`, the Pitfall-3 response construction order, the SAUTH-06 `provider_refresh_token` capture, null-check redirect, and final `return response` — all preserved.

## Acceptance Criteria Verification

All 13 criteria passed:

| Check | Result |
|-------|--------|
| `from('user_google_tokens')` present | PASS |
| `refresh_token: providerRefreshToken` present | PASS |
| `updated_at: new Date().toISOString()` present | PASS |
| `onConflict: 'email'` present | PASS |
| `from "@/db"` removed | PASS |
| `userGoogleTokens` removed | PASS |
| No camelCase `refreshToken:` | PASS |
| No camelCase `updatedAt:` | PASS |
| `db.insert(` removed | PASS |
| `exchangeCodeForSession(code)` preserved | PASS |
| `provider_refresh_token` preserved | PASS |
| `[auth/callback] token row upserted for` preserved | PASS |
| `/auth/error` redirect preserved | PASS |

## Build / Lint Results

- `npm run lint src/app/auth/callback/route.ts`: 0 errors, 0 warnings
- `npm run build`: Failed due to pre-existing `@/config/app` module-not-found errors across unrelated files (`src/actions/schedule.ts`, `src/app/dashboard/page.tsx`, `src/components/schedule/*.tsx`, `src/lib/gcal/sync.ts`, `src/lib/schedule/*.ts`). These failures are caused by `src/config/app.ts` not being present in the worktree — this file is generated by `scripts/generate-app-config.js` from environment variables that are not set in the worktree environment, and the file is not tracked in git. The build was already broken at the base commit for the same reason; this plan's change does not cause or worsen the failure.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. This plan narrows the attack surface by removing the service_role bypass on the `user_google_tokens` write path, making T-09-05 mitigation effective.

## Self-Check: PASSED

- `src/app/auth/callback/route.ts` exists and contains expected changes
- Commit `ccca3ff` exists in git log
