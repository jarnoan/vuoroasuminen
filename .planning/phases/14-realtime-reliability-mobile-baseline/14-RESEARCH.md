# Phase 14: Realtime Reliability + Mobile Baseline - Research

**Researched:** 2026-05-17
**Domain:** Browser Page Visibility API, Supabase Realtime channel lifecycle, Next.js Viewport metadata API
**Confidence:** HIGH

## Summary

Phase 14 has two tightly scoped concerns. The realtime reliability work adds a `visibilitychange` listener inside `RealtimeProvider` that triggers a full schedule re-fetch and channel re-subscription whenever the tab returns from background. The mobile viewport baseline adds a typed `viewport` export to `layout.tsx` and a single `html { overflow-x: hidden }` rule to `globals.css`.

The existing `RealtimeProvider` already establishes the correct pattern: `supabase.auth.getSession()` → `supabase.realtime.setAuth(token)` → `channel.subscribe()`. The recovery sequence follows the same steps, with `supabase.removeChannel(channel)` added before re-entry. Supabase officially acknowledges that missed events are NOT buffered during a dropped connection — the project's decision to do a full re-fetch (D-03) is the correct and canonical approach.

The schedule re-fetch must go through a Server Action because `getScheduleWindow` lives in `src/lib/schedule/queries.ts` as a server-only database function (uses `db` directly, not `"use server"`). A thin wrapper in `src/actions/schedule.ts` that calls `getScheduleWindow` and returns the `ScheduleDay[]` array is the standard Next.js pattern.

**Primary recommendation:** Extend the single `useEffect` in `RealtimeProvider` to also register a `visibilitychange` handler. When hidden→visible fires, run: removeChannel → Server Action re-fetch → setAuth → re-subscribe. Thread `onRefresh` callback up through `ScheduleWithRealtime` to deliver fresh data to `DashboardShell`'s `setDays`.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Background Recovery Mechanism**
- D-01: `RealtimeProvider` adds a `document.visibilitychange` listener. When `document.hidden` transitions to `false`, trigger full schedule re-fetch and re-subscribe.
- D-02: Recovery sequence: (1) unsubscribe/remove existing channel, (2) Server Action re-fetch + `onRefresh` callback, (3) re-subscribe with fresh session token.
- D-03: Do NOT rely on Supabase channel reconnect to deliver missed events — always full data re-fetch on visibility return.
- D-04: No time threshold — re-fetch on every `hidden → visible` transition.

**Recovery UX**
- D-05: Silent recovery. No toast, spinner, or loading indicator.

**Mobile Viewport Baseline**
- D-06: Add `export const viewport: Viewport = { width: "device-width", initialScale: 1 }` to `src/app/layout.tsx` using the Next.js Viewport API. NOT a raw `<meta>` tag.
- D-07: Add `html { overflow-x: hidden; }` to `src/app/globals.css`. Only global CSS change in this phase.
- D-08: Safe area insets deferred to Phase 15.
- D-09: Touch-action defaults deferred to Phase 15/16.

### Claude's Discretion

- Exact Server Action signature for re-fetching schedule (reuse existing action in `src/actions/schedule.ts`)
- Whether `onRefresh` callback is threaded through `ScheduleWithRealtime` → `RealtimeProvider` or handled differently
- Session token refresh strategy before re-subscribing (call `supabase.auth.getSession()` before `setAuth()`)
- Whether to expose a stable `refresh()` imperative handle vs internal effect

### Deferred Ideas (OUT OF SCOPE)

- Safe area insets CSS vars — Phase 15
- Touch-action defaults — Phase 15/16
- Per-user offline indicator — future milestone
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RTLT-01 | User returning to app after 15+ minutes in background sees up-to-date schedule without manual page reload | visibilitychange API (universal browser support), full re-fetch via Server Action, Supabase channel re-subscribe pattern |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Background tab detection | Browser / Client | — | `document.visibilitychange` is a browser DOM event; must live in a client component (`"use client"`) |
| Schedule re-fetch on visibility return | API / Backend (Server Action) | — | `getScheduleWindow` queries the DB via Drizzle; runs server-side via `"use server"` action |
| Channel re-subscribe after re-fetch | Browser / Client | — | Supabase realtime client is browser-side; `removeChannel` + `subscribe()` are client calls |
| Viewport meta tag | Frontend Server (SSR) | — | `viewport` export in `layout.tsx` is a Server Component export; Next.js injects meta tag at SSR time |
| `html { overflow-x: hidden }` | Browser / Client | — | Global CSS rule, applied by browser; edited in `globals.css` |

