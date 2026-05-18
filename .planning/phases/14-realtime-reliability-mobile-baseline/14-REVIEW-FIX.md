---
phase: 14-realtime-reliability-mobile-baseline
fixed_at: 2026-05-18T00:00:00Z
review_path: .planning/phases/14-realtime-reliability-mobile-baseline/14-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 14: Code Review Fix Report

**Fixed at:** 2026-05-18T00:00:00Z
**Source review:** .planning/phases/14-realtime-reliability-mobile-baseline/14-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4
- Fixed: 4
- Skipped: 0

## Fixed Issues

### CR-01: Cleared cells (null parentId) are silently dropped by the realtime handler

**Files modified:** `src/components/schedule/realtime-provider.tsx`
**Commit:** e29f95c
**Applied fix:** Updated `RealtimePayload.new.parent_id` type from `string` to `string | null`. Updated `RealtimeProviderProps.onEntryChange` callback's `parentId` parameter from `ParentId` to `ParentId | null`. Changed the guard in `handlePayload` from `!VALID_PARENT_IDS.includes(row.parent_id)` to `row.parent_id !== null && !VALID_PARENT_IDS.includes(row.parent_id)` so null (cleared cell) passes through. Updated the `parentId` cast in the `onEntryChangeRef.current` call to `ParentId | null`.

### WR-01: Race condition in visibility-change recovery — channel can leak if component unmounts mid-async

**Files modified:** `src/components/schedule/realtime-provider.tsx`
**Commit:** e29f95c
**Applied fix:** Replaced the direct `channel = supabase.channel(...)...subscribe()` assignment at the end of `handleVisibilityChange` with a local `newChannel` variable. Added a `cancelled` check immediately after the channel is created; if the component unmounted between the last `await` and this point, `supabase.removeChannel(newChannel)` is called immediately and the function returns without assigning to `channel`.

### WR-02: Non-null assertion on env vars crashes at runtime with no useful error

**Files modified:** `src/components/schedule/realtime-provider.tsx`
**Commit:** e29f95c
**Applied fix:** Replaced `process.env.NEXT_PUBLIC_SUPABASE_URL!` and `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!` with explicit variable extraction and a guard that logs `[RealtimeProvider] Missing Supabase env vars — realtime disabled` and returns early if either is falsy. `createBrowserClient` is called only with verified non-undefined values.

### WR-03: `useEffect` on `initialData` object reference causes unnecessary state resets

**Files modified:** `src/components/schedule/dashboard-shell.tsx`
**Commit:** 2587974
**Applied fix:** Added `initialDataRef = useRef(initialData)` to track the previous `initialData` value. Wrapped the `setDays(initialData.days)` call inside a comparison of `initialData.startDate`/`endDate` against the ref values. `setDays` is now only called when the date window boundaries actually change, preventing optimistic updates from being discarded on benign `router.refresh()` re-renders that produce a new object reference with identical data.

---

_Fixed: 2026-05-18T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
