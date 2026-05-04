# Phase 5: View Window Control - Research

**Researched:** 2026-05-04
**Domain:** Next.js 16 App Router searchParams, shadcn/ui DatePicker (base-nova preset), date-fns week snapping, client-side URL navigation
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** View start date stored as URL search parameter `?viewStart=YYYY-MM-DD`. No DB table, no localStorage.
- **D-02:** Reload preserves the view (URL unchanged). Fresh navigation to dashboard (no `?viewStart` param) defaults to Monday of current week.
- **D-03:** URL approach satisfies VIEW-04 naturally — each parent controls their own browser URL.
- **D-04:** URL change triggers a full server re-render. `searchParams.viewStart` is read by the Server Component, passed to `getScheduleWindow(startDate)`. No client-side data management.
- **D-05:** URL updates use `router.replace()` (not `router.push`). No history stack accumulation.
- **D-06:** Toolbar row added between page header and schedule table: `‹ Prev week` button, `Valitse päivä` button (shadcn DatePicker), `Tänään` button.
- **D-07:** Existing floating `Tänään` button (fixed bottom-right) is removed. Functionality moves to toolbar.
- **D-08:** `Tänään` button: (1) clears `viewStart` from URL (resets to default Mon of current week), (2) scrolls to today's row.
- **D-09:** shadcn/ui DatePicker pattern — Popover + Calendar + react-day-picker. Install: `npx shadcn@canary add popover calendar`.
- **D-10:** No hard limit on backward navigation. `‹ Prev week` is always enabled.

### Claude's Discretion

- Loading state / skeleton while server re-renders on URL change — standard Next.js `loading.tsx` or Suspense boundary.
- Exact styling of toolbar (padding, alignment, gap between buttons) — match existing button/header styles.
- Whether `viewStart` URL param snaps to Monday automatically or allows any date — snapping to Monday is logical given week-based navigation.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VIEW-01 | View window starts from Monday of the current week by default — past days of the current week are visible | `getWindowBounds()` already does this; refactor to accept optional `startDate` param |
| VIEW-02 | User can tap/click "Show previous week" to extend the view one week back; action is repeatable | `‹ Prev week` button subtracts 7 days from current `viewStart`, calls `router.replace` |
| VIEW-03 | User can set an explicit start date via a date picker | shadcn Popover + Calendar (react-day-picker) — snaps to Monday of selected week |
| VIEW-04 | View window preferences are stored per-user — one parent's changes do not affect the other | URL-based; each parent's browser URL is independent |
</phase_requirements>

---

## Summary

Phase 5 adds a toolbar row to the dashboard that lets each parent independently control the schedule view start date. The implementation is a pure UI + data-flow change with no new database tables — the view start date lives in the URL as `?viewStart=YYYY-MM-DD`, is read by the Server Component as a Promise (Next.js 16 App Router pattern), validated server-side, and passed into the existing `getScheduleWindow()` query function after `getWindowBounds()` is refactored to accept an optional start date.

The project is running **Next.js 16.2.2** (not 15 as CLAUDE.md describes). The `searchParams` prop on `page.tsx` is a Promise — it must be `await`ed, exactly as it is in Next.js 15. This is the same async pattern across both major versions.

The shadcn/ui preset in use is **base-nova**, which uses `@base-ui/react` (v1.3.0 already installed) instead of Radix UI. This changes the composition pattern for triggers: use `render={<Button />}` instead of `asChild`. The `popover` and `calendar` components do not yet exist in `src/components/ui/` — they must be installed via `npx shadcn@canary add popover calendar`.

