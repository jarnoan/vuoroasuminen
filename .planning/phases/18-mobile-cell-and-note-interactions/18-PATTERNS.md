# Phase 18: Mobile Cell and Note Interactions - Pattern Map

**Mapped:** 2026-05-21
**Files analyzed:** 2 modified files
**Analogs found:** 2 / 2 (both files are their own primary analogs — modifications, not new files)

## File Classification

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------|------|-----------|----------------|---------------|
| `src/components/schedule/schedule-cell.tsx` | component | event-driven (pointer events, timers) | itself (extend existing isArmed + timer machinery) | exact — modify in-place |
| `src/components/schedule/schedule-table.tsx` | component | request-response + event-driven | itself (extend existing PlusIcon + note row tr) | exact — modify in-place |

---

## Pattern Assignments

### `src/components/schedule/schedule-cell.tsx` (component, event-driven)

**Analog:** itself — all existing patterns must be preserved and extended.

**Imports pattern** (lines 1–5):
```typescript
"use client"

import { useState, useRef, useEffect } from "react"

import type { ParentId } from "@/lib/schedule/types"
```
No new imports needed. All new behavior is achieved with native browser APIs (`navigator.vibrate`) and Tailwind class composition.

**Existing state/ref pattern** (lines 40–44):
```typescript
const [isArmed, setIsArmed] = useState(false)
const armTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
const disarmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
const startXRef = useRef<number>(0)
const startYRef = useRef<number>(0)
```
Add `isHolding` alongside `isArmed`:
```typescript
const [isHolding, setIsHolding] = useState(false)
```
`isHolding` becomes true on `pointerdown` and false on `pointerup`/`pointercancel`/cancel. It drives the CSS background-color transition class. It is NOT derived from a ref — it must be React state so the class toggle triggers a re-render.

**Existing arm timer pattern** (lines 54–64):
```typescript
function handleCellPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
  startXRef.current = e.clientX
  startYRef.current = e.clientY
  armTimerRef.current = setTimeout(() => {
    setIsArmed(true)
    // Auto-disarm after 2000ms
    disarmTimerRef.current = setTimeout(() => {
      setIsArmed(false)
    }, 2000)
  }, 1000)
}
```
Extend `handleCellPointerDown` to also call `setIsHolding(true)` immediately on pointerdown, before the setTimeout. Add `navigator.vibrate(100)` inside the 1000ms callback, right before or after `setIsArmed(true)`:
```typescript
armTimerRef.current = setTimeout(() => {
  setIsArmed(true)
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(100)
  }
  disarmTimerRef.current = setTimeout(() => {
    setIsArmed(false)
  }, 2000)
}, 1000)
setIsHolding(true)  // ← add this line immediately after setTimeout call
```

**Cancel/cleanup pattern** (lines 66–87):
```typescript
function cancelArm() {
  if (armTimerRef.current !== null) {
    clearTimeout(armTimerRef.current)
    armTimerRef.current = null
  }
}

function handleCellPointerUp() { cancelArm() }
function handleCellPointerCancel() { cancelArm() }
function handleCellPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
  const dx = Math.abs(e.clientX - startXRef.current)
  const dy = Math.abs(e.clientY - startYRef.current)
  if (dx > 8 || dy > 8) { cancelArm() }
}
```
Extend `cancelArm` to also call `setIsHolding(false)`. The snap-back (D-06) is achieved by removing the transition class — no reverse animation — because `isHolding` goes false instantly:
```typescript
function cancelArm() {
  if (armTimerRef.current !== null) {
    clearTimeout(armTimerRef.current)
    armTimerRef.current = null
  }
  setIsHolding(false)  // ← add: snap-back, no transition
}
```

**Existing button render pattern** (lines 89–121):
```tsx
<div className="relative group w-full h-full">
  <button
    type="button"
    className={`w-full h-full min-h-[40px] rounded-md font-medium text-sm transition-colors ${colorClass}`}
    onClick={() => onToggle(entryId, newParentId)}
    ...
    style={{ touchAction: "manipulation" }}
  >
    {displayName}
  </button>
  <button
    type="button"
    className={`absolute top-0.5 right-0.5 h-5 w-5 ... ${isArmed ? "max-sm:opacity-100" : "max-sm:opacity-0"}`}
    onClick={(e) => {
      e.stopPropagation()
      onClear(entryId)
      setIsArmed(false)
      ...
    }}
    aria-label="Tyhjennä"
  >
    ×
  </button>
</div>
```

