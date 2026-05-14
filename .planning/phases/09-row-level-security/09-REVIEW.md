---
phase: 09-row-level-security
reviewed: 2026-05-14T19:52:11Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/app/auth/callback/route.ts
  - src/components/schedule/realtime-provider.tsx
  - src/components/sign-in-button.tsx
  - src/lib/supabase/client.ts
  - supabase/policies.sql
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 09: Code Review Report

**Reviewed:** 2026-05-14T19:52:11Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Five files implementing Row Level Security, the auth callback, realtime subscription, sign-in UI, and the Supabase browser client were reviewed. The RLS design is sound for a two-parent app: domain tables are open to any authenticated user, and `user_google_tokens` is correctly isolated per user via the JWT email claim. The auth callback correctly upserts the Google refresh token and guards against missing tokens before touching the DB.

Three quality issues stand out as bugs or near-bugs: the realtime channel is subscribed unconditionally even when `getSession` returns no session (the `if (session?.access_token)` block only guards `setAuth`, not the channel creation), the `notes` field from a realtime payload is passed through without any string-type check, and all four domain tables grant `DELETE` to any authenticated user which, combined with the two-user model, means either parent can permanently delete any child, schedule, or entry created by the other.

Two additional warnings concern the non-idempotent structure of the SQL file and an unsafe `!` assertion on environment variables in the browser client code.

---

## Critical Issues

### CR-01: Realtime channel subscribed even when user has no session

**File:** `src/components/schedule/realtime-provider.tsx:46-75`

**Issue:** The `if (session?.access_token)` guard at line 48 only covers the `supabase.realtime.setAuth(...)` call. The `channel = supabase.channel(...).on(...).subscribe()` block at lines 51-75 is inside the same `.then()` callback and runs whether or not `session` is truthy. This means an unauthenticated browser (e.g. session expired, cookie cleared) still opens a Realtime WebSocket channel subscribed to `schedule_entries`. Under the current RLS policies, an unauthenticated channel uses the `anon` role, which has no policies on `schedule_entries` — so no data leaks today — but the open channel is spurious and will emit confusing errors when auth is eventually required on the publication. More critically, if Supabase Realtime is ever reconfigured to require a JWT for the publication (the documented secure mode), unauthenticated clients would silently receive no events while the UI shows stale data with no error.

**Fix:**
```ts
supabase.auth.getSession().then(({ data: { session } }) => {
  if (cancelled) return
  // Guard the entire channel setup on having a valid session.
  if (!session?.access_token) return   // <-- add this early-return

  supabase.realtime.setAuth(session.access_token)
  channel = supabase
    .channel("schedule-changes")
    // ... rest unchanged
    .subscribe()
})
```

---

## Warnings

### WR-01: `notes` field passed through without type guard

**File:** `src/components/schedule/realtime-provider.tsx:62-72`

**Issue:** Lines 62-64 validate `id`, `child_id`, `day`, `parent_id`, and `status` from the raw realtime payload before use. `notes` at line 71 is passed directly as `row.notes` without checking `typeof row.notes === "string" || row.notes === null`. The `RealtimePayload` interface (line 17) declares `notes: string | null`, but `row` is cast from `Record<string, unknown>` at line 61 — the declared type is not enforced at runtime. A malformed payload with `notes: 42` would silently pass a number downstream into a prop typed as `string | null`.

**Fix:**
```ts
// After the existing guards at line 64, add:
const notesValue = row.notes === null || typeof row.notes === "string" ? row.notes : null

onEntryChangeRef.current({
  id: row.id,
  childId: row.child_id,
  day: row.day,
  parentId: row.parent_id as ParentId,
  status: row.status as "draft" | "published",
  notes: notesValue,   // use the guarded value
})
```

### WR-02: Domain tables grant DELETE to any authenticated user

**File:** `supabase/policies.sql:52-54, 72-74, 92-94, 112-114`

