# Phase 5: View Window Control - Pattern Map

**Mapped:** 2026-05-04
**Files analyzed:** 7 (5 modified, 1 new, 1 deleted)
**Analogs found:** 6 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/schedule/generate-default.ts` | utility | transform | self (refactor) | exact |
| `src/lib/schedule/queries.ts` | service | CRUD | self (refactor) | exact |
| `src/app/dashboard/page.tsx` | component (Server Component) | request-response | self (refactor) | exact |
| `src/app/dashboard/loading.tsx` | component | request-response | none in project | no analog |
| `src/components/schedule/view-toolbar.tsx` | component (Client) | event-driven | `src/components/schedule/today-button.tsx` + `src/components/schedule/publish-button.tsx` | role-match |
| `src/components/schedule/dashboard-shell.tsx` | component (Client) | request-response | self (refactor) | exact |
| `src/components/schedule/schedule-table.tsx` | component (Client) | event-driven | self (refactor) | exact |
| `src/components/schedule/today-button.tsx` | ~~component~~ | — | — | DELETED — logic moves to view-toolbar.tsx |

---

## Pattern Assignments

### `src/lib/schedule/generate-default.ts` (utility, transform)

**Analog:** self — refactor existing `getWindowBounds()`

**Current implementation** (`src/lib/schedule/generate-default.ts` lines 1–46, full file):
```typescript
import { addDays, differenceInCalendarWeeks, startOfToday, startOfWeek, format } from "date-fns"
import config from "@/config/app"
import type { ParentId } from "./types"

export function getWindowBounds(): { start: Date; end: Date } {
  const today = startOfToday()
  const start = startOfWeek(today, { weekStartsOn: 1 }) // Monday
  const end = addDays(start, 12 * 7 - 1) // 84 days, inclusive
  return { start, end }
}
```

**Imports pattern** — add `parseISO` to existing import (line 1):
```typescript
import { addDays, differenceInCalendarWeeks, startOfToday, startOfWeek, format, parseISO } from "date-fns"
```

**Core pattern — refactored signature** (replace lines 41–46):
```typescript
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

**Note:** `generateDefaultEntries` is unchanged. Only `getWindowBounds` signature changes. No other imports needed.

---

### `src/lib/schedule/queries.ts` (service, CRUD)

**Analog:** self — refactor existing `getScheduleWindow()`

**Current function signature** (line 10):
```typescript
export async function getScheduleWindow(): Promise<DateWindow>
```

**Imports pattern** — `parseISO` is not yet imported; `getWindowBounds` is already imported (line 7):
```typescript
import { generateDefaultEntries, getWindowBounds } from "./generate-default"
```

**Core pattern — refactored signature** (replace line 10–11):
```typescript
export async function getScheduleWindow(startDate?: string): Promise<DateWindow> {
  const { start, end } = getWindowBounds(startDate)
```

**All other logic unchanged.** The `84` hardcoded loop count on line 61 remains correct — window size is always 84 days regardless of start.

---

### `src/app/dashboard/page.tsx` (Server Component, request-response)

**Analog:** self — refactor to accept `searchParams` Promise

**Current implementation** (`src/app/dashboard/page.tsx` lines 1–9, full file):
```typescript
import { getScheduleWindow } from "@/lib/schedule/queries"
import { DashboardShell } from "@/components/schedule/dashboard-shell"
import Header from "@/components/layout/header"

export default async function Dashboard() {
  const schedule = await getScheduleWindow()
  return <DashboardShell initialData={schedule} header={<Header />} />
}
```

**Imports pattern** — add `date-fns` imports for validation helper:
```typescript
import { parseISO, isValid, startOfWeek, format } from "date-fns"
import { getScheduleWindow } from "@/lib/schedule/queries"
import { DashboardShell } from "@/components/schedule/dashboard-shell"
import Header from "@/components/layout/header"
```

**Core pattern — full refactored file:**
```typescript
import { parseISO, isValid, startOfWeek, format } from "date-fns"
import { getScheduleWindow } from "@/lib/schedule/queries"
import { DashboardShell } from "@/components/schedule/dashboard-shell"
import Header from "@/components/layout/header"

function validateViewStart(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const parsed = parseISO(raw)
  if (!isValid(parsed)) return undefined
  // Snap to Monday of that week
  const monday = startOfWeek(parsed, { weekStartsOn: 1 })
  return format(monday, "yyyy-MM-dd")
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ viewStart?: string }>
}) {
  const { viewStart } = await searchParams
  const validatedStart = validateViewStart(viewStart)
  const schedule = await getScheduleWindow(validatedStart)

  return (
    <DashboardShell
      initialData={schedule}
      initialViewStart={validatedStart}
      header={<Header />}
    />
  )
}
```

**CRITICAL:** `searchParams` is a `Promise` in Next.js 15+/16 — must `await` before accessing `.viewStart`. Synchronous access returns `undefined` even when param is present.

---

### `src/app/dashboard/loading.tsx` (component, request-response)

