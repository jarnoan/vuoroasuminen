---
phase: 05-view-window-control
verified: 2026-05-05T05:10:27Z
status: human_needed
score: 8/8 must-haves verified
overrides_applied: 0
re_verification: null
gaps: []
human_verification:
  - test: "Default view starts from Monday of current week"
    expected: "Visiting /dashboard with no ?viewStart param shows a schedule beginning on Monday of the week containing 2026-05-04 (i.e. 2026-04-28). All three toolbar buttons are visible."
    why_human: "Requires a running browser session; server-side date logic is verified in code but the rendered output must be confirmed visually."
  - test: "Floating Tänään button is gone"
    expected: "Scroll to bottom of page. The fixed bottom-right Tänään button must NOT appear anywhere."
    why_human: "today-button.tsx is confirmed deleted from the filesystem, but visual confirmation that no remnant render path re-introduces it is needed."
  - test: "Prev week navigation updates the URL and re-renders schedule"
    expected: "Clicking '< Prev week' changes the URL to ?viewStart=YYYY-MM-DD (prior Monday). The schedule re-renders starting one week earlier. Clicking again moves back another week."
    why_human: "router.replace wiring is code-verified but the full Next.js URL-change -> RSC re-render cycle requires a browser."
  - test: "Tänään reset clears viewStart and scrolls to today"
    expected: "After navigating to a past week, clicking Tänään removes the viewStart param from the URL (/dashboard), returns the schedule to current week, and auto-scrolls to today's row (highlighted)."
    why_human: "The Tänään -> navigateTo(null) -> RSC re-render -> ScheduleTable mount useEffect scroll chain requires a running browser to confirm end-to-end."
  - test: "Date picker opens popover and snaps selection to Monday"
    expected: "Clicking 'Valitse päivä' opens the Calendar popover. Selecting any day navigates to ?viewStart=YYYY-MM-DD where YYYY-MM-DD is the Monday of the selected week."
    why_human: "Popover open/close behaviour and Calendar onSelect callback require browser interaction."
  - test: "Per-user view independence (VIEW-04)"
    expected: "Opening /dashboard in two separate browser tabs (or incognito), setting different ?viewStart values in each — one tab's URL change does not affect the other tab's displayed schedule."
    why_human: "URL isolation is per-browser-session by design; confirming no shared state leaks requires two concurrent browser sessions."
  - test: "Loading skeleton appears during URL-change re-renders"
    expected: "Throttling DevTools to Slow 3G, then clicking Prev week shows the skeleton layout (three height-matched placeholder rows + animated skeleton rows) instead of a blank screen."
    why_human: "Loading suspension behaviour depends on Next.js Suspense boundary timing; requires DevTools network throttling in a browser."
---

# Phase 5: View Window Control Verification Report

