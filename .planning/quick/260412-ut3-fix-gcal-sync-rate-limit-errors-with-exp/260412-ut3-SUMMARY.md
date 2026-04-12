---
phase: quick-260412-ut3
plan: 01
subsystem: gcal-sync
tags: [rate-limiting, retry, throttle, google-calendar]
dependency_graph:
  requires: [src/lib/gcal/sync.ts]
  provides: [withRetry helper, insert throttle]
  affects: [syncCalendarsAfterPublish, syncParentCalendar]
tech_stack:
  added: []
  patterns: [exponential-backoff-with-jitter, QPS-throttle]
key_files:
  created: []
  modified:
    - src/lib/gcal/sync.ts
decisions:
  - withRetry detects rate-limit errors via err.code, err.status, and err.errors[0].domain to cover all googleapis error shapes
  - 404/410 catch block kept inside withRetry callback so only rate-limit errors are retried, not missing-event errors
  - 110ms inter-insert delay chosen to stay below 10 QPS even when both parents run concurrently (2 × ~9 QPS = ~18 ops/s total across users)
metrics:
  duration: ~5 minutes
  completed: "2026-04-12"
  tasks: 1
  files: 1
---

# Quick Task 260412-ut3: Fix GCal Sync Rate Limit Errors with Exponential Backoff

## One-liner

Added `withRetry` helper with exponential backoff + jitter for 429/503 errors, and 110ms inter-insert throttle to keep GCal sync below 10 QPS per user.

## What Was Done

### Task 1: Add withRetry helper and throttle insert loop in sync.ts

Added a `withRetry<T>` generic async helper at the top of `src/lib/gcal/sync.ts` (before the exported interfaces) that:

- Retries up to 5 times on rate-limit errors
- Detects rate limits via `err.code === 429`, `err.status === 429/503`, or `err.errors[0].domain === 'usageLimits'`
- Uses exponential backoff: `2^attempt * 1000ms + random jitter up to 1000ms`
- Logs retry attempts with the `[GCal sync]` prefix (consistent with existing observability pattern)

Both API calls are now protected:

- `calendar.events.delete` wrapped in `withRetry(async () => { try { ... } catch (404/410) { } })` — the not-found catch block lives inside the callback so it absorbs 404/410 without triggering a retry, while rate-limit errors bubble out to `withRetry`
- `calendar.events.insert` wrapped in `withRetry(() => calendar.events.insert(...))`

A 110ms `setTimeout` delay is added after each successful insert to throttle throughput to approximately 9 QPS per parent — safely below Google's 10 QPS per-user quota even when both parents sync concurrently.

## Commits

| Hash | Message |
|------|---------|
| b050fdf | feat(quick-260412-ut3): add withRetry helper and 110ms insert throttle to GCal sync |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- [x] `src/lib/gcal/sync.ts` modified and committed at b050fdf
- [x] `withRetry` function present above `ParentSyncResult` interface (line 17)
- [x] `calendar.events.delete` wrapped in `withRetry(async () => { try { ... } catch ... })` (line 178)
- [x] `calendar.events.insert` wrapped in `withRetry(() => calendar.events.insert(...))` (line 221)
- [x] 110ms delay after `created++` (line 244)
- [x] `npx tsc --noEmit` exits 0