## Standard Stack

### Core (all already installed in the project)

| Library | Version (installed) | Purpose | Why Standard |
|---------|--------------------|---------|--------------| 
| `@supabase/ssr` | 2.x (installed) | `createBrowserClient` for Supabase client in client components | Already used in `src/lib/supabase/client.ts`; re-subscribe path uses same client |
| `@supabase/supabase-js` | 2.x (installed) | Realtime channel API (`channel()`, `removeChannel()`, `realtime.setAuth()`) | The transport layer for all realtime operations |
| `next` | 15.x (installed) | `Viewport` type export from `'next'` | Official typed API for viewport meta; avoids raw meta tag |

### No new dependencies needed

All required libraries are already installed. Phase 14 is a pure code-change phase.

## Architecture Patterns

### System Architecture Diagram

```
Browser tab becomes visible
        |
        v
visibilitychange listener (document)
  document.hidden === false?
        | yes
        v
[1] supabase.removeChannel(existingChannel)
        |
        v
[2] Server Action: getScheduleDays()
    (Next.js "use server" → Drizzle → Supabase DB)
        |
        v
[3] onRefresh(freshDays) callback
    → ScheduleWithRealtime.setDays(freshDays)
    → DashboardShell.setDays(freshDays)
        |
        v
[4] supabase.auth.getSession()
    → supabase.realtime.setAuth(access_token)
    → supabase.channel("schedule-changes").on(...).subscribe()
        |
        v
Live CDC stream resumes with fresh token
```

### Recommended File Structure (no new files needed)

```
src/
├── actions/
│   └── schedule.ts          # Add getScheduleDays() Server Action wrapping getScheduleWindow()
├── components/schedule/
│   ├── realtime-provider.tsx # Add visibilitychange listener + recovery sequence
│   └── schedule-with-realtime.tsx # Add onRefresh prop wired to setDays
└── app/
    ├── layout.tsx            # Add viewport export
    └── globals.css           # Add html { overflow-x: hidden }
```

### Pattern 1: visibilitychange listener in useEffect (React cleanup pattern)

**What:** Register `visibilitychange` on `document` inside `useEffect`; return cleanup removes the listener.
**When to use:** Any client component that needs to react to tab visibility changes.

```typescript
// Source: MDN Web Docs / React useEffect pattern [VERIFIED: MDN + React docs]
useEffect(() => {
  const handleVisibilityChange = () => {
    if (!document.hidden) {
      // tab became visible — trigger recovery
    }
  }
  document.addEventListener("visibilitychange", handleVisibilityChange)
  return () => {
    document.removeEventListener("visibilitychange", handleVisibilityChange)
  }
}, [])
```

**Key detail:** The handler checks `!document.hidden` (tab is now visible), not just that the event fired. The event fires on BOTH transitions (visible→hidden AND hidden→visible).

### Pattern 2: Supabase channel teardown + re-subscribe

**What:** Remove the dead/paused channel and create a fresh one with a current session token.
**When to use:** Any time a Supabase Realtime channel may have missed events due to throttling or WebSocket drop.

```typescript
// Source: Context7 /supabase/supabase-js + official Supabase discussion #37002 [VERIFIED]
// Step 1: remove dead channel
if (channel) {
  await supabase.removeChannel(channel)
  channel = null
}

// Step 2: get fresh token (getSession reads from localStorage — no network needed)
const { data: { session } } = await supabase.auth.getSession()
if (!session?.access_token) return

// Step 3: set token on the realtime transport
supabase.realtime.setAuth(session.access_token)

// Step 4: create and subscribe fresh channel
channel = supabase
  .channel("schedule-changes")
  .on("postgres_changes", { event: "*", schema: "public", table: "schedule_entries" }, handler)
  .subscribe()
```

**Important:** `setAuth()` updates the join payload for subsequent channels AND the existing WebSocket transport. After a long background pause, the heartbeat may have stopped before the token expired — `setAuth()` with a fresh token from `getSession()` ensures the new channel join uses a valid JWT.

