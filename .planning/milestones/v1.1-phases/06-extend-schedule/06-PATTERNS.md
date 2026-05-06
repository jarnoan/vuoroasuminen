# Phase 6: Extend Schedule - Pattern Map

**Mapped:** 2026-05-05
**Files analyzed:** 4 (2 new, 2 modified)
**Analogs found:** 4 / 4

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/components/schedule/extend-panel.tsx` | component | request-response | `src/components/schedule/publish-button.tsx` | exact |
| `src/actions/schedule.ts` (add `extendSchedule`) | service/action | CRUD | `src/actions/schedule.ts` (existing actions) | exact |
| `src/components/schedule/dashboard-shell.tsx` | component | request-response | itself — add `ExtendPanel` below `ScheduleWithRealtime` | self-modify |
| `src/lib/schedule/queries.ts` | utility | CRUD | itself — read only for batch-insert shape reference | read-only |

---

## Pattern Assignments

### `src/components/schedule/extend-panel.tsx` (component, request-response)

**Analog:** `src/components/schedule/publish-button.tsx` — closest match: Client Component with pending state, calls Server Action, uses Button + Dialog confirm/cancel pattern. Adapt for inline panel instead of dialog.

**Imports pattern** (`src/components/schedule/publish-button.tsx` lines 1-18):
```typescript
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { publishSchedule, syncCalendars } from "@/actions/schedule"
import type { ScheduleDay } from "@/lib/schedule/types"
import { format, parseISO } from "date-fns"
```

For `extend-panel.tsx` adapt to:
```typescript
"use client"