**Primary recommendation:** Install shadcn popover + calendar, refactor `getWindowBounds()` to accept `startDate?: string`, read `await searchParams` in `page.tsx`, build `ViewToolbar` Client Component, delete `TodayButton`, update `DashboardShell`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Read `viewStart` from URL | API / Backend (Server Component) | — | `page.tsx` is an async Server Component; reads `await searchParams` and validates |
| Validate `viewStart` ISO date | API / Backend (Server Component) | — | Prevent invalid values reaching DB query; fall back silently to default |
| Compute window start/end dates | API / Backend (Server Component) | — | `getWindowBounds(startDate?)` runs server-side; result passed as `initialData` |
| Render toolbar UI | Browser / Client | — | `ViewToolbar` is a Client Component — uses `useRouter`, `useSearchParams`, DOM scroll |
| Navigate to new `viewStart` | Browser / Client | Frontend Server (SSR triggers re-render) | `router.replace()` in Client Component triggers RSC re-render |
| Date picker interaction | Browser / Client | — | Popover + Calendar are client-side interactive components |
| Scroll to today | Browser / Client | — | `document.querySelector` scroll is browser-only |
| Loading skeleton | Frontend Server (SSR) | — | `loading.tsx` co-located with `page.tsx` — auto-wrapped Suspense by Next.js |

---

## Standard Stack

### Core (already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.2 | App Router, Server Components, `searchParams` as Promise | Project framework — confirmed in package.json [VERIFIED: package.json] |
| `date-fns` | ^4.1.0 (v4) | `startOfWeek`, `parseISO`, `isValid`, `addDays`, `format` | Already in use in `generate-default.ts` and `queries.ts` [VERIFIED: package.json] |
| `@base-ui/react` | 1.3.0 | Popover primitive underlying the shadcn base-nova Popover component | Already installed; base-nova preset uses Base UI not Radix [VERIFIED: node_modules] |

### New installs this phase

| Library | Source | Purpose | Notes |
|---------|--------|---------|-------|
| shadcn `popover` component | `npx shadcn@canary add popover` | Popover primitive for DatePicker | Uses `@base-ui/react` already installed; copies source into `src/components/ui/popover.tsx` [VERIFIED: Context7/shadcn-ui] |
| shadcn `calendar` component | `npx shadcn@canary add calendar` | Calendar/DayPicker for DatePicker | Will auto-install `react-day-picker` as dep [VERIFIED: Context7/shadcn-ui] |
| `react-day-picker` | auto via shadcn calendar | DayPicker engine inside Calendar | v9.14.0 latest on npm; not yet in project [VERIFIED: npm view] |

### Installation

```bash
npx shadcn@canary add popover calendar
```

This installs both components and auto-adds `react-day-picker` to `package.json`.

**Version verification:**

| Package | npm latest | Status |
|---------|-----------|--------|
| `react-day-picker` | 9.14.0 | Not yet installed — will be added by shadcn install [VERIFIED: npm view] |
| `@base-ui/react` | 1.3.0 | Already installed [VERIFIED: node_modules] |
| Next.js | 16.2.4 (latest) | Project uses 16.2.2 — no action required [VERIFIED: npm view + package.json] |

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (user clicks toolbar button)
  │
  ▼
ViewToolbar (Client Component)
  │  router.replace('/dashboard?viewStart=YYYY-MM-DD')
  │
  ▼
Next.js Router → triggers RSC re-render
  │
  ▼
loading.tsx activates (Suspense fallback — schedule skeleton)
  │
  ▼
dashboard/page.tsx (Server Component, async)
  │  await searchParams → extract viewStart
  │  validateViewStart(viewStart) → snap to Monday or default
  │  getScheduleWindow(startDate)
  │
  ▼
getWindowBounds(startDate?) → { start: Date, end: Date }
  │  If startDate provided: parseISO + startOfWeek(d, { weekStartsOn: 1 })
  │  If not: existing logic (Mon of current week)
  │
  ▼
DB query (84-day window starting from computed Monday)
  │
  ▼
DateWindow returned → DashboardShell → ScheduleTable renders
```

### Recommended File Structure (changes only)

```
src/
├── app/
│   └── dashboard/
│       ├── page.tsx              # MODIFIED: accept searchParams Promise, validate, pass to query
│       └── loading.tsx           # NEW: schedule skeleton for URL-change loading state
├── components/
│   └── schedule/
│       ├── view-toolbar.tsx      # NEW: Client Component — toolbar with navigation controls
│       ├── dashboard-shell.tsx   # MODIFIED: add ViewToolbar, accept initialViewStart prop
│       ├── schedule-table.tsx    # MODIFIED: remove TodayButton import and render
│       └── today-button.tsx      # DELETED: scroll logic moved into ViewToolbar
│   └── ui/
│       ├── popover.tsx           # NEW: installed by shadcn
│       └── calendar.tsx          # NEW: installed by shadcn
└── lib/
    └── schedule/
        ├── generate-default.ts   # MODIFIED: getWindowBounds(startDate?: string)
        └── queries.ts            # MODIFIED: getScheduleWindow(startDate?: string)