**Issue:** All four domain tables (`children`, `schedules`, `schedule_entries`, `gcal_events`) have permissive DELETE policies for any authenticated user. In a two-parent household this means Parent A can delete rows created by Parent B — including permanently deleting a child record or an entire published schedule. There is no ownership column on these tables, so per-row isolation is not possible without a schema change, but the DELETE grant is broader than the app currently needs. If the application never issues client-side DELETE requests (deletions happen via Server Actions using the service role), the authenticated DELETE policy provides no benefit and only expands the attack surface for a compromised browser session or CSRF.

**Fix:** If client-side deletes are not used, remove the four DELETE policies:
```sql
-- Remove these four policies:
DROP POLICY "authenticated can delete children"      ON public.children;
DROP POLICY "authenticated can delete schedules"     ON public.schedules;
DROP POLICY "authenticated can delete schedule_entries" ON public.schedule_entries;
DROP POLICY "authenticated can delete gcal_events"   ON public.gcal_events;
```
If soft-delete via Server Action (service role) is the intended pattern (consistent with D-07/D-10), the policies are unnecessary. If client-side hard-deletes are genuinely needed in future, re-add them with an explicit ownership check.

### WR-03: `policies.sql` is not idempotent — `CREATE POLICY` will error on re-run

**File:** `supabase/policies.sql:27-29`

**Issue:** The file header acknowledges the non-idempotency problem ("CREATE POLICY errors if the policy name already exists") but does not resolve it. The workaround described — drop policies in the Dashboard — is error-prone and undocumented in the file itself. A second run of this script (e.g. during a DB restore, staging setup, or CI seed) will fail on the first `CREATE POLICY` statement, requiring manual intervention. The `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and `ALTER PUBLICATION` lines are safe, but not the policy creation.

**Fix:** Prefix each policy creation with a drop guard:
```sql
-- Example for one policy; apply to all 19:
DROP POLICY IF EXISTS "authenticated can select children" ON public.children;
CREATE POLICY "authenticated can select children"
  ON public.children FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');
```
Alternatively, use `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$` blocks, but `DROP POLICY IF EXISTS` is simpler and more readable.

---

## Info

### IN-01: `console.log` debug lines in production auth callback

**File:** `src/app/auth/callback/route.ts:49, 52, 71`

**Issue:** Three `console.log` / `console.error` calls log the user's email address and token presence to stdout. In a production Vercel deployment, these appear in function logs visible to anyone with project access. The email address is PII. The `console.error` on line 68 is acceptable for error observability, but the `console.log` lines on 49 and 71 should not log PII unconditionally.

**Fix:** Remove or gate behind a `DEBUG` flag:
```ts
// Remove line 49 or replace with:
if (process.env.NODE_ENV !== "production") {
  console.log("[auth/callback] provider_refresh_token present:", !!providerRefreshToken)
  // Note: do not log email even in dev — omit it
}
```

### IN-02: Env var assertions (`!`) in client components instantiate silently in prod on misconfiguration

**File:** `src/components/schedule/realtime-provider.tsx:39-40`, `src/components/sign-in-button.tsx:9-10`

**Issue:** Both browser client instantiation sites use `process.env.NEXT_PUBLIC_SUPABASE_URL!` and `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!` with the non-null assertion operator. If these vars are absent (misconfigured deployment, missing `.env.local`), the `!` suppresses the TypeScript undefined error and the Supabase client is constructed with `undefined` values, producing a confusing runtime error deep inside the SDK rather than a clear startup failure.

**Fix:** Add a guard at the module or function entry point:
```ts
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!url || !key) throw new Error("Missing Supabase env vars")
const supabase = createBrowserClient(url, key)
```
This is consistent with the documented approach in `src/lib/supabase/middleware.ts` which uses the same `!` pattern — the same fix applies there.

---

_Reviewed: 2026-05-14T19:52:11Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