import { useState, useCallback } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { addWeeks, endOfWeek, format, parseISO } from "date-fns"
import { fi } from "react-day-picker/locale"
import { CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { extendSchedule } from "@/actions/schedule"
```

**fi locale import** — `src/components/schedule/view-toolbar.tsx` line 6:
```typescript
import { fi } from "react-day-picker/locale"
```
Note: `fi` comes from `react-day-picker/locale`, NOT from `date-fns/locale`. Both exist in the project; `view-toolbar.tsx` uses the `react-day-picker` locale for Calendar component, while `queries.ts` uses `date-fns/locale` for `format()` calls. For the Calendar component, use `react-day-picker/locale`. For `format()` date label, use `date-fns/locale`.

**router.replace() pattern** (`src/components/schedule/view-toolbar.tsx` lines 20-33):
```typescript
const router = useRouter()
const pathname = usePathname()
const searchParams = useSearchParams()

const navigateTo = useCallback(
  (dateStr: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (dateStr) {
      params.set("viewStart", dateStr)
      router.replace(pathname + "?" + params.toString())
    } else {
      params.delete("viewStart")
      router.replace(pathname + (params.size > 0 ? "?" + params.toString() : ""))
    }
  },
  [router, pathname, searchParams],
)
```

Copy this `navigateTo` helper verbatim into `extend-panel.tsx`. After a successful `extendSchedule` action, call `navigateTo(newStartStr)` where `newStartStr` is the ISO date of the first new week's Monday (returned from the Server Action).

**Popover + Calendar pattern** (`src/components/schedule/view-toolbar.tsx` lines 67-83):
```typescript
<Popover>
  <PopoverTrigger
    render={<Button variant="outline" size="sm" className="font-semibold" />}
  >
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
Note: `PopoverTrigger` uses the `render` prop pattern (base-ui style), not `asChild`. The `PopoverContent` in `src/components/ui/popover.tsx` uses `@base-ui/react/popover` under the hood — use `PopoverContent` without `className="w-auto p-0"` for default sizing, or keep it for a compact picker.

**Pending state / disabled button pattern** (`src/components/schedule/publish-button.tsx` lines 49-51, 73-102):
```typescript
const [phase, setPhase] = useState<"idle" | "publishing" | "syncing">("idle")

async function handlePublish() {
  setPhase("publishing")
  try {
    const publishResult = await publishSchedule()
    // ...
  } catch {
    toast.error("Julkaisu epäonnistui. Yritä uudelleen.")
  } finally {
    setPhase("idle")
  }
}

// In JSX:
<Button onClick={handlePublish} disabled={phase !== "idle"}>
  {phase === "publishing" ? "Julkaistaan..." : "Vahvista"}
</Button>
<DialogClose render={<Button variant="outline" disabled={phase === "publishing"} />}>
  Peruuta
</DialogClose>
```
For `extend-panel.tsx`, use a simpler boolean `isPending` state instead of a phase enum, since there is only one async step.

**Inline panel open/close toggle pattern** — no existing inline expand panel in the codebase (all confirm flows use Dialog). Use local boolean state:
```typescript
const [isOpen, setIsOpen] = useState(false)

// Trigger button:
<Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
  + Lisää viikkoja
</Button>

// Inline panel (conditional render):
{isOpen && (
  <div className="border rounded-lg p-4 mt-2 bg-muted/30">
    {/* panel content */}
  </div>
)}
```

**Date preview label format** (`src/lib/schedule/queries.ts` line 79):
```typescript
dayLabel: format(current, "EEEEEE d.M.", { locale: fi }),
```
For the range preview (`Ajanjakso: ma 9.6. – su 31.8.`), use:
```typescript
import { fi } from "date-fns/locale"
// ...
const startLabel = format(newStart, "EEEEEE d.M.", { locale: fi })
const endLabel   = format(newEnd,   "EEEEEE d.M.", { locale: fi })
```
`fi` here is `date-fns/locale`, used only in `format()` calls — not passed to the Calendar component.

**End-of-week snap for date picker** — per D-07, picked date must snap to Sunday:
```typescript
import { endOfWeek } from "date-fns"
// weekStartsOn: 1 means Sunday is day 0 (end of week)
const snappedEnd = endOfWeek(pickedDate, { weekStartsOn: 1 })
```

**Props interface** — receives current schedule end date from `DashboardShell`:
```typescript
interface ExtendPanelProps {
  scheduleEndDate: string  // ISO date — day after this = first new day
}
```

---

### `src/actions/schedule.ts` — add `extendSchedule` action (service, CRUD)

**Analog:** existing actions in `src/actions/schedule.ts` — same file, same patterns.

**Auth guard pattern** (`src/actions/schedule.ts` lines 15-23):
```typescript
async function requireAuthorizedParent() {
  const session = await auth()
  const email = session?.user?.email
  if (!email) throw new Error("Not authenticated")
  const isAuthorized = config.parents.some((p) => p.email === email)
  if (!isAuthorized) throw new Error("Forbidden")
  return { session, email }
}
```
Call `await requireAuthorizedParent()` at the top of `extendSchedule`, exactly as all other actions do.

**Batch insert with onConflictDoNothing** (`src/lib/schedule/queries.ts` lines 29-44):
```typescript
// Create a schedule record
const [schedule] = await db.insert(schedules).values({}).returning()
const defaults = generateDefaultEntries(start, end, config.children)

// Map child names to IDs
const childNameToId = new Map(orderedChildren.map(c => [c.name, c.id]))

const insertValues = defaults.map(d => ({
  scheduleId: schedule.id,
  childId: childNameToId.get(d.childName)!,
  day: d.day,
  parentId: d.parentId,
  status: "draft" as const,
}))

await db.insert(scheduleEntries).values(insertValues).onConflictDoNothing()
```
`extendSchedule` must create a new `schedules` row (same as seeding), build `insertValues` in the same shape, and call `.onConflictDoNothing()`. The unique index on `(childId, day)` (`schedule_entries_child_day_unique` in schema line 37) is what makes `onConflictDoNothing` safe for overlapping ranges.

**DB imports needed** (`src/actions/schedule.ts` lines 1-11):
```typescript
"use server"

import { db } from "@/db"
import { scheduleEntries, schedules, children } from "@/db/schema/domain"
import { and, eq, gte, lte } from "drizzle-orm"
import { auth } from "@/auth"
import config from "@/config/app"
import { generateDefaultEntries } from "@/lib/schedule/generate-default"
import { addDays, addWeeks, endOfWeek, format, parseISO, startOfWeek } from "date-fns"
```
`children` is needed to build the `childNameToId` map (same as `queries.ts` lines 15-18).

**Return type pattern** — follow `publishSchedule` style (`src/actions/schedule.ts` lines 52-54):
```typescript
export async function extendSchedule(input: {
  scheduleEndDate: string   // current end date (ISO)
  weeks?: number            // if week-count mode
  endDate?: string          // if date-picker mode (already snapped to Sunday)
}): Promise<
  | { success: true; newStartDate: string }
  | { success: false; error: string }
>
```
`newStartDate` is the ISO Monday of the first newly added week — the client uses it for `router.replace()`.

**Server-side new range computation:**
```typescript
const rangeStart = addDays(parseISO(input.scheduleEndDate), 1)  // day after current end
let rangeEnd: Date
if (input.endDate) {
  rangeEnd = parseISO(input.endDate)  // already Sunday-snapped by client
} else {
  const weeks = input.weeks ?? 12
  rangeEnd = endOfWeek(addWeeks(rangeStart, weeks) , { weekStartsOn: 1 })
}
```

---

### `src/components/schedule/dashboard-shell.tsx` (modification)

**Analog:** itself — add `<ExtendPanel>` below `<ScheduleWithRealtime>` inside `<main>`.

**Current `main` block** (`src/components/schedule/dashboard-shell.tsx` lines 38-40):
```typescript
<main className="flex-1 p-4">
  <ScheduleWithRealtime initialData={initialData} onDaysChange={setDays} publishRef={publishRef} />
</main>
```

**Modified `main` block** — add `ExtendPanel` after `ScheduleWithRealtime`, pass `endDate` from `initialData`:
```typescript
<main className="flex-1 p-4">
  <ScheduleWithRealtime initialData={initialData} onDaysChange={setDays} publishRef={publishRef} />
  <ExtendPanel scheduleEndDate={initialData.endDate} />
</main>
```

**Import to add** at the top of `dashboard-shell.tsx`:
```typescript
import { ExtendPanel } from "./extend-panel"
```

`initialData.endDate` is already available on the `DateWindow` type (`src/lib/schedule/types.ts` line 26): `endDate: string`.

---

## Shared Patterns

### Auth Guard
**Source:** `src/actions/schedule.ts` lines 15-23
**Apply to:** `extendSchedule` Server Action
```typescript
async function requireAuthorizedParent() {
  const session = await auth()
  const email = session?.user?.email
  if (!email) throw new Error("Not authenticated")
  const isAuthorized = config.parents.some((p) => p.email === email)
  if (!isAuthorized) throw new Error("Forbidden")
  return { session, email }
}
```

### Pending / Disabled Button
**Source:** `src/components/schedule/publish-button.tsx` lines 136-141
**Apply to:** `ExtendPanel` "Vahvista" button
```typescript
<Button onClick={handleExtend} disabled={isPending}>
  {isPending ? "Lisätään..." : "Vahvista"}
</Button>
<Button variant="outline" onClick={() => setIsOpen(false)} disabled={isPending}>
  Peruuta
</Button>
```

### date-fns fi locale for format()
**Source:** `src/lib/schedule/queries.ts` line 5
**Apply to:** Date preview label in `ExtendPanel`
```typescript
import { fi } from "date-fns/locale"
// used as: format(date, "EEEEEE d.M.", { locale: fi })
```

### react-day-picker fi locale for Calendar
**Source:** `src/components/schedule/view-toolbar.tsx` line 6
**Apply to:** `<Calendar locale={fi} />` in `ExtendPanel` date-picker mode
```typescript
import { fi } from "react-day-picker/locale"
// used as: <Calendar mode="single" locale={fi} ... />
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| (none) | — | — | All files have close analogs |

The inline expand panel (show/hide toggle without a Dialog) has no exact analog — `publish-button.tsx` uses Dialog. Use simple `useState(false)` open/close with a conditional render block.

---

## Metadata

**Analog search scope:** `src/actions/`, `src/components/schedule/`, `src/components/ui/`, `src/lib/schedule/`
**Files scanned:** 12
**Pattern extraction date:** 2026-05-05