**`removeChannel()` is async in v2:** `supabase.removeChannel(channel)` returns `Promise<void>`. The existing cleanup code uses it synchronously (fire-and-forget in the useEffect return). For the recovery path triggered by visibilitychange, awaiting it is preferable to ensure the old channel is fully torn down before re-subscribing.

### Pattern 3: Server Action wrapping a query function

**What:** A thin `"use server"` action in `src/actions/schedule.ts` that calls `getScheduleWindow()` and returns `ScheduleDay[]` for client-side consumption.
**When to use:** Any server-only database function that a client component needs to call (e.g., from a useEffect or event handler).

```typescript
// Source: Next.js App Router pattern [VERIFIED: Next.js docs]
// In src/actions/schedule.ts (already "use server" at top of file)
export async function getScheduleDays(viewStart?: string): Promise<ScheduleDay[]> {
  await requireAuthorizedParent()
  const window = await getScheduleWindow(viewStart)
  return window.days
}
```

The file already has `"use server"` at the top and `requireAuthorizedParent()` for auth gating. The new action slots in as a peer to `toggleCell`, `saveNotes`, etc.

### Pattern 4: Next.js Viewport export

**What:** Typed `viewport` export alongside `metadata` export in a Server Component (layout or page).
**When to use:** Setting viewport meta tag in any Next.js 14+ App Router app.

```typescript
// Source: Next.js official docs — generateViewport [VERIFIED: https://nextjs.org/docs/app/api-reference/functions/generate-viewport]
import type { Metadata, Viewport } from "next"

export const metadata: Metadata = {
  title: "Vuoroasuminen",
  description: "Yhteinen vuoroasumisaikataulu vanhemmille",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
}
```

**Critical details:**
- `Viewport` is imported from `"next"` — same package as `Metadata`.
- `viewport` and `metadata` are separate named exports — they coexist in the same file.
- `viewport` is ONLY supported in Server Components (layout.tsx and page.tsx). `RealtimeProvider` is a client component — do NOT add it there.
- The `viewport` key in `metadata` is deprecated as of Next.js 14 — the separate `viewport` export is the correct approach.
- Next.js sets a default viewport meta tag automatically. The explicit export is needed to guarantee `width=device-width, initial-scale=1` regardless of framework defaults.

### Anti-Patterns to Avoid

