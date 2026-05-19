---
phase: 15-header-clear-guard-and-toolbar
reviewed: 2026-05-19T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/components/layout/header.tsx
  - src/components/schedule/schedule-cell.tsx
  - src/components/schedule/view-toolbar.tsx
  - src/components/schedule/clear-panel.tsx
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 15: Code Review Report

**Reviewed:** 2026-05-19T00:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Four components were reviewed: the page header (Server Component), the schedule cell with long-press clear guard (Client Component), the view navigation toolbar (Client Component), and the date-range clear panel (Client Component).

The code is generally well-structured and follows project conventions. No critical security or data-loss issues were found. Three warnings cover a prop that is declared but never read (dead interface surface), a date arithmetic edge case in the toolbar's "prev week" calculation that can silently navigate to an unexpected week, and a logical gap that allows the clear panel's "Confirm" button to be clickable when end date precedes start date. Three info items cover minor code quality concerns.

---

## Warnings

### WR-01: `childName` prop declared in `ScheduleCellProps` but never consumed

**File:** `src/components/schedule/schedule-cell.tsx:11`

**Issue:** `childName` is declared in the `ScheduleCellProps` interface and destructured at the call site (`schedule-table.tsx:268`) but it is not destructured inside `ScheduleCell` and is never read. The component uses `displayName` (derived from `parents.find(...)`) everywhere. The prop is dead surface — it inflates the interface, confuses readers into thinking the component uses the child's name directly, and any future refactor may incorrectly rely on it being meaningful.

**Fix:** Remove `childName` from the interface and from the call site:

```tsx
// schedule-cell.tsx — remove line 11
// childName: string   ← delete

// schedule-table.tsx:268 — remove the prop
// childName={cell.childName}  ← delete
```

---

### WR-02: `handlePrevWeek` in `ViewToolbar` uses a stale/default date when `initialViewStart` is absent

**File:** `src/components/view-toolbar.tsx:36-41`

**Issue:** When `initialViewStart` is not provided, the fallback computes `startOfWeek(new Date(), ...)` at click time, not at render time. This is intentional — but there is a subtler problem: `handlePrevWeek` is a plain function (not `useCallback`), so it re-closes over the latest `initialViewStart` prop on every render. However, the real issue is that when the user is already viewing the current week and clicks "Prev Week", the function computes the current week's Monday from `new Date()` and then subtracts 7 days from it — which is correct in most cases. But `parseISO` is called on the result of `format(startOfWeek(new Date(), ...))` round-tripped through a string, which introduces an unnecessary double-conversion and the `format`+`parseISO` round-trip produces a `Date` in local midnight, while `new Date()` is already a `Date`. More importantly: if the component receives `initialViewStart` on first render but the prop becomes `undefined` after a Today navigation, the very next "Prev Week" click will compute "previous week from today" instead of "previous week from where the user was," causing a potentially confusing jump. The prop name `initialViewStart` signals it is only the initial value, which means the component has no stable way to track current position without URL state — this is architecturally intentional, but the silent stale-fallback is a usability hazard.

**Fix:** Guard the fallback explicitly and document the expected behavior:

```tsx
function handlePrevWeek() {
  // viewStart is always present in the URL when the user has navigated away from today.
  // If absent, the user is at "today" view — prev week is the Monday 7 days before today.
  const base = initialViewStart
    ? parseISO(initialViewStart)
    : startOfWeek(new Date(), { weekStartsOn: 1 })
  const prevMonday = subDays(startOfWeek(base, { weekStartsOn: 1 }), 7)
  navigateTo(format(prevMonday, "yyyy-MM-dd"))
}
```

The current code applies `startOfWeek` after `subDays`, which re-snaps to Monday even if `base` is already a Monday — so the result is correct. But this can be simplified to `subDays(base, 7)` when `base` is already a Monday (which it always is when coming from a URL param). Either form works; document the invariant.

---

### WR-03: `ClearPanel` "Confirm" button guard uses `previewLabel` as a proxy for date validity, allowing end-before-start through calendar pickers

**File:** `src/components/schedule/clear-panel.tsx:182`

**Issue:** The Confirm button is disabled when `!previewLabel`. `previewLabel` returns `null` when `days <= 0` (line 32), which catches the case where `pickedEnd` is before `pickedStart`. However, the server action `clearRange` also rejects this (line 218-220 of `schedule.ts`), so there is no data-integrity gap. The issue is a UX problem: a user can select `pickedStart = 2026-06-10` and `pickedEnd = 2026-06-09` using the calendar popover, and the form will show no preview label and a disabled Confirm button, but will also show no error explaining why the button is disabled. The user is left confused. For the native `<input type="date">` on mobile the same situation can arise.

**Fix:** Add a visible validation message when both dates are set but the range is invalid:

```tsx
const rangeIsInvalid =
  pickedStart != null &&
  pickedEnd != null &&
  differenceInCalendarDays(pickedEnd, pickedStart) < 0

// In JSX, after the end-date row:
{rangeIsInvalid && (
  <p className="text-sm text-destructive" role="alert">
    Päättymispäivän on oltava alkamispäivän jälkeen tai sama päivä.
  </p>
)}
```

---

## Info

### IN-01: `Header` renders `null` for unauthenticated users — caller has no indication

**File:** `src/components/layout/header.tsx:13`

**Issue:** The component silently returns `null` when the user is not authenticated. This is a valid Server Component pattern, but the layout that renders `<Header>` will silently produce an empty header with no visual feedback. If this component is ever used in a context where the user might briefly be unauthenticated (e.g., during token refresh), the header disappears silently. The behavior should at minimum be documented with a comment.

**Fix:** Add a brief comment explaining the intended behavior:

```tsx
// Not authenticated — return null; the layout's middleware redirects
// unauthenticated users before this component renders in production.
if (!user) return null
```

---

### IN-02: `avatarUrl` external domain not listed in `next.config` — Image component will error at runtime if domain changes

**File:** `src/components/layout/header.tsx:26-31`

**Issue:** `next/image` requires external hostname patterns to be listed in `next.config.js` under `images.remotePatterns`. Google avatar URLs typically come from `lh3.googleusercontent.com`. If this domain is not configured, the Image component will throw at runtime on first render for any user with an avatar. This is not a code bug in the component itself, but the component assumes the config is correct with no fallback if the URL is rejected.

**Fix:** Verify `next.config.js` contains:

```js
images: {
  remotePatterns: [
    { protocol: "https", hostname: "lh3.googleusercontent.com" },
  ],
}
```

If it does, this item can be closed. If it does not, add the pattern or the Image component will throw a runtime error.

---

### IN-03: Magic timeout values in `ScheduleCell` should be named constants

**File:** `src/components/schedule/schedule-cell.tsx:57,60`

**Issue:** The long-press arm delay (1000 ms) and the auto-disarm timeout (2000 ms) are magic numbers inlined in the function body. If these values need to be tuned (e.g., to match accessibility guidelines for long-press thresholds), they must be found and changed in multiple places if the pattern is reused.

**Fix:**

```tsx
const LONG_PRESS_ARM_MS = 1000
const LONG_PRESS_DISARM_MS = 2000

// Then in handleCellPointerDown:
armTimerRef.current = setTimeout(() => {
  setIsArmed(true)
  disarmTimerRef.current = setTimeout(() => {
    setIsArmed(false)
  }, LONG_PRESS_DISARM_MS)
}, LONG_PRESS_ARM_MS)
```

---

_Reviewed: 2026-05-19T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