**Phase Goal:** Each parent can navigate the schedule view to any start date using URL params — prev-week button, date picker, and "today" reset — without affecting the other parent's view
**Verified:** 2026-05-05T05:10:27Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | When no viewStart param is present, schedule starts from Monday of current week (VIEW-01) | VERIFIED | `getWindowBounds()` without arg: `startOfWeek(startOfToday(), { weekStartsOn: 1 })`. `validateViewStart(undefined)` returns `undefined`. `getScheduleWindow(undefined)` calls `getWindowBounds(undefined)`. Chain confirmed. |
| 2 | getWindowBounds accepts optional startDate and uses it as window start (VIEW-02, VIEW-03) | VERIFIED | `generate-default.ts` line 43: `export function getWindowBounds(startDate?: string)`. If `startDate` truthy: `start = parseISO(startDate)`. `queries.ts` line 10-11: `getScheduleWindow(startDate?: string)` → `getWindowBounds(startDate)`. |
| 3 | page.tsx reads searchParams as a Promise and validates viewStart (VIEW-04 security) | VERIFIED | `page.tsx` line 15-18: `searchParams: Promise<{ viewStart?: string }>`, `await searchParams`. `validateViewStart` uses `parseISO` + `isValid` + `startOfWeek(parsed, { weekStartsOn: 1 })`. |
| 4 | Invalid or missing viewStart silently falls back to default Monday-of-current-week | VERIFIED | `validateViewStart` returns `undefined` when `raw` is falsy or `!isValid(parsed)`. `getWindowBounds(undefined)` uses `startOfToday()` path. No error thrown. |
| 5 | ViewToolbar renders three buttons and all three actions are wired to router.replace | VERIFIED | `view-toolbar.tsx`: Prev week (`handlePrevWeek` → `navigateTo(date)`), Valitse päivä (Calendar `onSelect` → `handleDateSelect` → `navigateTo(date)`), Tänään (`handleToday` → `navigateTo(null)`). `router.replace` called in both branches of `navigateTo`. |
| 6 | Clicking Prev week computes Monday 7 days before current start | VERIFIED | `handlePrevWeek`: `subDays(currentStart, 7)` then `startOfWeek(..., { weekStartsOn: 1 })`. Falls back to current-week Monday if no `initialViewStart`. |
| 7 | Selecting a date snaps to Monday and calls router.replace | VERIFIED | `handleDateSelect`: `startOfWeek(date, { weekStartsOn: 1 })` then `navigateTo(format(monday, "yyyy-MM-dd"))`. |
| 8 | ViewToolbar is wired into DashboardShell between header and publish bar; prop flows from page.tsx | VERIFIED | `dashboard-shell.tsx` line 6: imports ViewToolbar. Line 11: `initialViewStart?: string` in interface. Line 34: `<ViewToolbar initialViewStart={initialViewStart} />` positioned after `{header}`, before publish bar `<div>`. `page.tsx` line 28: `initialViewStart={validatedStart}`. |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/schedule/generate-default.ts` | `getWindowBounds(startDate?: string)` | VERIFIED | Exists, 54 lines, correct signature, `parseISO` imported, proper conditional branch |
| `src/lib/schedule/queries.ts` | `getScheduleWindow(startDate?: string)` threading startDate to getWindowBounds | VERIFIED | Exists, 91 lines, correct signature line 10, `getWindowBounds(startDate)` line 11, loop still hardcoded to `84` |
| `src/app/dashboard/page.tsx` | Server Component reading searchParams Promise, validateViewStart | VERIFIED | Exists, 32 lines, full implementation including `key={validatedStart ?? "default"}` for remount |
| `src/components/ui/popover.tsx` | Popover, PopoverContent, PopoverTrigger | VERIFIED | Exists, 91 lines, all three exports confirmed, uses `@base-ui/react/popover` |
| `src/components/ui/calendar.tsx` | Calendar backed by react-day-picker | VERIFIED | Exists, 222 lines, exports `Calendar` and `CalendarDayButton`, uses `DayPicker` from `react-day-picker` |
| `src/components/schedule/view-toolbar.tsx` | ViewToolbar Client Component with all three actions | VERIFIED | Exists, 93 lines, `"use client"` first line, all three handlers implemented, correct base-nova render prop |
| `src/app/dashboard/loading.tsx` | Next.js loading skeleton | VERIFIED | Exists, 18 lines, three height-matched placeholders + animate-pulse rows, no imports |
| `src/components/schedule/dashboard-shell.tsx` | DashboardShell with initialViewStart prop and ViewToolbar | VERIFIED | Exists, 43 lines, initialViewStart in interface + destructuring + JSX prop pass, ViewToolbar imported |
| `src/components/schedule/today-button.tsx` | DELETED — legacy floating button removed | VERIFIED | File confirmed absent (`No such file or directory`). No orphaned imports found via grep. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `page.tsx` | `queries.ts` | `getScheduleWindow(validatedStart)` | WIRED | Line 22 in page.tsx confirmed |
| `queries.ts` | `generate-default.ts` | `getWindowBounds(startDate)` | WIRED | Line 11 in queries.ts confirmed |
| `page.tsx` | `dashboard-shell.tsx` | `initialViewStart={validatedStart}` | WIRED | Line 28 in page.tsx; `key={validatedStart ?? "default"}` also present for forced remount |
| `dashboard-shell.tsx` | `view-toolbar.tsx` | `<ViewToolbar initialViewStart={initialViewStart} />` | WIRED | Line 34 in dashboard-shell.tsx confirmed |
| `view-toolbar.tsx` | `next/navigation` | `router.replace` | WIRED | Two `router.replace` calls in `navigateTo` callback (set branch and delete branch) |
| `view-toolbar.tsx` | `src/components/ui/popover.tsx` | `Popover, PopoverContent, PopoverTrigger` | WIRED | Import line 10 in view-toolbar.tsx; all three used in JSX |
| `view-toolbar.tsx` | `src/components/ui/calendar.tsx` | `Calendar` with fi locale | WIRED | Import line 9 in view-toolbar.tsx; `<Calendar mode="single" ... locale={fi} />` in JSX |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `dashboard-shell.tsx` | `initialData.days` | `getScheduleWindow(validatedStart)` in `page.tsx` | Yes — Drizzle DB query (`scheduleEntries` table with `gte`/`lte` date range) | FLOWING |
| `view-toolbar.tsx` | `initialViewStart` | Pre-validated URL param from `page.tsx` `validateViewStart` | Yes — URL param → validated ISO string or undefined | FLOWING |
| `view-toolbar.tsx` | `selectedDate` | `parseISO(initialViewStart)` | Real data from URL param, not hardcoded | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED for browser-rendered components. TypeScript compilation verified instead.

| Check | Command | Result | Status |
|-------|---------|--------|--------|
| TypeScript compiles clean | `npx tsc --noEmit` | Exit 0, no output | PASS |
| `getWindowBounds` accepts optional startDate | Signature check in file | `export function getWindowBounds(startDate?: string)` | PASS |
| `getScheduleWindow` accepts optional startDate | Signature check in file | `export async function getScheduleWindow(startDate?: string)` | PASS |
| `validateViewStart` present in page.tsx | grep | `function validateViewStart(` found | PASS |
| `today-button.tsx` deleted | `ls` check | `No such file or directory` | PASS |
| No orphaned TodayButton imports | `grep -r "today-button"` | No output (exit 1) | PASS |
| `scrollIntoView` auto-scroll preserved | grep | `todayRow.scrollIntoView({ behavior: "instant", block: "center" })` found | PASS |
| `react-day-picker` in package.json | grep | `"react-day-picker": "^9.14.0"` | PASS |
| `fi` locale from correct source | grep | `import { fi } from "react-day-picker/locale"` | PASS |
| `render={}` pattern (base-nova) used | grep | `render={<Button variant="outline" size="sm" className="font-semibold" />}` | PASS |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| VIEW-01 | 05-01, 05-04 | View window starts from Monday of current week by default | SATISFIED | `getWindowBounds(undefined)` → `startOfWeek(startOfToday(), { weekStartsOn: 1 })`. Default path verified end-to-end. |
| VIEW-02 | 05-01, 05-03, 05-04 | User can click "Show previous week" to extend view one week back; repeatable | SATISFIED | `handlePrevWeek` computes `subDays(currentStart, 7)` then snaps to Monday; calls `router.replace` with new `?viewStart`; repeatable via fresh `initialViewStart` on each re-render |
| VIEW-03 | 05-01, 05-02, 05-03, 05-04 | User can set explicit start date via date picker | SATISFIED | Calendar component installed; `handleDateSelect` → snap to Monday → `router.replace`. Full wiring confirmed. |
| VIEW-04 | 05-01, 05-03, 05-04 | View window preferences are per-user; one parent's changes do not affect the other | SATISFIED (code) | URL param is per-browser-session; no server-side per-user state stored; `validateViewStart` runs server-side per request. Each parent's browser holds its own URL. Requires human confirmation. |

All four VIEW requirements are addressed in code. VIEW-04 requires human confirmation of runtime isolation (see Human Verification Required section).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app/dashboard/loading.tsx` | 4, 6, 8 | Comment text contains "placeholder" | Info | Loading.tsx IS the skeleton — these comments document intent, not a stub. No code path returns empty data; file is intentionally layout-only. |

No blockers or warnings. The "placeholder" comments in `loading.tsx` are informational documentation within a skeleton file — this is correct use of the pattern, not a stub anti-pattern.

### Human Verification Required

#### 1. Default view starts from Monday of current week

**Test:** Visit `http://localhost:3000/dashboard` with no query params
**Expected:** Schedule begins on 2026-04-28 (Monday of the week containing today, 2026-05-04). Toolbar shows all three buttons.
**Why human:** Server-side date computation is code-verified; rendered output requires a browser session.

#### 2. Floating Tänään button is gone

**Test:** Log in, scroll to bottom of the dashboard page
**Expected:** No fixed bottom-right "Tänään" button is present anywhere on the page
**Why human:** `today-button.tsx` is confirmed deleted and no imports remain, but visual confirmation that no legacy CSS or alternate render path re-introduces it is needed.

#### 3. Prev week navigation (VIEW-02)

**Test:** Click "‹ Prev week" on the toolbar
**Expected:** URL changes to `?viewStart=2026-04-20` (previous Monday). Schedule re-renders starting one week earlier. Click again → `?viewStart=2026-04-13`.
**Why human:** `router.replace` call is code-verified; the full Next.js URL-change → RSC re-render cycle requires a browser.

#### 4. Tänään reset clears viewStart and scrolls (D-08)

**Test:** Navigate to a past week (e.g. `?viewStart=2026-04-13`), then click "Tänään"
**Expected:** URL returns to `/dashboard` (no viewStart param). Schedule shows current week. Page auto-scrolls to today's highlighted row.
**Why human:** The `navigateTo(null)` → URL clear → RSC re-render → ScheduleTable mount → `scrollIntoView` chain requires a running browser to confirm end-to-end.

#### 5. Date picker opens and snaps to Monday (VIEW-03)

**Test:** Click "Valitse päivä", select a Wednesday in any past week
**Expected:** Popover opens showing a Finnish-locale calendar. After selection, URL updates to `?viewStart=YYYY-MM-DD` where YYYY-MM-DD is the Monday of that week (not Wednesday).
**Why human:** Popover open/close and Calendar `onSelect` callback require browser interaction.

#### 6. Per-user view independence (VIEW-04)

**Test:** Open `/dashboard` in two tabs (or incognito). Set `?viewStart=2026-04-20` in tab A. Observe tab B.
**Expected:** Tab B remains at its current view. No shared state between tabs.
**Why human:** URL isolation is per-browser-session by design; confirming no shared state leaks requires two concurrent browser sessions.

#### 7. Loading skeleton during URL-change re-renders

**Test:** In Chrome DevTools, throttle network to "Slow 3G". Click "‹ Prev week".
**Expected:** During the RSC re-render, the skeleton layout (three height-matched rows + animated skeleton rows) appears instead of a blank screen.
**Why human:** Next.js Suspense boundary timing requires DevTools network throttling in a browser.

### Gaps Summary

No code gaps found. All 8 must-haves are verified in the codebase. All four VIEW requirements are satisfied in implementation. The 7 human verification items above are required to confirm runtime behaviour — particularly VIEW-04 (per-user isolation) and the URL → RSC re-render → scroll chain.

---

_Verified: 2026-05-05T05:10:27Z_
_Verifier: Claude (gsd-verifier)_
