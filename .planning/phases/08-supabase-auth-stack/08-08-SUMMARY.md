---
phase: 08-supabase-auth-stack
plan: 08
subsystem: auth
tags: [gate, human-verify, supabase, oauth, gcal]

requires:
  - phase: 08-supabase-auth-stack
    provides: Full Supabase auth stack (plans 01–07)

provides:
  - Phase 8 → Phase 9 gate formally passed by human verification
  - Confirmation all 9 requirements (SAUTH-01..07, GCAL-01, GCAL-02) satisfied in browser

affects: [phase-09-rls]

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified: []

key-decisions:
  - "GATE PASSED 2026-05-10 — Phase 9 (Row Level Security) is unblocked"

patterns-established: []
---

## Gate Results

| Test | Requirement | Result |
|------|-------------|--------|
| TEST 1 — PKCE Google sign-in → /dashboard | SAUTH-01 | PASS |
| TEST 2 — Session persists across refresh | SAUTH-02 | PASS |
| TEST 3 — user_google_tokens row written with refresh_token | SAUTH-06 | PASS |
| TEST 4 — Publish syncs GCal via ownerEmail token | GCAL-01, GCAL-02 | PASS |
| TEST 5 — Dashboard banner when owner token missing | SAUTH-07 | PASS |

## Issues Found During Verification

Three bugs discovered and fixed during this gate:

1. **Silent callback error** — `db.insert()` in `/auth/callback` had no try/catch; added explicit error catch + logging.
2. **Infinite re-render** — `ScheduleTable` useEffect had `onDaysChange` in deps, causing update loop. Fixed with ref pattern (`useLayoutEffect` + `useRef`).
3. **Multiple GoTrueClient** — `SignInButton` created a new Supabase client per click. Fixed to use singleton from `@/lib/supabase/client`.

## Self-Check: PASSED

Phase 9 (Row Level Security) may now proceed.
