# Phase 9: Row Level Security - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-13
**Phase:** 09-row-level-security
**Areas discussed:** RLS SQL delivery, Realtime client auth, user_google_tokens policy

---

## RLS SQL delivery

| Option | Description | Selected |
|--------|-------------|----------|
| Checked-in SQL script | supabase/policies.sql, run manually via Dashboard SQL editor or psql | ✓ |
| Supabase CLI migrations | supabase migration new + supabase db push; introduces Supabase CLI | |
| Dashboard only | Write directly in Supabase Dashboard SQL editor; not tracked in git | |

**User's choice:** Checked-in SQL script at `supabase/policies.sql`

**Follow-up — file location:**

| Option | Description | Selected |
|--------|-------------|----------|
| supabase/policies.sql | Conventional Supabase project directory | ✓ |
| drizzle/rls-policies.sql | Co-locate with Drizzle output | |
| src/db/rls-policies.sql | Inside src/ near schema definitions | |

**User's choice:** `supabase/policies.sql`

---

## Realtime client auth

| Option | Description | Selected |
|--------|-------------|----------|
| Consolidate client.ts | Re-export createBrowserClient from @supabase/ssr; remove manual singleton guard | ✓ |
| Fix RealtimeProvider only | Update only RealtimeProvider; leaves sign-in-button with old singleton | |
| Pass token as prop | Pass session access_token from Server Component; call setAuth manually | |

**User's choice:** Consolidate `client.ts` to re-export from `@supabase/ssr`

**Follow-up — singleton guard:**

| Option | Description | Selected |
|--------|-------------|----------|
| Let @supabase/ssr handle it | Remove manual guard; library handles caching internally | ✓ |
| Keep the guard | Wrap @supabase/ssr in the same null check | |

**User's choice:** Let `@supabase/ssr` handle its own caching

---

## user_google_tokens policy

| Option | Description | Selected |
|--------|-------------|----------|
| Service_role for all writes + reads | Callback and GCal sync both use admin Drizzle; policy is defense-in-depth only | |
| Switch callback to user-scoped write | Use supabase.from('user_google_tokens').upsert() in callback; policy actively enforced | ✓ |

**User's choice:** Switch callback to user-scoped write via authenticated Supabase server client

**Follow-up — GCal read path:**

| Option | Description | Selected |
|--------|-------------|----------|
| Keep admin Drizzle for GCal reads | service_role bypasses RLS; sync runs behind requireAuthorizedParent() | ✓ |
| Switch to user-scoped Supabase client | Adds policy enforcement; requires threading user session into sync path | |

**User's choice:** Keep admin Drizzle for GCal reads

---

## Deferred Ideas

- Per-household RLS isolation — future milestone
- Gender-neutral terminology (father/mother → parent1/parent2) — carried from Phase 8
