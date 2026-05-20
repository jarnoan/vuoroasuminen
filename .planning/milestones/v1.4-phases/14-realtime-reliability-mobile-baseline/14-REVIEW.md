---
phase: 14-realtime-reliability-mobile-baseline
reviewed: 2026-05-18T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/actions/schedule.ts
  - src/app/layout.tsx
  - src/app/globals.css
  - src/components/schedule/realtime-provider.tsx
  - src/components/schedule/schedule-with-realtime.tsx
  - src/components/schedule/dashboard-shell.tsx
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 14: Code Review Report

**Reviewed:** 2026-05-18T00:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

This phase introduces realtime reliability improvements (visibility-change recovery, re-subscribe on wake) and mobile baseline styling. The changes are generally well-structured. One critical bug exists in the realtime provider's payload handler: when a cell is cleared (`parentId` set to `null` in the DB), the handler silently drops the event instead of propagating the clear to the peer's UI, causing a stale display. Three warnings cover a race in the recovery flow, an insecure non-null assertion on env vars, and a `useEffect`/`setDays` in DashboardShell that creates a reference equality trap. Two info items call out a debug `console.log` left in a Server Action and a parameter shadow.

## Critical Issues

### CR-01: Cleared cells (null parentId) are silently dropped by the realtime handler

**File:** `src/components/schedule/realtime-provider.tsx:56`

**Issue:** When `clearCell` sets `parent_id = NULL` in the database, Supabase Realtime delivers a payload where `payload.new.parent_id` is `null`. The guard on line 56 rejects any value not in `VALID_PARENT_IDS` (`"father" | "mother"`), so `null` is rejected and `onEntryChangeRef.current` is never called. The other parent's browser never sees the clear; the cell stays showing the old parent until a full page reload. This directly breaks the core collaboration guarantee for the `clearCell` flow.

**Fix:**
```typescript
// realtime-provider.tsx — update RealtimePayload type and handlePayload

interface RealtimePayload {
  new: {
    id: string
    child_id: string
    day: string
    parent_id: string | null   // null when cleared
    status: string
    notes: string | null
  }
}

// Inside handlePayload:
const row = payload.new as RealtimePayload["new"]
if (!row || typeof row.id !== "string" || typeof row.child_id !== "string" || typeof row.day !== "string") return
// Allow null (cleared) and valid parent ids; reject anything else
if (row.parent_id !== null && !VALID_PARENT_IDS.includes(row.parent_id as ParentId)) return
if (!VALID_STATUSES.includes(row.status as "draft" | "published")) return
onEntryChangeRef.current({
  id: row.id,
  childId: row.child_id,
  day: row.day,
  parentId: row.parent_id as ParentId | null,   // null = cleared
  status: row.status as "draft" | "published",
  notes: row.notes,
})
```

Also update the `onEntryChange` prop type in `RealtimeProviderProps` to accept `parentId: ParentId | null` (line 28), which already matches `EntryUpdate` in `schedule-with-realtime.tsx` (line 13). The only required fix is in the payload type and the guard logic.

---

## Warnings

### WR-01: Race condition in visibility-change recovery — channel can leak if component unmounts mid-async

**File:** `src/components/schedule/realtime-provider.tsx:80-103`

**Issue:** `handleVisibilityChange` is `async`. The `cancelled` flag is checked before each `await`, but between `await supabase.removeChannel(channel)` (line 85) and `await getScheduleDays(viewStart)` (line 91), the effect cleanup could run synchronously (component unmount) setting `cancelled = true` and calling `supabase.removeChannel(channel)` — but at that point `channel` is already `null` (set on line 86), so the newly created channel assigned on line 99-102 never gets removed. The channel created in step 3 leaks if the component unmounts between the `getScheduleDays` await and the channel assignment.

**Fix:** Capture a local `localChannel` variable inside the async handler so the cleanup path can remove it even if the outer `channel` reference was already cleared:

```typescript
const handleVisibilityChange = async () => {
  if (document.hidden || cancelled) return

  if (channel) {
    await supabase.removeChannel(channel)
    channel = null
  }
  if (cancelled) return

  const freshDays = await getScheduleDays(viewStart)
  if (cancelled) return
  onRefreshRef.current?.(freshDays)

  const { data: { session } } = await supabase.auth.getSession()
  if (cancelled || !session?.access_token) return
  supabase.realtime.setAuth(session.access_token)

  // Check cancelled again right before creating the channel
  if (cancelled) return

  const newChannel = supabase
    .channel("schedule-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "schedule_entries" }, handlePayload)
    .subscribe()

  if (cancelled) {
    // Component unmounted while we were awaiting — clean up immediately
    supabase.removeChannel(newChannel)
    return
  }
  channel = newChannel
}
```

---

### WR-02: Non-null assertion on env vars crashes at runtime with no useful error

**File:** `src/components/schedule/realtime-provider.tsx:45-47`

**Issue:** `process.env.NEXT_PUBLIC_SUPABASE_URL!` and `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!` use TypeScript non-null assertions. In production, if either env var is missing (misconfigured deploy), the assertion is stripped at runtime and `createBrowserClient` receives `undefined`, causing a cryptic runtime error instead of an actionable message.

**Fix:**
```typescript
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!supabaseUrl || !supabaseKey) {
  console.error("[RealtimeProvider] Missing Supabase env vars — realtime disabled")
  return
}
const supabase = createBrowserClient(supabaseUrl, supabaseKey)
```

---

### WR-03: `useEffect` on `initialData` object reference causes unnecessary state resets

**File:** `src/components/schedule/dashboard-shell.tsx:35-37`

**Issue:** The effect at lines 35-37 runs `setDays(initialData.days)` whenever `initialData` changes. Because `initialData` is a prop passed from a Server Component, a `router.refresh()` call will create a new object reference even if the data is identical. This means every navigation/refresh triggers `setDays` with a full new array, discarding any in-flight optimistic updates that haven't yet been reconciled. In the specific scenario described in the comment ("after clearRange + router.refresh()"), this is intentional — but the effect currently fires on every `initialData` reference change, including benign re-renders, not just router refreshes.

**Fix:** Track a stable identity for the data to avoid spurious resets. One approach is to compare by a derived key (e.g., start/end date of the window) rather than the object reference:

```typescript
const initialDataRef = useRef(initialData)
useEffect(() => {
  // Only re-sync if the window itself changed (not just a referential re-render)
  if (
    initialData.startDate !== initialDataRef.current.startDate ||
    initialData.endDate !== initialDataRef.current.endDate
  ) {
    initialDataRef.current = initialData
    setDays(initialData.days)
  }
}, [initialData])
```

Alternatively, if the intent is to always accept server data after refresh, document this explicitly and ensure optimistic state is flushed before `router.refresh()` is called.

---

## Info

### IN-01: Debug console.log left in production Server Action

**File:** `src/actions/schedule.ts:100`

**Issue:** `console.log("[syncCalendars] syncResult:", JSON.stringify(syncResult, null, 2))` logs the full sync result on every calendar sync. For a production app this adds noise to server logs and serializes potentially large payloads on every publish.

**Fix:** Remove the log or replace with a structured logger gated on `process.env.NODE_ENV !== "production"`:
```typescript
if (process.env.NODE_ENV !== "production") {
  console.log("[syncCalendars] syncResult:", JSON.stringify(syncResult, null, 2))
}
```

---

### IN-02: Parameter `days` in `handleRefresh` shadows the outer `days` prop

**File:** `src/components/schedule/schedule-with-realtime.tsx:33`

**Issue:** `const handleRefresh = useCallback((days: ScheduleDay[]) => { setDays(days) }, [setDays])` — the parameter `days` shadows the outer `days` prop declared on line 19. This causes no runtime bug here because the shadow is intentional (the fresh data replaces the prop), but it is a common source of accidental bugs in callbacks and will trigger `no-shadow` lint rules.

**Fix:**
```typescript
const handleRefresh = useCallback((freshDays: ScheduleDay[]) => {
  setDays(freshDays)
}, [setDays])
```

---

_Reviewed: 2026-05-18T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
