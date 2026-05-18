# Phase 14: Realtime Reliability + Mobile Baseline - Pattern Map

**Mapped:** 2026-05-17
**Files analyzed:** 5
**Analogs found:** 5 / 5

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/schedule/realtime-provider.tsx` | provider | event-driven | self (existing file, adding to it) | exact — modify in place |
| `src/components/schedule/schedule-with-realtime.tsx` | component | event-driven | self (existing file, adding to it) | exact — modify in place |
| `src/app/layout.tsx` | config | request-response | self (existing file, adding to it) | exact — modify in place |
| `src/app/globals.css` | config | — | self (existing file, adding to it) | exact — modify in place |
| `src/actions/schedule.ts` | service | request-response | `src/actions/schedule.ts` `toggleCell` / `publishSchedule` patterns | exact — peer addition |

## Pattern Assignments

### `src/components/schedule/realtime-provider.tsx` (provider, event-driven)

**Analog:** self — the existing file is modified, not replaced.

**Existing imports pattern** (lines 1–5):
```typescript
"use client"

import { useEffect, useRef } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import type { ParentId } from "@/lib/schedule/types"
```

**What to add to imports:**
- Import `getScheduleDays` Server Action: `import { getScheduleDays } from "@/actions/schedule"`
- Import `ScheduleDay` type: add to the existing `import type { ParentId } from "@/lib/schedule/types"` → `import type { ParentId, ScheduleDay } from "@/lib/schedule/types"`

**Existing props interface** (lines 21–31) — extend it:
```typescript
interface RealtimeProviderProps {
  children: React.ReactNode
  onEntryChange: (entry: {
    id: string
    childId: string
    day: string
    parentId: ParentId
    status: "draft" | "published"
    notes: string | null
  }) => void
  // ADD: new prop for full-schedule refresh
  onRefresh?: (days: ScheduleDay[]) => void
  viewStart?: string   // pass-through to getScheduleDays so re-fetch covers the correct window
}
```

**Existing useEffect structure** (lines 37–81) — the recovery listener slots in after the initial subscribe block, before the `return` cleanup:

```typescript
// EXISTING: initial channel setup (lines 37–75, keep as-is)
useEffect(() => {
  const supabase = createBrowserClient(...)
  let channel: ReturnType<typeof supabase.channel> | null = null
  let cancelled = false

  // existing: supabase.auth.getSession().then(...).subscribe()
  // ... unchanged ...

  // ADD: visibility recovery handler
  const onRefreshRef = useRef(onRefresh)   // add alongside onEntryChangeRef
  onRefreshRef.current = onRefresh         // keep in sync (same pattern as onEntryChangeRef)

  const handleVisibilityChange = async () => {
    if (document.hidden || cancelled) return

    // Step 1: remove dead/paused channel
    if (channel) {
      await supabase.removeChannel(channel)
      channel = null
    }

    // Step 2: re-fetch full schedule via Server Action
    const freshDays = await getScheduleDays(viewStart)
    if (cancelled) return
    onRefreshRef.current?.(freshDays)

    // Step 3: get fresh session token and re-subscribe
    const { data: { session } } = await supabase.auth.getSession()
    if (cancelled || !session?.access_token) return
    supabase.realtime.setAuth(session.access_token)
    channel = supabase
      .channel("schedule-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "schedule_entries" },
        handler   // same payload handler as the initial subscribe
      )
      .subscribe()
  }

  document.addEventListener("visibilitychange", handleVisibilityChange)

  // MODIFY existing cleanup return to also remove visibility listener:
  return () => {
    cancelled = true
    document.removeEventListener("visibilitychange", handleVisibilityChange)  // ADD
    if (channel) supabase.removeChannel(channel)
  }
}, [])  // deps array stays empty — refs handle prop updates
```

**Key implementation note — `onRefreshRef` placement:** `onRefreshRef` and its sync line must be declared outside `useEffect` (alongside `onEntryChangeRef` at lines 34–35), not inside the effect. Only the usage (`onRefreshRef.current?.(freshDays)`) is inside the effect. This matches the existing `onEntryChangeRef` pattern exactly.

**Key implementation note — handler extraction:** The inline `payload` handler on lines 59–72 must be extracted to a named `handler` constant before the `channel = supabase.channel(...).on(handler).subscribe()` call so it can be referenced both in the initial subscribe and in the recovery re-subscribe.

---

### `src/components/schedule/schedule-with-realtime.tsx` (component, event-driven)

**Analog:** self — existing file, prop addition only.

**Existing props interface** (lines 18–23):
```typescript
interface ScheduleWithRealtimeProps {
  days: ScheduleDay[]
  setDays: React.Dispatch<React.SetStateAction<ScheduleDay[]>>
  publishRef?: React.RefObject<(() => void) | null>
  parents: Array<{ id: ParentId; name: string }>
}
```

**What to add:** no new props needed on `ScheduleWithRealtimeProps` — `setDays` is already in scope. Add a `handleRefresh` callback inside the component body:

```typescript
// ADD inside ScheduleWithRealtime component body (after existing realtimeRef + handleEntryChange):
const handleRefresh = useCallback((days: ScheduleDay[]) => {
  setDays(days)
}, [setDays])
```

**Existing JSX** (lines 33–43) — add `onRefresh` prop to `RealtimeProvider`:
```typescript
// EXISTING (lines 33–43), modify the RealtimeProvider call:
<RealtimeProvider onEntryChange={handleEntryChange} onRefresh={handleRefresh}>
```

**Also need `viewStart` threading:** If the planner decides to thread `viewStart` through (Open Question 1 in RESEARCH.md), add `viewStart?: string` to `ScheduleWithRealtimeProps` and pass it to `RealtimeProvider`. The open question is left to the planner/implementer to resolve against `DashboardShell`'s state.

---

### `src/actions/schedule.ts` (service, request-response)

**Analog:** existing peers — `toggleCell` (lines 29–43) for auth guard + simple return, `publishSchedule` (lines 58–80) for typed return pattern.

**Auth guard pattern** (lines 16–27) — reuse without modification:
```typescript
async function requireAuthorizedParent() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const email = user?.email
  if (!email) throw new Error("Not authenticated")
  const config = await getAppConfig()
  const isAuthorized = config.parents.some((p) => p.email === email)
  if (!isAuthorized) throw new Error("Forbidden")
  return { user, email }
}
```

**New action to add** (append after line 235, peer to existing exports):
```typescript
// ADD: import at top of file alongside existing imports
import { getScheduleWindow } from "@/lib/schedule/queries"
import type { ScheduleDay } from "@/lib/schedule/types"