```

### Pattern 1: Reading `searchParams` in Next.js 16 Server Component

`searchParams` is a `Promise` in Next.js 15+ and 16. Must be awaited.

```tsx
// Source: Context7 / vercel/next.js docs
export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ viewStart?: string }>
}) {
  const { viewStart } = await searchParams
  const validatedStart = validateViewStart(viewStart)
  const schedule = await getScheduleWindow(validatedStart)
  return <DashboardShell initialData={schedule} initialViewStart={validatedStart} header={<Header />} />
}
```

**CRITICAL:** Do not access `searchParams.viewStart` synchronously — it is a Promise and will not resolve without `await`.

### Pattern 2: URL update in Client Component (router.replace + URLSearchParams)

Use `useSearchParams()` to preserve any existing params when setting a new one. For this phase there is only one param (`viewStart`), so a simpler direct replace is acceptable — but the `URLSearchParams` pattern is the correct general approach and future-proofs for Phase 6+.

```tsx
// Source: Context7 / vercel/next.js docs (useSearchParams + createQueryString pattern)
"use client"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useCallback } from "react"

export function ViewToolbar({ initialViewStart }: { initialViewStart?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const navigateTo = useCallback((dateStr: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (dateStr) {
      params.set("viewStart", dateStr)
      router.replace(pathname + "?" + params.toString())
    } else {
      params.delete("viewStart")
      router.replace(pathname + (params.size > 0 ? "?" + params.toString() : ""))
    }
  }, [router, pathname, searchParams])

  // ...
}
```

### Pattern 3: Monday-snapping with date-fns

`startOfWeek` with `{ weekStartsOn: 1 }` always returns Monday, regardless of which weekday is passed in.

```typescript
// Source: verified via node execution in project context
import { startOfWeek, parseISO, isValid, format } from "date-fns"

function snapToMonday(dateStr: string): Date {
  const parsed = parseISO(dateStr)
  if (!isValid(parsed)) throw new Error("invalid date")
  return startOfWeek(parsed, { weekStartsOn: 1 })
}

// snapToMonday("2026-05-06") → 2026-05-04 (Wednesday → Monday)
// snapToMonday("2026-05-04") → 2026-05-04 (Monday → Monday, idempotent)
```

**Verified:** `parseISO("2026-abc")` returns `Invalid Date`; `isValid(Invalid Date)` returns `false`. Use this pair for URL param validation in the Server Component.

### Pattern 4: ViewToolbar `‹ Prev week` click handler

```typescript
function handlePrevWeek() {
  const currentStart = parseISO(currentViewStart ?? format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"))
  const prevMonday = startOfWeek(subDays(currentStart, 7), { weekStartsOn: 1 })
  navigateTo(format(prevMonday, "yyyy-MM-dd"))
}
```

### Pattern 5: `Tänään` button — two-step reset + scroll

```typescript
function handleToday() {
  navigateTo(null) // clears viewStart param, resets to Mon of current week
  // Scroll after navigation settles — use router.replace then scroll in useEffect
  // OR: scroll immediately (today row may not yet be in DOM after navigation)
}
```

**Scroll timing pitfall:** After `router.replace`, the page re-renders server-side. The today row is only in DOM after the new RSC payload arrives. Use a `useEffect` that watches `initialViewStart` to trigger scroll after the component remounts with new data, or use `setTimeout` with a small delay as fallback. The existing `schedule-table.tsx` already has an auto-scroll on mount (`scrollIntoView({ behavior: "instant" })`); once the toolbar clears `viewStart`, the page re-renders with default data and `ScheduleTable`'s own `useEffect` will auto-scroll to today. The toolbar `Tänään` button therefore does NOT need to manually trigger scroll — the `ScheduleTable` mount effect handles it.

### Pattern 6: shadcn base-nova DatePicker composition

**CRITICAL:** The project uses the **base-nova** preset (Base UI, not Radix). The trigger pattern is `render={<Button />}` NOT `asChild`. The `fi` locale for react-day-picker comes from `react-day-picker/locale`.

```tsx
// Source: Context7 / shadcn-ui docs (base variant)
"use client"
import { fi } from "react-day-picker/locale"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { CalendarIcon } from "lucide-react"

// Inside ViewToolbar:
<Popover>
  <PopoverTrigger render={<Button variant="outline" size="sm" className="font-semibold" />}>
    <CalendarIcon className="mr-1 h-3.5 w-3.5" />
    Valitse päivä
  </PopoverTrigger>
  <PopoverContent className="w-auto p-0">
    <Calendar
      mode="single"
      selected={selectedDate}
      onSelect={handleDateSelect}
      locale={fi}
    />
  </PopoverContent>
</Popover>
```

**Note:** The `fi` locale from `react-day-picker/locale` sets Monday as the first day of the week automatically (Finnish locale). No additional `weekStartsOn` config needed on the Calendar.

### Pattern 7: `getWindowBounds` refactor

```typescript
// BEFORE (generate-default.ts):
export function getWindowBounds(): { start: Date; end: Date } {
  const today = startOfToday()
  const start = startOfWeek(today, { weekStartsOn: 1 })
  const end = addDays(start, 12 * 7 - 1)
  return { start, end }
}

// AFTER:
export function getWindowBounds(startDate?: string): { start: Date; end: Date } {
  let start: Date
  if (startDate) {
    // startDate already validated + snapped to Monday by page.tsx
    start = parseISO(startDate)
  } else {
    const today = startOfToday()
    start = startOfWeek(today, { weekStartsOn: 1 })
  }
  const end = addDays(start, 12 * 7 - 1)
  return { start, end }
}
```

The `days` loop in `queries.ts` currently hardcodes `84` days. This remains correct — window size is always 84 days regardless of start.

### Pattern 8: `getScheduleWindow` refactor

```typescript
// BEFORE:
export async function getScheduleWindow(): Promise<DateWindow>

// AFTER:
export async function getScheduleWindow(startDate?: string): Promise<DateWindow>
// Pass startDate through to getWindowBounds(startDate)
// All other logic unchanged
```

### Pattern 9: loading.tsx skeleton

```tsx
// src/app/dashboard/loading.tsx
export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Preserve header height */}
      <div className="h-14 border-b" />
      {/* Toolbar placeholder */}
      <div className="h-10 border-b" />
      {/* Publish bar placeholder */}
      <div className="h-10 border-b" />
      {/* Table skeleton */}
      <div className="flex-1 p-4 animate-pulse space-y-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-8 bg-muted rounded" />
        ))}
      </div>
    </div>
  )
}
```

### Anti-Patterns to Avoid

- **Synchronous `searchParams` access:** `searchParams.viewStart` without `await` will not resolve in Next.js 15/16. Always `const { viewStart } = await searchParams`.
- **`asChild` on base-nova triggers:** This project uses Base UI preset. Use `render={<Button />}` on `PopoverTrigger`, not `<PopoverTrigger asChild>`. Using `asChild` will cause runtime errors or broken behavior.
- **`router.push` instead of `router.replace`:** Locked as D-05. Push accumulates history; replace does not.
- **Imperative scroll after `router.replace` in the same tick:** The RSC payload has not arrived yet when `router.replace` is called. The existing `ScheduleTable` mount auto-scroll handles this correctly already — do not add a competing scroll handler.
- **`startOfWeek` without `{ weekStartsOn: 1 }`:** Default `startOfWeek` in date-fns uses Sunday (0). Always pass `{ weekStartsOn: 1 }` for Finnish Monday-first weeks.
- **Passing raw unvalidated URL param to DB query:** `viewStart` from URL is user-controlled. Validate with `parseISO + isValid` in `page.tsx` before passing to `getScheduleWindow`. Invalid values silently fall back to default.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Calendar date picker UI | Custom calendar grid | `shadcn calendar` (react-day-picker) | Keyboard nav, accessibility, locale, week start, ARIA all handled |
| Popover positioning | Custom absolute positioning | `shadcn popover` (@base-ui/react Popover) | Handles viewport collision, focus trap, keyboard dismiss |
| URL param merging | String concatenation | `new URLSearchParams(searchParams.toString())` then `.set()` | Handles encoding, multi-value params, preserves existing params |
| Finnish locale weekday names | Custom date formatter | `fi` from `react-day-picker/locale` | Correct locale data, Monday-first, month names |

**Key insight:** `react-day-picker` handles locale, week start day, keyboard navigation, and ARIA — implementing a custom calendar grid would take 10x the effort and miss edge cases.

---

## Common Pitfalls

### Pitfall 1: Forgetting `await` on `searchParams`

**What goes wrong:** TypeScript may not catch this if types are loose. At runtime, `searchParams.viewStart` returns `undefined` instead of the string, causing silent fallback to default on every request.
**Why it happens:** Next.js 15+ changed `searchParams` from a synchronous object to a Promise. Many tutorials and code snippets show the old synchronous pattern.
**How to avoid:** Type the prop as `Promise<{ viewStart?: string }>` and always `const { viewStart } = await searchParams`.
**Warning signs:** `viewStart` is always `undefined` in the server logs even when URL has `?viewStart=2026-04-28`.

### Pitfall 2: `asChild` vs `render` prop on Popover/Dialog triggers

**What goes wrong:** Using `<PopoverTrigger asChild><Button>...</Button></PopoverTrigger>` breaks silently or throws — `asChild` is Radix UI API. This project uses Base UI (base-nova preset).
**Why it happens:** Most shadcn/ui documentation and examples online show the Radix variant. The base-nova variant uses `render={<Button />}`.
**How to avoid:** Check `dialog.tsx` in this project — it uses `render={<Button />}` pattern. Follow the same pattern for `PopoverTrigger`.
**Warning signs:** Popover trigger renders twice, or button click does nothing.

### Pitfall 3: Window size hardcoded to 84 in `queries.ts`

**What goes wrong:** If someone changes the loop bound from `84` to reference a constant derived from `getWindowBounds()`, they might accidentally use the old (default) bounds object rather than the new one computed from `startDate`.
**Why it happens:** The loop bound and the window computation are currently duplicated in `queries.ts`.
**How to avoid:** Keep `84` as a named constant (`WINDOW_DAYS = 84`) or derive `end` directly from `start + 84 days` in the refactored `getWindowBounds`. The refactoring task for `getWindowBounds` must also update the `queries.ts` loop if it changes the contract.
**Warning signs:** Window always starts from Monday of current week regardless of `viewStart` param.

### Pitfall 4: `DashboardShell` is a Client Component — can't await searchParams in it

**What goes wrong:** If the toolbar is added inside `DashboardShell` but `viewStart` needs to come from the URL, someone might try to call `useSearchParams()` and pass it to server logic.
**Why it happens:** Confusion between Server and Client Component boundaries.
**How to avoid:** Read `searchParams` in `page.tsx` (Server Component), pass `initialViewStart` as a prop down to `DashboardShell` and `ViewToolbar`. `ViewToolbar` uses `useSearchParams()` for the current live URL state (needed for the `‹ Prev week` button to compute the next date correctly).
**Warning signs:** `useSearchParams` returning undefined or stale value.

### Pitfall 5: Scroll-to-today conflict between `ScheduleTable` mount effect and `ViewToolbar`

**What goes wrong:** If `ViewToolbar.handleTodayClick` also calls `scrollIntoView`, and `ScheduleTable`'s mount effect does the same, two scroll commands fire — causing a visual flash or scroll fighting.
**Why it happens:** `ScheduleTable` already has a `useEffect` that scrolls to today on mount. When `router.replace` triggers re-render, the table re-mounts and auto-scrolls.
**How to avoid:** The `Tänään` button in `ViewToolbar` only needs to call `navigateTo(null)` (clear viewStart). The existing auto-scroll in `ScheduleTable` handles the rest. Do NOT add a second `scrollIntoView` call in the toolbar handler.
**Warning signs:** Page scrolls to today twice, or animation stutters.

### Pitfall 6: `fi` locale source — `date-fns` vs `react-day-picker/locale`

**What goes wrong:** Importing `fi` from `"date-fns/locale"` (existing import in `queries.ts`) and passing it to `<Calendar locale={fi}>` will fail — the Calendar component expects `react-day-picker/locale` format.
**Why it happens:** `date-fns` locale objects and `react-day-picker` locale objects have the same name (`fi`) but are different packages.
**How to avoid:** For `<Calendar>`, import `{ fi } from "react-day-picker/locale"`. For `date-fns` formatting (dayLabel, etc.), continue using `import { fi } from "date-fns/locale"`. These are separate imports in `view-toolbar.tsx`.
**Warning signs:** TypeScript type error on `locale` prop, or Calendar displays English month names.

---

## Code Examples

### Verified: `validateViewStart` helper for page.tsx

```typescript
// Source: verified via node execution — parseISO + isValid + startOfWeek behavior confirmed
import { parseISO, isValid, startOfWeek, format, startOfToday } from "date-fns"

