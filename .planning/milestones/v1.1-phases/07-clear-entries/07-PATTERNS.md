# Phase 7: Clear Entries - Pattern Map

**Mapped:** 2026-05-06
**Files analyzed:** 9
**Analogs found:** 9 / 9

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/db/schema/domain.ts` | model | CRUD | `src/db/schema/domain.ts` (self) | exact — column constraint change only |
| `src/lib/schedule/types.ts` | model | transform | `src/lib/schedule/types.ts` (self) | exact — type widening |
| `src/actions/schedule.ts` | service | request-response | `src/actions/schedule.ts` (self, `toggleCell` + `extendSchedule`) | exact |
| `src/components/schedule/schedule-cell.tsx` | component | request-response | `src/components/schedule/schedule-cell.tsx` (self) | exact — prop extension |
| `src/components/schedule/schedule-table.tsx` | component | request-response | `src/components/schedule/schedule-table.tsx` (self, `handleToggle`) | exact |
| `src/components/schedule/clear-panel.tsx` (new) | component | request-response | `src/components/schedule/extend-panel.tsx` | exact — same inline panel pattern |
| `src/components/schedule/dashboard-shell.tsx` | component | request-response | `src/components/schedule/dashboard-shell.tsx` (self) | exact — add sibling panel |
| `src/components/ui/popover.tsx` + `calendar.tsx` | utility | — | Already used in `extend-panel.tsx` | reuse only — no changes needed |
| `src/lib/gcal/sync.ts` | service | CRUD | `src/lib/gcal/sync.ts` (self, `syncParentCalendar` orphan-cleanup path) | exact — extend existing orphan logic |

---

## Pattern Assignments

### `src/db/schema/domain.ts` (model — column constraint change)

**Analog:** self

**Current pattern** (lines 34):
```typescript
parentId: text("parent_id").notNull(), // 'father' | 'mother' (from config)
```

**Change:** Drop `.notNull()` to allow NULL for cleared entries:
```typescript
parentId: text("parent_id"),  // null = cleared / unassigned
```

Drizzle Kit will generate the required `ALTER TABLE schedule_entries ALTER COLUMN parent_id DROP NOT NULL` migration. No other columns change.

---

### `src/lib/schedule/types.ts` (model — type widening)

**Analog:** self

**Current `ScheduleCell` definition** (lines 5-11):
```typescript
export interface ScheduleCell {
  entryId: string | null      // null = no DB row yet
  childId: string
  childName: string
  parentId: ParentId
  status: "draft" | "published"
}
```

**Change:** `parentId` must accept `null` for the cleared-but-row-exists state. `entryId` is already nullable (no-row case). The cleared state has a row with `parentId = null`.

```typescript
export interface ScheduleCell {
  entryId: string | null      // null = no DB row yet
  childId: string
  childName: string
  parentId: ParentId | null   // null = cleared (row exists, no parent assigned)
  status: "draft" | "published"
}
```

`ParentId` is defined in `src/config/app.ts` (line 1) as `"father" | "mother"`. The widened union `ParentId | null` is the only change needed here.

---

### `src/actions/schedule.ts` (service — two new Server Actions)

**Analog:** `toggleCell` (lines 25-39) for single-entry mutation; `extendSchedule` (lines 98-178) for date-range validation and batch DB write.

**Auth guard pattern** (lines 16-23) — copy verbatim into both new actions:
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

**`clearCell` — follow `toggleCell` pattern** (lines 25-39):
```typescript
export async function clearCell(entryId: string): Promise<{ success: true } | { success: false; error: string }> {
  await requireAuthorizedParent()
  if (!entryId) return { success: false, error: "Missing entryId" }

  await db.update(scheduleEntries)
    .set({ parentId: null, status: "draft" })
    .where(eq(scheduleEntries.id, entryId))

  return { success: true }
}
```

Key difference from `toggleCell`: sets `parentId: null` (not a new ParentId value). Sets `status: "draft"` so the cleared state gets swept up by the next publish → GCal cleanup cycle.

**`clearRange` — follow `extendSchedule` validation + batch pattern** (lines 98-178):
```typescript
export async function clearRange(input: {
  startDate: string  // ISO YYYY-MM-DD (inclusive)
  endDate: string    // ISO YYYY-MM-DD (inclusive)
}): Promise<{ success: true; clearedCount: number } | { success: false; error: string }> {
  await requireAuthorizedParent()

  const start = parseISO(input.startDate)
  const end   = parseISO(input.endDate)

  if (!isValid(start) || !isValid(end)) {
    return { success: false, error: "Virheellinen päivämäärä" }
  }
  const daysDelta = differenceInCalendarDays(end, start)
  if (daysDelta < 0) {
    return { success: false, error: "Päättymispäivän on oltava alkamispäivän jälkeen" }
  }
  if (daysDelta > 730) {
    return { success: false, error: "Aikaväli on liian pitkä (max 2 vuotta)" }
  }

  const result = await db.update(scheduleEntries)
    .set({ parentId: null, status: "draft" })
    .where(
      and(
        gte(scheduleEntries.day, input.startDate),
        lte(scheduleEntries.day, input.endDate),
      )
    )
    .returning({ id: scheduleEntries.id })

  return { success: true, clearedCount: result.length }
}
```

Note: imports already in the file cover `parseISO`, `isValid`, `differenceInCalendarDays`, `and`, `gte`, `lte`, `eq` from `drizzle-orm` and `date-fns` — no new imports required beyond those already present.

---

### `src/components/schedule/schedule-cell.tsx` (component — prop extension)

**Analog:** self (lines 1-45)

**Current props interface** (lines 6-12):
```typescript
interface ScheduleCellProps {
  entryId: string
  parentId: ParentId
  status: "draft" | "published"
  childName: string
  onToggle: (entryId: string, newParentId: ParentId) => void
}
```

**New props interface** — add `onClear` callback; widen `parentId` to match updated types:
```typescript
interface ScheduleCellProps {
  entryId: string
  parentId: ParentId | null
  status: "draft" | "published"
  childName: string
  onToggle: (entryId: string, newParentId: ParentId) => void
  onClear: (entryId: string) => void
}
```

**Hover × button pattern** — add as a sibling element inside the outer `<button>` wrapper, shown via Tailwind group hover. Keep the existing `colorMap` and `onClick` for toggle:
```typescript
// Wrap in a relative container to position the × absolutely
<div className="relative group w-full h-full">
  <button
    type="button"
    className={`w-full h-full min-h-[40px] rounded-md font-medium text-sm transition-colors ${colorClass}`}
    onClick={() => onToggle(entryId, newParentId)}
    title={`${displayName} (${status}) — klikkaa vaihtaaksesi`}
  >
    {displayName}
  </button>
  <button
    type="button"
    className="absolute top-0.5 right-0.5 hidden group-hover:flex group-focus-within:flex
               h-4 w-4 items-center justify-center rounded text-xs leading-none
               bg-black/20 hover:bg-black/40 text-white"
    onClick={(e) => { e.stopPropagation(); onClear(entryId) }}
    title="Tyhjennä"
    aria-label="Tyhjennä solun merkintä"
  >
    ×
  </button>