**New UI-04 render pattern — media query split:**

The corner `×` button uses `max-sm:opacity-0/100` today. Replace this with `@media (hover: none)` logic so iPad-size touch screens are also covered (D-04). In Tailwind v4, the arbitrary variant is `[@media(hover:none)]`.

The two rendering modes:

1. **Hover devices** (`[@media(hover:hover)]`): keep existing corner `×` button — show on `group-hover` or `focus`. No `isHolding`, no full-cell Tyhjennä.
2. **Touch devices** (`[@media(hover:none)]`): when `isArmed` is true, render the entire cell button as a full-cell red Tyhjennä (D-02, D-03). When `isHolding && !isArmed`, add the red-fade transition class to the cell button (D-05).

Concrete className composition for the main cell button:
```tsx
// isHolding drives the transition fade; isArmed drives the armed color
// transition class only applied when isHolding (snap-back: no transition class = instant)
className={[
  "w-full h-full min-h-[40px] rounded-md font-medium text-sm",
  isArmed
    ? "[@media(hover:none)]:bg-red-600 [@media(hover:none)]:text-white"
    : isHolding
      ? `${colorClass} [@media(hover:none)]:[transition:background-color_1s_linear]`
      : `transition-colors ${colorClass}`,
].join(" ")}
```

Conditional onClick for armed full-cell tap (D-03):
```tsx
onClick={
  isArmed
    ? () => {
        onClear(entryId)
        setIsArmed(false)
        setIsHolding(false)
        if (disarmTimerRef.current !== null) {
          clearTimeout(disarmTimerRef.current)
          disarmTimerRef.current = null
        }
      }
    : () => onToggle(entryId, newParentId)
}
```

Conditional cell text — show "Tyhjennä" only when armed (D-07):
```tsx
<span className="[@media(hover:hover)]:hidden">
  {isArmed ? "Tyhjennä" : displayName}
</span>
<span className="[@media(hover:none)]:hidden">{displayName}</span>
```
Alternative (simpler): just use `{isArmed ? "Tyhjennä" : displayName}` inside the button and hide the whole armed-text on hover devices via the outer div approach. Keep it simple — single child: `{isArmed ? "Tyhjennä" : displayName}`.

Corner `×` button — hide on touch devices entirely (touch devices use full-cell armed instead):
```tsx
<button
  className={`[@media(hover:none)]:hidden absolute top-0.5 right-0.5 ... opacity-0 group-hover:opacity-100 focus:opacity-100 focus-visible:opacity-100`}
  ...
>
  ×
</button>
```
The `max-sm:opacity-100` / `max-sm:opacity-0` classes on the `×` button are **removed** — replaced by `[@media(hover:none)]:hidden`.

---

### `src/components/schedule/schedule-table.tsx` (component, event-driven + request-response)

**Analog:** itself — three independent touch points, all small.

**UI-03: Imports pattern** (line 4):
```typescript
import { PlusIcon } from "lucide-react"
```
Replace with pen icon. `PenLine` is recommended (communicates "edit note" better than `Pencil` which implies drawing). Same import pattern:
```typescript
import { PenLine } from "lucide-react"
```

**UI-03: Icon usage** (lines 351–353):
```tsx
<button
  type="button"
  onClick={() => setNotesOpenDates(prev => new Set(prev).add(day.date))}
  aria-label={`Lisää muistiinpano — ${day.dayLabel}`}
  className="text-muted-foreground hover:text-foreground"
  style={{ touchAction: "manipulation" }}
>
  <PlusIcon className="h-4 w-4" />
</button>
```
Change only the icon element — everything else stays:
```tsx
<PenLine className="h-4 w-4" />
```