function validateViewStart(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const parsed = parseISO(raw)
  if (!isValid(parsed)) return undefined
  // Snap to Monday of that week
  const monday = startOfWeek(parsed, { weekStartsOn: 1 })
  return format(monday, "yyyy-MM-dd")
}
```

Returns `undefined` when invalid — `getWindowBounds(undefined)` falls back to default (current week Monday).

### Verified: router.replace with URLSearchParams

```typescript
// Source: Context7 / vercel/next.js useSearchParams docs
const params = new URLSearchParams(searchParams.toString())
params.set("viewStart", "2026-04-28")
router.replace(pathname + "?" + params.toString())

// To clear viewStart:
params.delete("viewStart")
router.replace(pathname)  // or pathname + "?" + params if other params exist
```

### Verified: date-fns startOfWeek Monday-snap

```typescript
// Confirmed via node -e execution in project context
import { startOfWeek, parseISO } from "date-fns"
startOfWeek(parseISO("2026-05-06"), { weekStartsOn: 1 })
// → Date: 2026-05-04 (Monday — Wednesday input snapped back to Monday)
```

### Verified: shadcn base-nova PopoverTrigger pattern

```tsx
// Source: Context7 / shadcn-ui/ui docs (base variant) + existing dialog.tsx in project
<PopoverTrigger render={<Button variant="outline" size="sm" className="font-semibold" />}>
  <CalendarIcon className="mr-1 h-3.5 w-3.5" />
  Valitse päivä
