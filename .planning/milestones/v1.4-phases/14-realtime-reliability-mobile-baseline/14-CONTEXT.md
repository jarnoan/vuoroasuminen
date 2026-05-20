# Phase 14: Realtime Reliability + Mobile Baseline - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Two concerns:
1. **Realtime reliability** — Fix silent data loss when a parent returns from a background tab: detect visibility change, re-fetch full schedule, and re-subscribe to the Supabase Realtime channel (RTLT-01).
2. **Mobile viewport baseline** — Add the viewport meta tag and body overflow foundation so Phases 15–16 have a correct mobile canvas to build on.

</domain>

<decisions>
## Implementation Decisions

### Background Recovery Mechanism
- **D-01:** `RealtimeProvider` (`src/components/schedule/realtime-provider.tsx`) adds a `document.visibilitychange` listener. When `document.hidden` transitions to `false` (tab becomes visible), trigger a full schedule re-fetch and re-subscribe.
- **D-02:** Recovery sequence: (1) unsubscribe/remove existing channel, (2) call a Server Action to re-fetch full schedule data and call a provided `onRefresh` callback, (3) re-subscribe to the Realtime channel with a fresh session token. This sequence handles dead/paused connections where Supabase has not buffered missed events.
- **D-03:** Do NOT rely solely on Supabase channel reconnect to deliver missed events — it is unreliable for connections that were paused or dropped. Always do a full data re-fetch on visibility return.
- **D-04:** No time threshold — re-fetch on every `hidden → visible` transition. The schedule query is cheap and the app has two users. Correctness over network savings.

### Recovery UX
- **D-05:** Silent recovery. Schedule cells update with fresh data without any toast, spinner, or loading indicator. The update should feel like the live feed — data just changes.

### Mobile Viewport Baseline
- **D-06:** Add `export const viewport: Viewport = { width: "device-width", initialScale: 1 }` to `src/app/layout.tsx` using the Next.js `Viewport` metadata API. Do NOT add a raw `<meta>` tag — use the typed export.
- **D-07:** Add `html { overflow-x: hidden; }` to `src/app/globals.css`. This is the only global CSS change in this phase. Prevents horizontal scroll bounce on iOS.
- **D-08:** Safe area insets (CSS `env(safe-area-inset-*)`) are NOT added in this phase — they will be introduced in Phase 15 when actually used by header/toolbar components.
- **D-09:** Touch-action defaults are NOT added globally — they belong in specific interactive components (Phase 15/16).

### Claude's Discretion
- Exact Server Action signature for re-fetching schedule (the action likely already exists in `src/actions/schedule.ts` — reuse it)
- Whether `onRefresh` callback is threaded through `ScheduleWithRealtime` → `RealtimeProvider` or handled differently
- Session token refresh strategy before re-subscribing (call `supabase.auth.getSession()` before `setAuth()`)
- Whether to expose a stable `refresh()` imperative handle vs internal effect

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §RTLT — RTLT-01 definition (background tab recovery)

### Roadmap
- `.planning/ROADMAP.md` §Phase 14 — goal, success criteria (3 must-be-true)

### Files to modify
- `src/components/schedule/realtime-provider.tsx` — add visibilitychange listener + re-fetch + re-subscribe logic (D-01 through D-04)
- `src/components/schedule/schedule-with-realtime.tsx` — may need `onRefresh` prop wiring depending on approach
- `src/app/layout.tsx` — add `viewport` export (D-06)
- `src/app/globals.css` — add `html { overflow-x: hidden }` (D-07)

### Prior phase decisions (carry forward)
- `.planning/phases/09-row-level-security/09-CONTEXT.md` — D-03: `src/lib/supabase/client.ts` is `createBrowserClient` from `@supabase/ssr`; re-subscribe must use this same client

### Supabase Realtime docs
- Supabase Realtime channel lifecycle: `subscribe()`, `unsubscribe()`, `removeChannel()` — review before implementing reconnect
- `supabase.realtime.setAuth(token)` before re-subscribing when RLS is enabled

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/schedule/realtime-provider.tsx`: existing channel setup uses `supabase.auth.getSession()` + `supabase.realtime.setAuth()` — the re-subscribe path should replicate this pattern
- `src/actions/schedule.ts`: likely contains a `getSchedule` or `getScheduleDays` server action — re-use for the visibility re-fetch rather than a new fetch path
- `src/components/schedule/schedule-with-realtime.tsx`: wraps `RealtimeProvider` + `ScheduleTable`; owns `setDays` — the `onRefresh` data callback needs to reach this component

### Established Patterns
- Phase 8 D-11 / Phase 9 D-07: server-side reads use admin Drizzle (`db`) — BUT the re-fetch here is triggered from a client component, so it goes through a Server Action (typed, validated, uses Drizzle internally)
- `layout.tsx` uses Next.js `Metadata` type export — `Viewport` export follows the same pattern

### Integration Points
- `RealtimeProvider` cleanup (`return () => { cancelled = true; if (channel) supabase.removeChannel(channel) }`) must be extended to also cancel the visibility listener
- The `visibilitychange` listener is on `document` — needs cleanup in `useEffect` return

</code_context>

<specifics>
## Specific Ideas

No specific design references — open to standard browser API approaches.

</specifics>

<deferred>
## Deferred Ideas

- Safe area insets CSS vars — Phase 15 (when header/toolbar actually needs them)
- Touch-action defaults — Phase 15/16 (component-level, not global)
- Per-user offline indicator — future milestone

</deferred>

---

*Phase: 14-realtime-reliability-mobile-baseline*
*Context gathered: 2026-05-17*