</div>
```

`colorClass` lookup must guard for `parentId === null` (cleared cells are rendered as the plain `—` span in `schedule-table.tsx` — `ScheduleCell` is only rendered when `cell.entryId` is present AND `cell.parentId` is non-null; see table logic below).

---

### `src/components/schedule/schedule-table.tsx` (component — add handlers + update cell render)

**Analog:** self

**`handleToggle` pattern to copy for `handleClear`** (lines 94-120):
```typescript
async function handleToggle(entryId: string, newParentId: ParentId) {
  // Optimistic update
  setDays((prev) =>
    prev.map((day) => ({
      ...day,
      cells: day.cells.map((cell) =>
        cell.entryId === entryId ? { ...cell, parentId: newParentId } : cell
      ),
    }))
  )
  try {
    await toggleCell(entryId, newParentId)
  } catch {
    // Revert on failure
    const revertParentId: ParentId = newParentId === "father" ? "mother" : "father"
    setDays((prev) => ...)
    toast.error("Tallennus epäonnistui. Yritä uudelleen.")
  }
}
```

**`handleClear`** — same optimistic pattern, set `parentId: null`:
```typescript
async function handleClear(entryId: string) {
  // Optimistic: null out parentId
  setDays((prev) =>
    prev.map((day) => ({
      ...day,
      cells: day.cells.map((cell) =>
        cell.entryId === entryId ? { ...cell, parentId: null } : cell
      ),
    }))
  )
  try {
    await clearCell(entryId)
  } catch {
    // Revert: need to restore prior parentId — capture it before optimistic update
    toast.error("Tyhjennys epäonnistui. Yritä uudelleen.")
    // Re-fetch or revert; simplest: call onDaysChange to re-sync from server
  }
}
```

**`handleAssignEmpty`** — for clicking a `—` cell (D-05: assigns to father first):
```typescript
async function handleAssignEmpty(childId: string, day: string) {
  // Optimistic: set to father (first default)
  setDays((prev) =>
    prev.map((d) =>
      d.date !== day ? d : {
        ...d,
        cells: d.cells.map((cell) =>
          cell.childId !== childId ? cell :
            { ...cell, parentId: "father" as ParentId, status: "draft" as const }
        ),
      }
    )
  )
  try {
    // Re-use toggleCell (which sets parentId + status:'draft') — but we need an entryId.
    // If the cell has entryId (cleared-row case), call toggleCell(entryId, "father").
    // If no entryId (truly empty), a new Server Action assignEmpty is needed.
  } catch {
    toast.error("Tallennus epäonnistui. Yritä uudelleen.")
  }
}
```

**Cell render block update** (lines 183-194) — currently:
```typescript
{cell.entryId ? (
  <ScheduleCell
    entryId={cell.entryId}
    parentId={cell.parentId}
    status={cell.status}
    childName={cell.childName}
    onToggle={handleToggle}
  />
) : (
  <span className="text-xs text-muted-foreground px-2">—</span>
)}
```

**Updated render** — three cases: assigned cell, cleared cell (has entryId, parentId null), no-row cell:
```typescript
{cell.entryId && cell.parentId ? (
  <ScheduleCell
    entryId={cell.entryId}
    parentId={cell.parentId}
    status={cell.status}
    childName={cell.childName}
    onToggle={handleToggle}
    onClear={handleClear}
  />
) : (
  <button
    type="button"
    className="w-full h-full min-h-[40px] rounded-md text-xs text-muted-foreground hover:bg-muted transition-colors"
    onClick={() => handleAssignEmpty(cell.childId, day.date, cell.entryId ?? null)}
    title="Ei merkitty — klikkaa lisätäksesi"
  >
    —
  </button>
)}
```

---

### `src/components/schedule/clear-panel.tsx` (new component — inline expand panel)

**Analog:** `src/components/schedule/extend-panel.tsx` (lines 1-231) — copy entire structure.

**Imports pattern** (lines 1-12 of extend-panel.tsx):
```typescript
"use client"