</PopoverTrigger>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `searchParams` synchronous object in page props | `searchParams: Promise<{...}>` — must `await` | Next.js 15.0 | All page components reading `searchParams` must be async |
| Radix UI `asChild` prop | Base UI `render` prop | shadcn base-nova preset (Dec 2025) | Trigger composition pattern differs from most documentation online |
| `react-day-picker` v7/v8 `locale` from `date-fns` | `react-day-picker` v9 locale from `react-day-picker/locale` | react-day-picker v9 | Locale import path changed; must use `react-day-picker/locale` not `date-fns/locale` for Calendar component |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `fi` locale from `react-day-picker/locale` correctly sets Monday as first day of week | Code Examples / Pattern 6 | Calendar shows Sunday-first grid; would need manual `weekStartsOn` override on DayPicker |
| A2 | `ScheduleTable`'s existing mount auto-scroll is sufficient after `Tänään` clears viewStart; no additional scroll needed in toolbar | Common Pitfalls / Pattern 4 note | Today row may not scroll into view; may need to add a scroll call after navigation settles |

**A1 rationale:** Finnish locale inherently starts weeks on Monday per ISO 8601 / EU standard. The react-day-picker `fi` locale encodes this. [ASSUMED based on locale knowledge, not directly verified against react-day-picker source]