**Analog:** none in project — this is the first `loading.tsx` in the codebase.

**Pattern from RESEARCH.md** — Next.js co-located `loading.tsx` is auto-wrapped in Suspense by the framework. No imports needed. Match the layout structure of `dashboard-shell.tsx` (`src/components/schedule/dashboard-shell.tsx` lines 29–39) for visual continuity:

```typescript
export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Preserve header height — matches DashboardShell layout */}
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

---

### `src/components/schedule/view-toolbar.tsx` (Client Component, event-driven)

**Analogs:**
- `src/components/schedule/today-button.tsx` — scroll-to-today logic to move here
- `src/components/schedule/publish-button.tsx` — Client Component pattern: `"use client"`, `useRouter` navigation, `Button` usage, `DialogTrigger render={<Button />}` pattern

**Imports pattern** (copy from `today-button.tsx` lines 1–3 and `publish-button.tsx` lines 1–5, extend with navigation hooks):
```typescript
"use client"

import { useCallback } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { parseISO, startOfWeek, subDays, format } from "date-fns"
import { fi } from "react-day-picker/locale"
import { CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
```

**NOTE on locale import:** `fi` for `<Calendar>` must come from `"react-day-picker/locale"`, NOT `"date-fns/locale"`. The two packages use different locale object shapes.

**"use client" directive pattern** (copy from `today-button.tsx` line 1 and `publish-button.tsx` line 1):
```typescript
"use client"
```

**Core pattern — URL navigation** (copy URL update logic from RESEARCH.md Pattern 2):
```typescript
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
```

**Prev week handler** (RESEARCH.md Pattern 4):
```typescript
  function handlePrevWeek() {
    const currentStart = parseISO(
      initialViewStart ?? format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd")
    )
    const prevMonday = startOfWeek(subDays(currentStart, 7), { weekStartsOn: 1 })
    navigateTo(format(prevMonday, "yyyy-MM-dd"))
  }
```

**Tänään handler** — only clears URL; `ScheduleTable`'s mount `useEffect` (line 83–88 of `schedule-table.tsx`) handles scroll automatically after RSC re-render:
```typescript
  function handleToday() {
    navigateTo(null) // clears viewStart — page re-renders with default (Mon of current week)
    // DO NOT add scrollIntoView here — ScheduleTable's mount effect handles it
  }
```

**DatePicker trigger pattern** (from `publish-button.tsx` line 116 — base-nova `render` prop, NOT Radix `asChild`):
```tsx
// Confirmed pattern from dialog.tsx line 65-70 and publish-button.tsx line 116:
<DialogTrigger render={<Button variant="default" size="sm" />}>
```
Apply same pattern to PopoverTrigger:
```tsx
<PopoverTrigger render={<Button variant="outline" size="sm" className="font-semibold" />}>
  <CalendarIcon className="mr-1 h-3.5 w-3.5" />
  Valitse päivä
</PopoverTrigger>
```

**CRITICAL:** Do NOT use `asChild` — this project uses the base-nova preset (`@base-ui/react`). The `render` prop is the correct composition API here. Using `asChild` will break silently.

**Date select handler** (snap to Monday):
```typescript
  function handleDateSelect(date: Date | undefined) {
    if (!date) return
    const monday = startOfWeek(date, { weekStartsOn: 1 })
    navigateTo(format(monday, "yyyy-MM-dd"))
  }
```

**JSX structure** (matches publish-bar row styling from `dashboard-shell.tsx` line 32–34):
```tsx
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b">
      <Button variant="outline" size="sm" onClick={handlePrevWeek}>
        ‹ Edellinen viikko
      </Button>
      <Popover>
        <PopoverTrigger render={<Button variant="outline" size="sm" className="font-semibold" />}>
          <CalendarIcon className="mr-1 h-3.5 w-3.5" />
          Valitse päivä
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            selected={initialViewStart ? parseISO(initialViewStart) : undefined}
            onSelect={handleDateSelect}
            locale={fi}
          />
        </PopoverContent>
      </Popover>
      <Button variant="default" size="sm" onClick={handleToday}>
        Tänään
      </Button>
    </div>
  )