import { useCallback, useMemo, useState } from "react"
import { format, parseISO, differenceInCalendarDays, eachDayOfInterval } from "date-fns"
import { fi as fiFormat } from "date-fns/locale"
import { fi as fiPicker } from "react-day-picker/locale"
import { CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { clearRange } from "@/actions/schedule"
```

Key differences from `ExtendPanel`:
- No `mode` state (no weeks/date toggle) — always two date pickers (start + end)
- No `useRouter` / navigation after confirm (D-09: view stays in current position)
- Props: none required (unlike `ExtendPanel` which takes `scheduleEndDate`)
- Preview label: `"Tyhjennetään: N päivää (M lasta)"` using `differenceInCalendarDays` + `config.children.length`
- Trigger button label: `"× Tyhjennä päiväväli"`
- Confirm button pending label: `"Tyhjennetään..."`

**Collapsed trigger** (follows lines 105-118 of extend-panel.tsx):
```typescript
if (!isOpen) {
  return (
    <div className="px-4 pb-4">
      <Button variant="outline" size="sm" className="font-semibold" onClick={() => setIsOpen(true)}>
        × Tyhjennä päiväväli
      </Button>
    </div>
  )
}
```

**State shape**:
```typescript
const [isOpen, setIsOpen]       = useState(false)
const [pickedStart, setPickedStart] = useState<Date | undefined>(undefined)
const [pickedEnd, setPickedEnd]   = useState<Date | undefined>(undefined)
const [isPending, setIsPending]   = useState(false)
const [errorMsg, setErrorMsg]     = useState<string | null>(null)
```

**Preview label** (useMemo):
```typescript
const previewLabel = useMemo(() => {
  if (!pickedStart || !pickedEnd) return null
  const days = differenceInCalendarDays(pickedEnd, pickedStart) + 1
  if (days <= 0) return null
  const childCount = config.children.length
  const startLabel = format(pickedStart, "EEEEEE d.M.", { locale: fiFormat })
  const endLabel   = format(pickedEnd,   "EEEEEE d.M.yyyy", { locale: fiFormat })
  return `Tyhjennetään: ${days} päivää (${childCount} lasta) — ${startLabel}–${endLabel}`
}, [pickedStart, pickedEnd])
```

**Confirm handler** (follows `handleConfirm` in extend-panel.tsx lines 71-97):
```typescript
async function handleConfirm() {
  if (!pickedStart || !pickedEnd) return
  setIsPending(true)
  setErrorMsg(null)
  try {
    const result = await clearRange({
      startDate: format(pickedStart, "yyyy-MM-dd"),
      endDate:   format(pickedEnd,   "yyyy-MM-dd"),
    })
    if (!result.success) {
      setErrorMsg(result.error)
      return
    }
    // D-09: no navigation — just close the panel
    resetPanel()
  } catch {
    setErrorMsg("Tyhjentäminen epäonnistui. Yritä uudelleen.")
  } finally {
    setIsPending(false)
  }
}
```

**Popover/Calendar pattern for each date picker** — follows lines 158-179 of extend-panel.tsx:
```typescript
<Popover>
  <PopoverTrigger render={<Button variant="outline" size="sm" disabled={isPending} />}>
    <CalendarIcon className="mr-1 h-3.5 w-3.5" />
    {pickedStart ? format(pickedStart, "EEEEEE d.M.yyyy", { locale: fiFormat }) : "Valitse päivä"}
  </PopoverTrigger>
  <PopoverContent className="w-auto p-0">
    <Calendar
      mode="single"
      selected={pickedStart}
      onSelect={(d) => { if (!d) return; setPickedStart(d) }}
      locale={fiPicker}
    />
  </PopoverContent>
</Popover>
```

Note: `PopoverTrigger` uses `render` prop (base-ui pattern), not `asChild`. Copy exactly from extend-panel.tsx line 162.

---

### `src/components/schedule/dashboard-shell.tsx` (component — add ClearPanel)

**Analog:** self (lines 1-46)

**Current `main` block** (lines 41-44):
```typescript
<main className="flex-1 p-4">
  <ScheduleWithRealtime initialData={initialData} onDaysChange={setDays} publishRef={publishRef} />
  <ExtendPanel scheduleEndDate={scheduleEndDate} />
</main>
```

**Updated `main` block** — add `<ClearPanel>` immediately after `<ExtendPanel>`:
```typescript
import { ClearPanel } from "./clear-panel"

// in JSX:
<main className="flex-1 p-4">
  <ScheduleWithRealtime initialData={initialData} onDaysChange={setDays} publishRef={publishRef} />
  <ExtendPanel scheduleEndDate={scheduleEndDate} />
  <ClearPanel />
</main>
```

`ClearPanel` takes no props (it manages its own date state). `DashboardShellProps` interface does not change.

---

### `src/lib/gcal/sync.ts` (service — handle null-parentId entries)

**Analog:** self, specifically the orphan-cleanup section in `syncParentCalendar` (lines 154-195).

**Current `PublishedEntry` type** (lines 139-144):
```typescript
type PublishedEntry = {
  id: string
  day: string
  parentId: string
  childId: string
}
```

**Change:** widen `parentId` to allow null:
```typescript
type PublishedEntry = {
  id: string
  day: string
  parentId: string | null   // null = cleared entry
  childId: string
}
```

**Current orphan detection** (lines 170-175):
```typescript
const orphans = existingGcalRows.filter(row => {
  if (row.calendarId !== parent.calendarId) return false
  const entry = publishedEntries.find(e => e.id === row.scheduleEntryId)
  if (!entry) return false // entry not in window — leave alone
  return entry.parentId !== parent.id
})
```

Cleared entries (`parentId = null`) will naturally satisfy `entry.parentId !== parent.id` — they will be included in `orphans` for all parents. This means the existing orphan-cleanup code deletes GCal events for cleared entries automatically with only the type change above.

**Query change in `syncCalendarsAfterPublish`** (lines 76-85) — the WHERE clause currently filters `eq(scheduleEntries.status, "published")`. Cleared entries have `status: "draft"` after clearing (set by `clearCell`/`clearRange`). This means cleared entries are NOT included in `publishedEntries` and their GCal events will be treated as orphans on the next publish. No query change needed — the draft status triggers cleanup naturally via publish flow.

If the decision is made that cleared entries should be cleaned up at publish time regardless of whether they were published before, one additional approach: include entries where `parentId IS NULL AND status = 'published'` in the published entries query, so their gcal_events rows are included in orphan detection. The orphan check `entry.parentId !== parent.id` handles the rest since `null !== "father"` and `null !== "mother"`.

**Concrete query addition** (after line 84 `lte(scheduleEntries.day, endStr)`):
```typescript
// Also fetch cleared (parentId=null) published entries so their GCal events get deleted
// These entries show up in existingGcalRows and are swept as orphans by the parent loop
.where(
  and(
    eq(scheduleEntries.status, "published"),  // existing
    gte(scheduleEntries.day, startStr),
    lte(scheduleEntries.day, endStr),
  )
)
// After result: filter or let null-parentId entries fall through orphan cleanup
```

The simplest correct implementation: no query change; rely on the existing orphan path (cleared entries have `status: "draft"` so they are not in the published query; their pre-existing gcal_events rows become orphans at publish time since the parent filter `entry.parentId !== parent.id` evaluates `null !== parent.id` as true).

---

## Shared Patterns

### Auth Guard
**Source:** `src/actions/schedule.ts` lines 16-23
**Apply to:** `clearCell`, `clearRange` (both new Server Actions)
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

### Server Action Return Shape
**Source:** `src/actions/schedule.ts` lines 98-103 (`extendSchedule` signature)
**Apply to:** `clearCell`, `clearRange`
```typescript
Promise<
  | { success: true; ... }
  | { success: false; error: string }
>
```
Caller checks `result.success` before proceeding; sets `errorMsg` on failure. Same pattern as `extendSchedule` lines 84-88 in extend-panel.tsx.

### Optimistic Update + Toast Error
**Source:** `src/components/schedule/schedule-table.tsx` lines 94-120 (`handleToggle`)
**Apply to:** `handleClear`, `handleAssignEmpty` in `schedule-table.tsx`
Pattern: `setDays(optimistic)` → `await action()` → `catch { revert setDays + toast.error(...) }`

### Inline Panel (Collapsed → Expanded)
**Source:** `src/components/schedule/extend-panel.tsx` lines 104-231
**Apply to:** `src/components/schedule/clear-panel.tsx` (new file)
Pattern: `isOpen` boolean state; collapsed = single `<Button>` render; expanded = `<div className="border rounded-lg p-3 bg-muted/30 ...">` container with inputs, preview, Vahvista/Peruuta buttons, and `errorMsg` alert.

### Popover + Calendar Date Picker
**Source:** `src/components/schedule/extend-panel.tsx` lines 157-180
**Apply to:** Both date pickers in `clear-panel.tsx`
Note: `PopoverTrigger` uses `render={<Button ... />}` prop (base-ui pattern from `popover.tsx` line 12). This is NOT the `asChild` prop — do not substitute.

### Finnish Date Formatting
**Source:** `src/components/schedule/extend-panel.tsx` lines 6-7
**Apply to:** `clear-panel.tsx` preview label
```typescript
import { fi as fiFormat } from "date-fns/locale"
import { fi as fiPicker } from "react-day-picker/locale"
// Usage: format(date, "EEEEEE d.M.yyyy", { locale: fiFormat })
// Calendar locale: <Calendar locale={fiPicker} />
```

---

## No Analog Found

All files have direct analogs in the codebase. No files require fallback to RESEARCH.md patterns.

---

## Metadata

**Analog search scope:** `src/actions/`, `src/components/schedule/`, `src/components/ui/`, `src/db/schema/`, `src/lib/schedule/`, `src/lib/gcal/`
**Files scanned:** 12 source files read in full
**Pattern extraction date:** 2026-05-06