**UI-05: Day row `<tr>` — existing pattern** (lines 307–312):
```tsx
<tr
  data-date={day.date}
  data-today={day.isToday ? "true" : undefined}
  className={day.isToday ? "bg-yellow-50 dark:bg-yellow-950/20 scroll-mt-10" : "scroll-mt-10"}
>
```
Add conditional bottom-border removal when a note row follows (D-11). The condition is `day.notes || notesOpenDates.has(day.date)`:
```tsx
<tr
  data-date={day.date}
  data-today={day.isToday ? "true" : undefined}
  className={[
    day.isToday ? "bg-yellow-50 dark:bg-yellow-950/20 scroll-mt-10" : "scroll-mt-10",
    (day.notes || notesOpenDates.has(day.date)) ? "max-sm:[&>td]:border-b-0" : "",
  ].join(" ").trim()}
>
```
Note: the border approach depends on whether `border-collapse` rows actually show borders on `td` elements. Check if the visual separator between rows comes from `border-b` on `td` or from `divide-y` on `tbody`. If `divide-y` is used on `tbody`, the separator is on the `tr` itself and the fix is `[&+tr.note-row]:hidden-border` — but examining the table (line 275), it uses `border-collapse` with no `divide-y`, so borders are on individual `td` elements. The correct target is to suppress `border-b` on the day row's `td` cells when a note row follows.

**UI-05: Note row `<tr>` — existing pattern** (lines 364–383):
```tsx
{(day.notes || notesOpenDates.has(day.date)) && (
  <tr className="max-sm:table-row sm:hidden">
    <td colSpan={colCount} className="px-1 py-1 pb-1">
      <NotesCell ... />
    </td>
  </tr>
)}
```
Apply D-09 (zero top gap) and D-10 (left indent). The `py-1` on `td` provides top AND bottom padding. Remove top padding:
```tsx
<tr className="max-sm:table-row sm:hidden">
  <td colSpan={colCount} className="px-1 pt-0 pb-1 pl-8">
    <NotesCell ... />
  </td>
</tr>
```
`pl-8` (32px) aligns the note input under the date column's text content. The date column uses `px-3` (12px) plus a `font-mono` date string; `pl-8` provides a visible but not excessive indent. If `pl-8` is too tight relative to the date column width, `pl-10` is the fallback.

---

## Shared Patterns

### Touch interaction guard
**Source:** `src/components/schedule/schedule-cell.tsx` line 100, `src/components/schedule/schedule-table.tsx` line 350
**Apply to:** All interactive buttons on mobile
```tsx
style={{ touchAction: "manipulation" }}
```
Keep on all existing interactive buttons — do not remove when adding new pointer handlers.

### Tailwind v4 media query variant syntax
**Source:** No existing usage in codebase — new pattern for this phase
**Apply to:** UI-04 media-split classes in `schedule-cell.tsx`
```
[@media(hover:none)]:...    ← touch/pen devices (phones, tablets)
[@media(hover:hover)]:...   ← pointer devices (mouse, trackpad)
```
This replaces `max-sm:` for UI-04 logic. `max-sm:` (viewport-based) stays on UI-05 note row visibility (`max-sm:table-row sm:hidden`) since that split is intentional viewport-based, not capability-based.

### Optimistic state + revert pattern
**Source:** `src/components/schedule/schedule-table.tsx` lines 104–134 (handleToggle), lines 136–179 (handleClear)
**Apply to:** No new mutations in Phase 18 — all three UI changes are rendering-only. The existing `handleClear` invoked from the new full-cell tap needs no changes.

### isArmed disarm cleanup pattern
**Source:** `src/components/schedule/schedule-cell.tsx` lines 107–115
```tsx
onClick={(e) => {
  e.stopPropagation()
  onClear(entryId)
  setIsArmed(false)
  if (disarmTimerRef.current !== null) {
    clearTimeout(disarmTimerRef.current)
    disarmTimerRef.current = null
  }
}}
```
The full-cell tap handler for UI-04 must replicate this cleanup — clear the disarm timer and reset both `isArmed` and `isHolding` to false.

---

## No Analog Found

None. Both modified files are their own analogs. All patterns are extensions of existing machinery already present in the files.

---

## Metadata

**Analog search scope:** `src/components/schedule/`
**Files scanned:** 3 (`schedule-cell.tsx`, `schedule-table.tsx`, `notes-cell.tsx`)
**Pattern extraction date:** 2026-05-21
