# Phase 17: Schedule Table Structure - Pattern Map

**Mapped:** 2026-05-21
**Files analyzed:** 1 primary (schedule-table.tsx) + 2 context reads (types.ts, dashboard-shell.tsx)
**Analogs found:** 1 / 1 (primary file is modified, not created; no analog needed)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/schedule/schedule-table.tsx` | component | event-driven / request-response | self (modify existing) | exact — the file itself is the analog |
| `src/lib/schedule/types.ts` | model | — | self (read-only reference) | no changes |
| `src/components/schedule/dashboard-shell.tsx` | component | event-driven | self (read-only reference) | no changes |

## Pattern Assignments

### `src/components/schedule/schedule-table.tsx` (component, event-driven)

This is the only file to modify. All patterns come from within the file or from closely related files in the same directory.

---

#### Change 1 — Remove desktop scroll container (D-06)

**Location in file:** line 254

**Current pattern:**
```tsx
<div className="sm:overflow-y-auto sm:h-[calc(100svh-8rem)]">
```

**Target pattern (remove the sm: classes):**
```tsx
<div>
```

The two `sm:` classes (`sm:overflow-y-auto sm:h-[calc(100svh-8rem)]`) are the only things to remove. The `<div>` wrapper itself stays; stripping these two classes switches desktop from a fixed-height inner scroll container to full-page scroll. Mobile (below `sm`) was already full-page scroll because these classes were inactive at that breakpoint — no mobile change.

---

#### Change 2 — Auto-scroll: block "center" → "start" + scroll-margin-top (D-07)

**Location in file:** lines 85-90 (useEffect) and lines 285-288 (today `<tr>`)

**Current auto-scroll useEffect (lines 85-90):**
```tsx
useEffect(() => {
  const todayRow = document.querySelector('[data-today="true"]')
  if (todayRow) {
    todayRow.scrollIntoView({ behavior: "instant", block: "center" })
  }
}, [])
```

**Target pattern:**
```tsx
useEffect(() => {
  const todayRow = document.querySelector('[data-today="true"]')
  if (todayRow) {
    todayRow.scrollIntoView({ behavior: "instant", block: "start" })
  }
}, [])
```

Change `block: "center"` to `block: "start"` so today appears at the top of the viewport rather than centered.

**Current today `<tr>` (lines 285-288):**
```tsx
<tr
  data-date={day.date}
  data-today={day.isToday ? "true" : undefined}
  className={day.isToday ? "bg-yellow-50 dark:bg-yellow-950/20" : undefined}
>
```

**Target pattern — add scroll-margin-top to offset the sticky thead:**
```tsx
<tr
  data-date={day.date}
  data-today={day.isToday ? "true" : undefined}
  className={day.isToday ? "bg-yellow-50 dark:bg-yellow-950/20 scroll-mt-10" : "scroll-mt-10"}
>
```

`scroll-mt-10` (= 2.5rem = 40px) offsets the sticky `<thead>` height so today's row is not obscured when `scrollIntoView` runs. The exact value should match the thead's rendered height; `scroll-mt-10` is a starting estimate — adjust to `scroll-mt-8` or `scroll-mt-12` during implementation if needed.

---

#### Change 3 — Replace hairline separator row with "Viikko X" label row (D-01 through D-05)

**Current separator row (lines 277-284):**
```tsx
{day.isWeekStart && index > 0 && (
  <tr>
    <td
      colSpan={colCount}
      className="h-px bg-border"
    />
  </tr>
)}
```

**Target pattern:**
```tsx
{day.isWeekStart && (
  <tr>
    <td
      colSpan={colCount}
      className="px-3 pt-3 pb-1 text-xs text-muted-foreground"
    >
      Viikko {getISOWeek(new Date(day.date))}
    </td>
  </tr>
)}
```

Key changes:
- Remove `index > 0` guard — the label appears for every week including the first (D-04)
- Replace `h-px bg-border` with `px-3 pt-3 pb-1 text-xs text-muted-foreground` — label row, not hairline (D-01, D-03)
- `colSpan={colCount}` stays — the same formula `childNames.length + 3` already in the file (D-02)
- `getISOWeek(new Date(day.date))` provides the ISO week number (D-05)

**Required import addition (top of file, line 4-5 area):**
```tsx
import { getISOWeek } from "date-fns"
```

**Existing date-fns import pattern from `src/lib/schedule/generate-default.ts` (line 1) and `src/lib/schedule/queries.ts` (line 4):**
```tsx
import { addDays, differenceInCalendarWeeks, startOfToday, startOfWeek, format, parseISO } from "date-fns"
import { format, addDays, isToday as isTodayFn } from "date-fns"
```

Pattern: named imports from `"date-fns"` (not from `"date-fns/getISOWeek"` subpath). Add `getISOWeek` to the same named-import style.

---

## Shared Patterns

### text-muted-foreground (secondary label style)
**Source:** `src/components/schedule/schedule-table.tsx` line 311
**Apply to:** week label `<td>`
```tsx
className="... text-muted-foreground"
```
Used for the empty cell "—" button and the notes column header — consistent secondary text style throughout the table.

### colSpan={colCount} full-width row
**Source:** `src/components/schedule/schedule-table.tsx` lines 279, 344
**Apply to:** week label `<td>`
```tsx
<td colSpan={colCount} ...>
```
`colCount` is computed at line 251: `const colCount = childNames.length + 3`. The mobile notes row and the existing separator both use the same pattern.

### data-today / isToday conditional className
**Source:** `src/components/schedule/schedule-table.tsx` lines 285-288, 291-292
**Apply to:** updated today `<tr>` with `scroll-mt-*`
```tsx
className={day.isToday ? "bg-yellow-50 dark:bg-yellow-950/20" : undefined}
```
When adding `scroll-mt-10`, preserve the existing conditional logic — merge both class strings rather than replacing.

---

## No Analog Found

None. This phase modifies a single existing component using patterns already established within that component and its sibling files.

---

## Dashboard Shell Verification

`src/components/schedule/dashboard-shell.tsx` line 60:
```tsx
<div className="min-h-screen flex flex-col">
```

No `overflow-hidden` on the shell wrapper — confirmed safe for full-page scroll and sticky `<thead>`. The `<main>` at line 67 uses `flex-1 p-4` with no overflow constraint. Sticky thead at `top-0` will behave correctly once the inner `overflow-y-auto` container is removed from `schedule-table.tsx`.

---

## Metadata

**Analog search scope:** `src/components/schedule/`, `src/lib/schedule/`
**Files scanned:** 3 (schedule-table.tsx, types.ts, dashboard-shell.tsx) + date-fns import grep across 14 files
**Pattern extraction date:** 2026-05-21