```

---

### `src/components/schedule/dashboard-shell.tsx` (Client Component, request-response)

**Analog:** self — add `ViewToolbar` between header and publish bar

**Current interface** (`dashboard-shell.tsx` lines 8–11):
```typescript
interface DashboardShellProps {
  initialData: DateWindow
  header: React.ReactNode
}
```

**Refactored interface** — add `initialViewStart` prop:
```typescript
interface DashboardShellProps {
  initialData: DateWindow
  initialViewStart?: string
  header: React.ReactNode
}
```

**Import addition:**
```typescript
import { ViewToolbar } from "./view-toolbar"
```

**Core pattern — insert ViewToolbar** (modify `dashboard-shell.tsx` lines 29–39, add toolbar after `{header}`):
```tsx
return (
  <div className="min-h-screen flex flex-col">
    {header}
    <ViewToolbar initialViewStart={initialViewStart} />  {/* NEW */}
    <div className="flex items-center justify-end px-4 py-2 border-b">
      <PublishButton days={days} onPublished={handlePublished} />
    </div>
    <main className="flex-1 p-4">
      <ScheduleWithRealtime initialData={initialData} onDaysChange={setDays} publishRef={publishRef} />
    </main>
  </div>
)
```

---

### `src/components/schedule/schedule-table.tsx` (Client Component, event-driven)

**Analog:** self — remove `TodayButton` import and render

**Lines to remove:**

Import (line 9):
```typescript
import { TodayButton } from "./today-button"
```

Variable (lines 141–142):
```typescript
// Find today's date for the TodayButton
const todayDate = days.find((d) => d.isToday)?.date ?? ""
```

Render (line 214):
```tsx
{todayDate && <TodayButton todayDate={todayDate} />}
```

**Auto-scroll `useEffect` stays** — do not remove lines 83–88:
```typescript
useEffect(() => {
  const todayRow = document.querySelector('[data-today="true"]')
  if (todayRow) {
    todayRow.scrollIntoView({ behavior: "instant", block: "center" })
  }
}, [])
```

This effect is what the `Tänään` toolbar button relies on for scroll (via RSC re-mount). Removing it would break `Tänään` behavior.

---

## Shared Patterns

### "use client" directive
**Source:** `src/components/schedule/today-button.tsx` line 1, `src/components/schedule/publish-button.tsx` line 1, `src/components/schedule/dashboard-shell.tsx` line 1
**Apply to:** `view-toolbar.tsx` (new Client Component)
```typescript
"use client"
```
Must be the very first line — no imports before it.

### Button usage (base-nova pattern)
**Source:** `src/components/ui/button.tsx`, `src/components/schedule/publish-button.tsx` lines 107–112, 116
**Apply to:** `view-toolbar.tsx`
```typescript
import { Button } from "@/components/ui/button"
// Usage:
<Button variant="outline" size="sm">Label</Button>
<Button variant="default" size="sm">Label</Button>
```
Available variants: `default`, `outline`, `secondary`, `ghost`, `destructive`, `link`.
Available sizes: `default` (h-8), `sm` (h-7), `xs` (h-6), `lg` (h-9), `icon`, `icon-sm`, `icon-xs`, `icon-lg`.

### Base-nova render prop (NOT asChild)
**Source:** `src/components/ui/dialog.tsx` lines 63–70, `src/components/schedule/publish-button.tsx` line 116
**Apply to:** `view-toolbar.tsx` — `PopoverTrigger`
```tsx
// CORRECT (base-nova / @base-ui/react):
<DialogTrigger render={<Button variant="default" size="sm" />}>
  Label
</DialogTrigger>

// WRONG (Radix UI pattern — do NOT use):
<DialogTrigger asChild>
  <Button variant="default" size="sm">Label</Button>
</DialogTrigger>
```

### date-fns with weekStartsOn: 1
**Source:** `src/lib/schedule/generate-default.ts` lines 25, 43; `src/lib/schedule/queries.ts` line 81
**Apply to:** `generate-default.ts` (refactor), `page.tsx` (validateViewStart), `view-toolbar.tsx` (handlers)
```typescript
import { startOfWeek } from "date-fns"
startOfWeek(date, { weekStartsOn: 1 }) // Always pass weekStartsOn: 1 for Finnish Monday-first
```
Omitting `{ weekStartsOn: 1 }` defaults to Sunday — wrong for this application.

### Border-b row layout (publish bar pattern)
**Source:** `src/components/schedule/dashboard-shell.tsx` line 32
**Apply to:** `view-toolbar.tsx` outer `<div>`, `loading.tsx` placeholder rows
```tsx
<div className="flex items-center justify-end px-4 py-2 border-b">
```
Toolbar uses `gap-2` and `justify-start` (or no explicit justify) instead of `justify-end`.

### Path aliases
**Source:** `src/lib/schedule/queries.ts` lines 1–8, `src/components/schedule/publish-button.tsx` lines 1–17
**Apply to:** all new/modified files
```typescript
import { ... } from "@/lib/..."
import { ... } from "@/components/..."
import { ... } from "@/actions/..."
import { ... } from "@/config/..."
```
No relative path traversal (e.g., `../../`) — always use `@/` alias.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/app/dashboard/loading.tsx` | component | request-response | No `loading.tsx` files exist anywhere in the project; use RESEARCH.md Pattern 9 |
| `src/components/ui/popover.tsx` | UI primitive | event-driven | Does not exist yet — install via `npx shadcn@canary add popover` |
| `src/components/ui/calendar.tsx` | UI primitive | event-driven | Does not exist yet — install via `npx shadcn@canary add calendar` |

---

## Metadata

**Analog search scope:** `src/lib/schedule/`, `src/components/schedule/`, `src/components/ui/`, `src/app/dashboard/`
**Files read:** 10 source files
**Pattern extraction date:** 2026-05-04