- **Using `channel.unsubscribe()` instead of `supabase.removeChannel(channel)`:** `removeChannel` fully cleans up the channel and frees server-side resources. `unsubscribe()` alone leaves the channel object lingering. Use `removeChannel`.
- **Calling `setAuth` without `removeChannel` first:** Setting the auth token does not replace an already-subscribed channel's join payload retroactively in all cases. For a recovery sequence, remove first, then setAuth, then re-subscribe.
- **Adding `visibilitychange` listener outside `useEffect`:** The listener must be added in an effect with cleanup to avoid duplicate listeners on React StrictMode double-mount and to prevent memory leaks.
- **Adding a raw `<meta name="viewport">` tag:** Next.js 14+ treats the `viewport` export as the canonical source. Adding a raw meta tag creates a duplicate that can confuse browsers.
- **Re-fetching via `router.refresh()`:** `router.refresh()` triggers a full server-side render and replaces all client state. For the silent recovery (D-05), a targeted Server Action call that returns only the data needed is correct.
- **Checking `document.visibilityState === "visible"` vs `!document.hidden`:** Both are equivalent (`document.hidden === true` when `visibilityState === "hidden"`). Either works; `!document.hidden` is slightly more readable.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Realtime missed events on reconnect | Custom event queue / local diff | Full re-fetch via Server Action | Supabase docs confirm events are NOT buffered during disconnect — no queue can help; re-fetch is the only reliable solution |
| Token refresh for realtime | Custom JWT decode + expiry timer | `supabase.auth.getSession()` on visibility return | `getSession()` reads from localStorage (already refreshed by the auth client's background timer); calling it fresh on visibility gives the most current token without a network round-trip |
| Viewport meta tag | Raw `<meta>` in `<head>` | `viewport` export from `'next'` | Next.js deduplicates meta tags; the typed export prevents duplicates and works with SSG/SSR correctly |

**Key insight:** Supabase Realtime has no event buffer for CDC (Postgres Changes). A missed insert during a 15-minute background pause is gone from the channel perspective. The only correct fix is a full DB re-fetch.

## Common Pitfalls

### Pitfall 1: visibilitychange fires on window focus (desktop), not just tab switch
**What goes wrong:** On desktop, switching application windows (Alt+Tab) can fire `visibilitychange` in some browsers. On mobile, switching apps triggers it reliably.
**Why it happens:** `document.hidden` becomes `true` when the OS window loses focus in some browsers (behavior varies).
**How to avoid:** This is acceptable for this use case — a re-fetch on window refocus is correct behavior (D-04: no time threshold, re-fetch on every transition). The query is cheap.
**Warning signs:** If re-fetches become excessive in testing, check if `focus`/`blur` on `window` is firing in addition to `visibilitychange`.

### Pitfall 2: iOS Safari fires visibilitychange unreliably in some PWA scenarios
**What goes wrong:** In added-to-homescreen PWA mode on iOS, `visibilitychange` may fire multiple times or not at all in some iOS versions.
**Why it happens:** iOS limits background JS execution and has different PWA/webview lifecycle semantics.
**How to avoid:** The app is a standard browser web app (not a PWA), so this is lower risk. The silent fallback is no re-fetch — the user can still manually reload. This is acceptable per D-04/D-05.
**Warning signs:** Not currently testable from this codebase without a PWA manifest.

### Pitfall 3: Double-invocation from React StrictMode
**What goes wrong:** In development with StrictMode, effects run twice (mount → cleanup → mount). The `visibilitychange` listener gets added, removed, and added again — but if the channel setup races with the double-mount, you can end up with 0 or 2 listeners.
**Why it happens:** StrictMode intentionally double-invokes effects to surface cleanup bugs.
**How to avoid:** The `cancelled` ref pattern already in `RealtimeProvider` handles the channel setup race. The same pattern (check `cancelled` before operating on the channel) should be applied to the visibility handler. Specifically, the visibility handler should close over `cancelled` and check it before running recovery.
**Warning signs:** Unexpected re-fetches or "channel already subscribed" errors in dev only.

### Pitfall 4: `removeChannel` is async but the existing cleanup treats it as sync
**What goes wrong:** The existing useEffect return does `if (channel) supabase.removeChannel(channel)` without `await`. This is fine for cleanup (fire-and-forget on unmount). But in the recovery path inside visibilitychange, not awaiting `removeChannel` before re-subscribing can cause the old channel to still be connected when the new one subscribes.
**Why it happens:** `removeChannel` returns `Promise<void>` but is safe to call fire-and-forget for cleanup. For sequential re-subscription, sequencing matters.
**How to avoid:** In the recovery function, `await supabase.removeChannel(channel)` before proceeding to re-subscribe.
**Warning signs:** "Channel already exists" errors in the Supabase Realtime logs, or double CDC events.

### Pitfall 5: `onRefresh` callback prop threading
**What goes wrong:** `RealtimeProvider` needs to call `onRefresh(freshDays)` but currently only receives `onEntryChange`. `ScheduleWithRealtime` owns `setDays` (via the `setDays` prop from `DashboardShell`). Threading a new prop through requires updating `RealtimeProviderProps` and `ScheduleWithRealtimeProps`.
**Why it happens:** The current architecture passes live updates as single-entry patches (`onEntryChange`). Full re-fetch returns `ScheduleDay[]` and needs a different callback shape.
**How to avoid:** Add `onRefresh: (days: ScheduleDay[]) => void` to `RealtimeProviderProps`. In `ScheduleWithRealtime`, create a stable `handleRefresh = useCallback((days) => setDays(days), [setDays])` and pass it to `RealtimeProvider`. `setDays` is already in scope in `ScheduleWithRealtime` (it's a prop from `DashboardShell`).
**Warning signs:** TypeScript error on missing prop, or stale schedule shown after background return.

### Pitfall 6: Viewport export placed in a client component
**What goes wrong:** `viewport` export is silently ignored if added to a file marked `"use client"`.
**Why it happens:** Next.js only processes `viewport` and `metadata` exports from Server Components.
**How to avoid:** The export goes in `src/app/layout.tsx` which is already a Server Component (no `"use client"` directive). Confirmed correct target.
**Warning signs:** No `<meta name="viewport">` tag in the rendered HTML `<head>`.

## Code Examples

Verified patterns from official sources:

### Viewport export (final form for layout.tsx)
```typescript
// Source: https://nextjs.org/docs/app/api-reference/functions/generate-viewport [VERIFIED]
import type { Metadata, Viewport } from "next"

export const metadata: Metadata = {
  title: "Vuoroasuminen",
  description: "Yhteinen vuoroasumisaikataulu vanhemmille",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
}
```

### globals.css addition (appended inside @layer base or after it)
```css
/* Source: CSS standard, confirmed safe for all browsers [VERIFIED: MDN] */
@layer base {
  html {
    @apply font-sans;
    overflow-x: hidden;   /* add this line */
  }
}
```

Note: The existing `globals.css` already has `html { @apply font-sans; }` inside `@layer base`. The `overflow-x: hidden` should be added to that same rule block, not as a separate rule.

### RealtimeProvider recovery sequence (sketch)
```typescript
// Based on: Context7 /supabase/supabase-js + Supabase discussion #37002 [VERIFIED pattern]
// Inside useEffect in RealtimeProvider:

const handleVisibilityChange = async () => {
  if (document.hidden || cancelled) return   // only act on visible transition

  // Step 1: tear down dead channel
  if (channel) {
    await supabase.removeChannel(channel)
    channel = null
  }

  // Step 2: re-fetch full schedule
  const freshDays = await getScheduleDays()   // Server Action
  if (cancelled) return
  onRefreshRef.current?.(freshDays)           // update UI

  // Step 3: get fresh token and re-subscribe
  const { data: { session } } = await supabase.auth.getSession()
  if (cancelled || !session?.access_token) return
  supabase.realtime.setAuth(session.access_token)
  channel = supabase
    .channel("schedule-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "schedule_entries" }, handler)
    .subscribe()
}

document.addEventListener("visibilitychange", handleVisibilityChange)

// In cleanup return:
return () => {
  cancelled = true
  document.removeEventListener("visibilitychange", handleVisibilityChange)
  if (channel) supabase.removeChannel(channel)
}
```

### Server Action for re-fetch (addition to src/actions/schedule.ts)
```typescript
// Source: Next.js Server Actions pattern [VERIFIED]
// Appended to existing src/actions/schedule.ts (already "use server" at top)
import type { ScheduleDay } from "@/lib/schedule/types"
import { getScheduleWindow } from "@/lib/schedule/queries"

export async function getScheduleDays(viewStart?: string): Promise<ScheduleDay[]> {
  await requireAuthorizedParent()
  const window = await getScheduleWindow(viewStart)
  return window.days
}
```

The `viewStart` parameter should pass through the current view start so the re-fetch covers the same window the user was viewing, not necessarily the default rolling window.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `metadata.viewport` in Next.js Metadata | Separate `viewport` export with `Viewport` type | Next.js 14.0.0 | The `viewport` key inside `metadata` is deprecated; must use separate export |
| Manual `<meta name="viewport">` in `<head>` | `viewport` export handled by Next.js | Next.js 13+ | Next.js deduplicates; raw tag creates duplicates |
| `channel.unsubscribe()` alone for cleanup | `supabase.removeChannel(channel)` | supabase-js v2 | `removeChannel` is the complete cleanup; `unsubscribe()` alone is insufficient per docs |

**Deprecated/outdated:**
- `metadata.viewport`: deprecated in Next.js 14 — use `export const viewport: Viewport` instead.
- Polling for schedule updates: the existing realtime subscription already replaces this; background tab recovery via re-fetch + re-subscribe is the correct extension.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `getScheduleWindow` does not need a `viewStart` parameter for the recovery re-fetch — the default rolling window is always the correct window to re-fetch | Code Examples | If users navigate view windows, the re-fetch may return a different window than currently displayed; pass `viewStart` from state to be safe |
| A2 | `overflow-x: hidden` on `html` does not conflict with existing Tailwind layout (no horizontal scroll content currently exists) | Code Examples / globals.css | If existing components rely on horizontal overflow being visible, they would be clipped |

**If this table is empty:** would not be empty — A1 and A2 are genuine unknowns from reading the codebase.

## Open Questions

1. **What is the current view start when visibilitychange fires?**
   - What we know: `DashboardShell` receives `initialViewStart` from the page URL param; `ViewToolbar` uses `router.push` to change it (URL-driven)
   - What's unclear: `RealtimeProvider` has no access to `viewStart` — it only gets `onEntryChange`. If the user navigated to a non-default view window before backgrounding, the re-fetch needs to pass that `viewStart` or it will re-fetch the default window.
   - Recommendation: Thread `viewStart` (or current visible date range) from `DashboardShell` → `ScheduleWithRealtime` → `RealtimeProvider` as a prop, so `getScheduleDays(viewStart)` fetches the correct window.

2. **Should the recovery also handle the case where `supabase.auth.getSession()` returns no session (user signed out while backgrounded)?**
   - What we know: If the session expired or the user signed out, `getSession()` returns `null`. The channel would not be re-subscribed.
   - What's unclear: Should this trigger a redirect to sign-in, or just silently skip re-subscription?
   - Recommendation: Check `session` before calling `setAuth`. If null, skip re-subscribe (the next page interaction will hit auth middleware and redirect). This is the simplest safe behavior.

## Environment Availability

Step 2.6: SKIPPED — Phase 14 is a pure code-change phase. No external CLIs, databases, or services need to be installed; all dependencies (Supabase, Next.js) are already running in the existing dev setup.

## Validation Architecture

`workflow.nyquist_validation` is `false` in `.planning/config.json` — this section is omitted per config.

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `supabase.auth.getSession()` — session token is re-validated before re-subscribing |
| V3 Session Management | yes | Supabase session is re-read from localStorage on each recovery; expired sessions are handled by Supabase auth client automatically |
| V4 Access Control | yes | `requireAuthorizedParent()` is called inside the new Server Action — same guard as all other schedule actions |
| V5 Input Validation | no | No new user input in this phase |
| V6 Cryptography | no | No cryptographic operations added |

**Key security note:** The Server Action `getScheduleDays` MUST call `requireAuthorizedParent()` before querying the DB. This is already the established pattern in `src/actions/schedule.ts` for all other actions.

**Realtime token:** `setAuth(access_token)` passes the Supabase JWT to the realtime WebSocket. This token is already scoped by RLS policies (Phase 9). Re-using the same `getSession()` → `setAuth()` pattern that the initial subscription uses is correct and does not create new attack surface.

## Sources

### Primary (HIGH confidence)
- Context7 `/supabase/supabase-js` — `channel()`, `removeChannel()`, `setAuth()`, `getSession()` API signatures
- `https://nextjs.org/docs/app/api-reference/functions/generate-viewport` — `Viewport` type, `viewport` export signature, viewport fields, version history
- `src/components/schedule/realtime-provider.tsx` — existing channel setup pattern (in-repo)
- `src/actions/schedule.ts` — existing Server Action patterns (in-repo)
- `src/app/layout.tsx` — existing metadata export structure (in-repo)
- `src/app/globals.css` — existing CSS structure including `@layer base` block (in-repo)

### Secondary (MEDIUM confidence)
- `https://github.com/orgs/supabase/discussions/37002` — manual token refresh discussion; confirmed that `setAuth` is needed after background pause when heartbeat has stopped
- `https://github.com/supabase/realtime-js/issues/274` — confirmed events are NOT buffered; full re-fetch is the canonical recovery approach
- MDN `document.visibilitychange` — event behavior, browser support (universal since 2017)

### Tertiary (LOW confidence)
- WeWeb community post on PWA tab-switch behavior — iOS-specific notes; not verified against official Apple docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies already installed, APIs verified via Context7 and official docs
- Architecture (recovery pattern): HIGH — confirmed by official Supabase discussions and Context7
- Viewport API: HIGH — verified directly against Next.js official docs (lastUpdated: 2026-05-13)
- Pitfalls: MEDIUM — most from verified sources; iOS PWA edge case is LOW

**Research date:** 2026-05-17
**Valid until:** 2026-06-17 (stable APIs — Next.js Viewport stable since v14.0.0, Supabase JS v2 channel API stable)
