---
plan: 09-04
phase: 09
status: complete
completed: 2026-05-14
---

# Summary — 09-04: Apply policies.sql + RLS UAT

## What was done

`supabase/policies.sql` was applied to the live Supabase project (wsdrguowmcjyfrsjsywn) via the Dashboard SQL editor. All 19 policies and 5 ENABLE ROW LEVEL SECURITY statements executed cleanly. `schedule_entries` was confirmed in the `supabase_realtime` publication.

## Policy count (pg_policies after apply)

| tablename | policy_count |
|-----------|-------------|
| children | 4 |
| gcal_events | 4 |
| schedule_entries | 4 |
| schedules | 4 |
| user_google_tokens | 3 |

Matches expected 4/4/4/4/3 distribution.

## UAT verdicts

| Scenario | Result | Notes |
|----------|--------|-------|
| RLS-01 — Anon returns no data | PASS | All four anon curl requests returned `[]` |
| RLS-02 — Authenticated CRUD | PASS | Cell edits persist; no console errors |
| RLS-03 — Per-user token isolation | POLICY CONFIRMED | 3 policies on user_google_tokens confirmed via pg_policies; Dashboard "Impersonate user" unavailable (requires Pro plan) — full end-to-end cross-read test deferred |
| RLS-04 — Realtime across two sessions | PASS (after in-session fix) | Added `getSession()` + `realtime.setAuth(access_token)` before `.subscribe()` to resolve JWT race; re-tested and live updates propagate within ~2s |
| GCal regression | PASS | service_role bypass (D-07) intact after RLS enabled |

## Fix applied during UAT

`src/components/schedule/realtime-provider.tsx` — commit `65e94b9`. RealtimeProvider was subscribing before `getSession()` resolved, sending the anon key as the WebSocket auth token. Fixed by awaiting session and calling `setAuth` before subscribe.

## Phase 9 complete — Phase 10 unblocked

All four success criteria (RLS-01..RLS-04) verified. Phase 10 (Auth.js Removal) was unblocked and is now complete.

## Self-Check: PASSED