**A2 rationale:** `ScheduleTable` has a `useEffect` with no dependency array that scrolls to `[data-today="true"]` on mount. When `router.replace` causes a full RSC re-render, the component remounts. [ASSUMED — the remount behavior depends on whether React preserves the component instance across RSC navigation. If it does not remount, the auto-scroll will not re-fire and a manual scroll will be needed in `ViewToolbar`.]

---

## Open Questions (RESOLVED)

1. **Does `ScheduleTable` remount on RSC re-navigation, triggering its auto-scroll?**
   - What we know: The auto-scroll `useEffect` runs on mount with no deps array.
   - What's unclear: Whether `router.replace` causes a full component remount or a props-only update (React key behavior across RSC boundaries).
   - Recommendation: Implement without manual scroll first. If `Tänään` fails to scroll to today in testing, add a `useEffect` in `ViewToolbar` that watches `initialViewStart` prop change and fires scroll.
   - **RESOLVED:** Implement without manual scroll first. Human checkpoint in Plan 05-04 (step 4) explicitly verifies Tänään behavior end-to-end. If auto-scroll fails at that checkpoint, add a `useEffect` in `ViewToolbar` watching `initialViewStart` changes before marking checkpoint complete.

2. **Supabase Realtime — does the subscription survive RSC re-navigation?**
   - What we know: `RealtimeProvider` is a Client Component inside `ScheduleWithRealtime`. RSC re-render replaces server data but client components may or may not remount.
   - What's unclear: Whether the Supabase subscription is torn down and re-established on each `router.replace`.
   - Recommendation: No action in this phase. Realtime is a v1.0 feature that worked; if there are subscription issues after Phase 5 changes, they are a regression to investigate separately.
   - **RESOLVED:** Deferred — no action in Phase 5. If realtime subscription issues emerge after Phase 5 changes, investigate as a regression separately from this phase.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 5 is a code/UI change only. No new external services, databases, CLIs, or runtimes are introduced. `npx shadcn@canary` runs at install time (developer machine); it does not require a running service. All runtime dependencies (Next.js, date-fns, @base-ui/react) are already installed.