// ADD: new exported action
export async function getScheduleDays(viewStart?: string): Promise<ScheduleDay[]> {
  await requireAuthorizedParent()
  const window = await getScheduleWindow(viewStart)
  return window.days
}
```

**Pattern consistency notes:**
- File already has `"use server"` at line 1 — the new action inherits it automatically.
- `requireAuthorizedParent()` is already defined in the file — call it first, same as every other export.
- `getScheduleWindow` is in `src/lib/schedule/queries.ts` (line 10) and accepts `startDate?: string` — the new action's `viewStart` param maps directly to that parameter.
- Return type `ScheduleDay[]` comes from `window.days` (type: `DateWindow.days`, see queries.ts line 92 — `return { startDate, endDate, days }`).
- **Import conflict:** `window` is a browser global — name the `getScheduleWindow` return value something other than `window`, e.g., `const result = await getScheduleWindow(viewStart); return result.days`.

---

### `src/app/layout.tsx` (config, request-response)

**Analog:** self — existing file at lines 1–37.

**Existing import line** (line 1):
```typescript
import type { Metadata } from "next";
```

**What to change:** extend the import to include `Viewport`:
```typescript
import type { Metadata, Viewport } from "next";
```

**Existing metadata export** (lines 16–19) — unchanged:
```typescript
export const metadata: Metadata = {
  title: "Vuoroasuminen",
  description: "Yhteinen vuoroasumisaikataulu vanhemmille",
};
```

**New export to add** (insert immediately after the `metadata` block, before `RootLayout`):
```typescript
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};
```

**Pattern consistency:** The file uses semicolons after export blocks (line 19 ends with `};`). Match that style. The file is a Server Component (no `"use client"`) — `viewport` is only processed in Server Components, confirmed correct target.

---

### `src/app/globals.css` (config, —)

**Analog:** self — existing file.

**Existing `@layer base` block** (lines 120–130):
```css
@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
  html {
    @apply font-sans;
  }
}
```

**What to change:** add `overflow-x: hidden` to the existing `html` rule block at lines 127–129:
```css
  html {
    @apply font-sans;
    overflow-x: hidden;
  }
```

**Do NOT** add a separate `html { overflow-x: hidden; }` rule outside the `@layer base` block — that would create specificity inconsistency with the existing `@apply font-sans` rule on the same element.

---

## Shared Patterns

### Auth guard (all server actions)
**Source:** `src/actions/schedule.ts` lines 16–27
**Apply to:** `getScheduleDays` (the new Server Action)
```typescript
async function requireAuthorizedParent() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const email = user?.email
  if (!email) throw new Error("Not authenticated")
  const config = await getAppConfig()
  const isAuthorized = config.parents.some((p) => p.email === email)
  if (!isAuthorized) throw new Error("Forbidden")
  return { user, email }
}
```

### Stable ref pattern for callbacks (client components)
**Source:** `src/components/schedule/realtime-provider.tsx` lines 34–35
**Apply to:** `onRefresh` callback in `RealtimeProvider` (same pattern as `onEntryChangeRef`)
```typescript
const onEntryChangeRef = useRef(onEntryChange)
onEntryChangeRef.current = onEntryChange
```

### `cancelled` guard in async effects (client components)
**Source:** `src/components/schedule/realtime-provider.tsx` lines 44, 47, 77
**Apply to:** every async step in the `handleVisibilityChange` recovery sequence
```typescript
let cancelled = false
// ...
if (cancelled) return
// ...
return () => { cancelled = true; ... }
```

### Supabase channel setup (realtime subscribe)
**Source:** `src/components/schedule/realtime-provider.tsx` lines 46–75
**Apply to:** re-subscribe step inside `handleVisibilityChange` (same shape, new channel instance)
```typescript
supabase.auth.getSession().then(({ data: { session } }) => {
  if (cancelled) return
  if (!session?.access_token) return
  supabase.realtime.setAuth(session.access_token)
  channel = supabase
    .channel("schedule-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "schedule_entries" }, handler)
    .subscribe()
})
```
Note: in the recovery path, use `async/await` (not `.then`) so `removeChannel` can be `await`ed before re-subscribing.

### useCallback for stable child callbacks (component)
**Source:** `src/components/schedule/schedule-with-realtime.tsx` lines 28–30
**Apply to:** `handleRefresh` in `ScheduleWithRealtime`
```typescript
const handleEntryChange = useCallback((entry: EntryUpdate) => {
  realtimeRef.current?.(entry)
}, [])
```

---

## No Analog Found

All five files have direct analogs (self or peer patterns). No files require fallback to external reference patterns.

## Metadata

**Analog search scope:** `src/components/schedule/`, `src/actions/`, `src/app/`, `src/lib/schedule/`
**Files scanned:** 6 (realtime-provider.tsx, schedule-with-realtime.tsx, layout.tsx, globals.css, schedule.ts, queries.ts)
**Pattern extraction date:** 2026-05-17