---

## Validation Architecture

Step 4: SKIPPED — `workflow.nyquist_validation` is explicitly `false` in `.planning/config.json`.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No changes to auth flow |
| V3 Session Management | no | URL param is not session state |
| V4 Access Control | no | Dashboard auth guard unchanged |
| V5 Input Validation | **yes** | `parseISO + isValid` in Server Component validates `viewStart` before use |
| V6 Cryptography | no | No crypto operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| URL param injection (SQL/XSS via `viewStart`) | Tampering | `parseISO + isValid` rejects non-ISO strings server-side; Drizzle parameterized queries prevent SQL injection even if validation bypassed |
| Extremely far-past date causing large DB scan | Denial of Service | No limit per D-10 — acceptable for a 2-user app; DB query is bounded by date range parameters |
| `viewStart` containing a future date | Spoofing | Acceptable — no hard future limit; schedule for future dates may be sparse but is valid |

**Security summary:** The only input surface is `searchParams.viewStart`. Validate in the Server Component with `parseISO + isValid` and fall back to default on invalid input. Drizzle's parameterized queries protect against SQL injection regardless.

---

## Sources

### Primary (HIGH confidence)
- Context7 `/vercel/next.js` — searchParams Promise pattern, router.replace + URLSearchParams pattern, loading.tsx
- Context7 `/shadcn-ui/ui` — base-nova Popover `render` prop, Calendar locale prop, install commands
- Direct codebase read — `generate-default.ts`, `queries.ts`, `dashboard/page.tsx`, `dashboard-shell.tsx`, `schedule-table.tsx`, `today-button.tsx`, `types.ts`, `dialog.tsx`, `package.json`, `globals.css`
- Node execution in project context — `startOfWeek` Monday-snap verified, `parseISO + isValid` validation verified

### Secondary (MEDIUM confidence)
- Context7 `/date-fns/date-fns` — `startOfWeek` with `weekStartsOn` option docs

### Tertiary (LOW confidence)
- A1: `fi` locale from `react-day-picker/locale` sets Monday-first — assumed from Finnish locale conventions, not directly verified against react-day-picker source
- A2: `ScheduleTable` mount auto-scroll re-fires after RSC re-navigation — assumed from React component lifecycle reasoning, not empirically tested

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified via npm view or node_modules inspection
- Architecture: HIGH — patterns verified against Context7 Next.js docs and existing codebase
- Pitfalls: HIGH — most derived from verified code reading; A2 is the only assumption
- Security: HIGH — straightforward input validation with existing Drizzle parameterized query protection

**Research date:** 2026-05-04
**Valid until:** 2026-06-04 (stable stack — Next.js and shadcn APIs stable)
