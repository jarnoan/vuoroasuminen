# Phase 16: Schedule Table Reflow and Stats - Pattern Map

**Mapped:** 2026-05-20
**Files analyzed:** 3 modified files
**Analogs found:** 3 / 3

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/schedule/schedule-table.tsx` | component | request-response (optimistic CRUD) | self (modify in-place) | self |
| `src/components/schedule/stats-panel.tsx` | component | transform (read-only display) | self (modify in-place) | self |
| `src/components/schedule/schedule-with-realtime.tsx` | component | event-driven (realtime) | self (modify in-place) | self |

All three files already exist and are being modified. The pattern analogs for the specific techniques being applied are drawn from `clear-panel.tsx`, `view-toolbar.tsx`, and `schedule-cell.tsx`.

---

## Pattern Assignments

### `src/components/schedule/schedule-table.tsx`

**Current file:** fully read above (302 lines)

This file receives four distinct changes. Each change has a concrete analog pattern.

---

#### Change 1: Scroll Container — D-01, D-03 (lines 221)

**Analog:** `src/components/schedule/view-toolbar.tsx` — `sm:hidden` / `hidden sm:flex` breakpoint prefix pattern

**Current code** (line 221):
```tsx
<div className="overflow-y-auto h-[calc(100vh-8rem)]">
```

**Target code** (after Phase 16):
```tsx
<div className="sm:overflow-y-auto sm:h-[calc(100svh-8rem)]">
```

Pattern: add `sm:` prefix to both utilities so they only apply at `min-width: 640px`. On mobile the div has no height constraint; the page scrolls naturally. Also change `100vh` to `100svh` (iOS Safari small viewport height fix).

---

#### Change 2: Notes Column Hide — D-06, D-07, D-08 (lines 229–237, 286)

**Analog:** `src/components/schedule/clear-panel.tsx` lines 97–107 (native input `sm:hidden`) and lines 110–129 (popover `hidden sm:flex`)

**clear-panel.tsx lines 97–107:**
```tsx
{/* Native date input — mobile only */}
<input
  id="clear-start-date"
  type="date"
  className="sm:hidden border rounded-md px-2 py-1 text-sm"
  ...
/>
{/* Calendar Popover — desktop only */}
<Popover>
  <PopoverTrigger
    render={<Button variant="outline" size="sm" className="font-semibold hidden sm:flex" ... />}
  >
```

**`schedule-cell.tsx` line 106** (max-sm: existing usage):
```tsx
className={`... sm:opacity-0 sm:group-hover:opacity-100 ${isArmed ? "max-sm:opacity-100" : "max-sm:opacity-0"}`}
```

**Current `<th>` for child columns** (lines 229–235):
```tsx
{childNames.map((name) => (
  <th
    key={name}
    className="px-1 py-2 text-left text-sm font-semibold border-b min-w-[90px]"
  >
    {name}
  </th>
))}
```

**Target** (D-07: `min-w-[72px]` on mobile, `min-w-[90px]` on desktop):
```tsx
{childNames.map((name) => (
  <th
    key={name}
    className="px-1 py-2 text-left text-sm font-semibold border-b min-w-[72px] sm:min-w-[90px]"
  >
    {name}
  </th>
))}
```

**Current `<th>` for notes** (line 236–238):
```tsx
<th className="px-1 py-2 text-left text-sm font-semibold border-b min-w-[160px]">
  Muistiinpanot
</th>
```

**Target** (D-08: `max-sm:hidden`):
```tsx
<th className="px-1 py-2 text-left text-sm font-semibold border-b min-w-[160px] max-sm:hidden">
  Muistiinpanot
</th>
```

**Current `<td>` for notes in main row** (lines 286–291):
```tsx
<td className="px-1 py-1">
  <NotesCell
    entryId={day.notesEntryId}
    value={day.notes}
    onSave={handleNoteSave}
  />
</td>
```

**Target** (D-06: `max-sm:hidden`):
```tsx
<td className="px-1 py-1 max-sm:hidden">
  <NotesCell
    entryId={day.notesEntryId}
    value={day.notes}
    onSave={handleNoteSave}
  />
</td>
```

---

#### Change 3: Two-Row Notes Layout — D-09, D-10, D-11 (inside tbody map, after line 293)

**Analog:** `src/components/schedule/view-toolbar.tsx` lines 69–83 (CSS toggle: both elements rendered, one hidden per breakpoint)

**view-toolbar.tsx lines 69–83:**
```tsx
{/* Native date input — visible on mobile, hidden on desktop */}
<input
  type="date"
  className="sm:hidden border rounded-md px-2 py-1 text-sm"
  ...
/>
{/* Calendar Popover — hidden on mobile, visible on desktop */}
<Popover>
  <PopoverTrigger
    render={<Button variant="outline" size="sm" className="font-semibold hidden sm:flex" ... />}
  >
```

**Target: second-row `<tr>` for notes** (D-09 — inside `React.Fragment key={day.date}`, after the main `<tr>`):

The second-row notes tr is conditionally rendered when `day.notes` is non-empty OR a per-row `notesOpen` state is true (for the D-11 "add notes" affordance). Use `useState` for per-row open state keyed by `day.date`.

```tsx
// State needed at top of component (or per-row map):
const [notesOpenDates, setNotesOpenDates] = useState<Set<string>>(new Set())

// Inside React.Fragment key={day.date}, after the main <tr>:
{(day.notes || notesOpenDates.has(day.date)) && (
  <tr className="max-sm:table-row sm:hidden">
    <td colSpan={colCount} className="px-1 py-1 pb-1">
      <NotesCell
        entryId={day.notesEntryId}
        value={day.notes}
        onSave={(entryId, notes) => {
          handleNoteSave(entryId, notes)
          if (!notes) {
            setNotesOpenDates(prev => {
              const next = new Set(prev)
              next.delete(day.date)
              return next
            })
          }
        }}
      />
    </td>
  </tr>
)}
```

**Target: "add notes" affordance** (D-11 — in the main `<tr>`, after last child cell, on mobile only):
```tsx
{/* After the last cell in the day.cells.map, add a mobile-only td: */}
<td className="px-1 py-1 max-sm:table-cell sm:hidden">
  {!day.notes && !notesOpenDates.has(day.date) && (
    <button
      type="button"
      onClick={() => setNotesOpenDates(prev => new Set(prev).add(day.date))}
      aria-label={`Lisää muistiinpano — ${day.dayLabel}`}
      className="text-muted-foreground hover:text-foreground"
    >
      <PlusIcon className="h-4 w-4" />
    </button>
  )}
</td>
```

**Import to add** for the PlusIcon:
```tsx
import { PlusIcon } from "lucide-react"
```

**Import already in codebase** (lucide-react usage from view-toolbar.tsx line 7):
```tsx
import { CalendarIcon, ChevronLeft } from "lucide-react"
```

---

#### Change 4: Remove `renderAbove` — D-05 (lines 24, 28, 220)

Remove from prop interface (line 24):
```tsx
// Remove: renderAbove?: (days: ScheduleDay[]) => React.ReactNode
```

Remove from destructuring (line 28):
```tsx
// Before: export function ScheduleTable({ days, setDays, realtimeRef, publishRef, renderAbove, parents })
// After:  export function ScheduleTable({ days, setDays, realtimeRef, publishRef, parents })
```

Remove call site (line 220):
```tsx
// Remove: {renderAbove?.(days)}
```

---

### `src/components/schedule/stats-panel.tsx`

**Current file:** fully read above (50 lines)

**Analog for grid structure:** HTML `<table>` pattern — no exact analog in codebase, but `schedule-table.tsx` itself (lines 222–298) shows the established `<table>` with `thead`/`tbody`/`<tr>`/`<td>` pattern and `colSpan` usage (line 247–250).

**Analog for color classes:** `schedule-cell.tsx` lines 17–26 (`text-blue-700` / `text-rose-700` naming); current `stats-panel.tsx` lines 23–30 already uses these.

**Analog for `useMemo` + `computeStats` call:** unchanged — keep lines 3 and 13 as-is.

**`computeStats` output shape** (from `src/lib/schedule/stats.ts`):
- `stats.childStats`: `Array<{ childName: string; father: number; mother: number; soloFather: number; soloMother: number }>`
- `stats.parentFreeStats`: `Array<{ parentId: ParentId; parentName: string; childFreeDays: number; childFreeWeekends: number }>`

**colSpan for separator and vapaa rows:** `childNames.length + 1` (label column + child data columns).

**Target structure — full redesign** (replaces lines 19–48):

```tsx
// Imports unchanged (lines 1–5); keep useMemo and computeStats.
// Remove: parentName helper (lines 15–16) — use stats.parentFreeStats[*].parentName directly.

const childNames = stats.childStats.map((c) => c.childName)
const fatherStats = stats.parentFreeStats.find((p) => p.parentId === "father")
const motherStats = stats.parentFreeStats.find((p) => p.parentId === "mother")

return (
  <div className="border rounded-lg p-3 mt-4 bg-muted/30 text-sm">
    <table className="w-full">
      <thead>
        <tr>
          <th className="text-left font-medium pr-2 pb-1" />
          {childNames.map((name) => (
            <th key={name} className="text-left font-medium px-2 pb-1">
              {name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {/* Father row */}
        <tr>
          <td className="text-blue-700 font-medium pr-2 py-1 align-top">
            {stats.parentFreeStats.find((p) => p.parentId === "father")?.parentName ?? "Isä"}
          </td>
          {stats.childStats.map((child) => (
            <td key={child.childName} className="px-2 py-1 align-top">
              <div>{child.father} pv</div>
              <div className="text-xs text-muted-foreground">yksin {child.soloFather}</div>
            </td>
          ))}
        </tr>
        {/* Mother row */}
        <tr>
          <td className="text-rose-700 font-medium pr-2 py-1 align-top">
            {stats.parentFreeStats.find((p) => p.parentId === "mother")?.parentName ?? "Äiti"}
          </td>
          {stats.childStats.map((child) => (
            <td key={child.childName} className="px-2 py-1 align-top">
              <div>{child.mother} pv</div>
              <div className="text-xs text-muted-foreground">yksin {child.soloMother}</div>
            </td>
          ))}
        </tr>
        {/* Separator */}
        <tr>
          <td colSpan={childNames.length + 1} className="py-1">
            <div className="border-t" />
          </td>
        </tr>
        {/* Vapaa rows — one per parent, spanning all columns */}
        {stats.parentFreeStats.map((ps) => (
          <tr key={ps.parentId}>
            <td
              colSpan={childNames.length + 1}
              className={`py-0.5 ${ps.parentId === "father" ? "text-blue-700" : "text-rose-700"}`}
            >
              {ps.parentName} {ps.childFreeDays} pv ({ps.childFreeWeekends} vkl)
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)
```

Note: change `mb-4` to `mt-4` in the outer `<div>` because StatsPanel now renders below the table (D-13).

---

### `src/components/schedule/schedule-with-realtime.tsx`

**Current file:** fully read above (49 lines)

**Change:** Move `StatsPanel` from inside `ScheduleTable` (via `renderAbove`) to a sibling after `ScheduleTable`, still inside `RealtimeProvider`.

**Analog:** No direct analog; this is a React tree restructure. The pattern is standard React sibling composition seen throughout the codebase (e.g., `dashboard-shell.tsx`).

**Current lines 38–48:**
```tsx
return (
  <RealtimeProvider onEntryChange={handleEntryChange} onRefresh={handleRefresh} viewStart={viewStart}>
    <ScheduleTable
        days={days}
        setDays={setDays}
        realtimeRef={realtimeRef}
        publishRef={publishRef}
        parents={parents}
        renderAbove={(days) => <StatsPanel days={days} parents={parents} />}
      />
  </RealtimeProvider>
)
```

**Target (D-13):**
```tsx
return (
  <RealtimeProvider onEntryChange={handleEntryChange} onRefresh={handleRefresh} viewStart={viewStart}>
    <ScheduleTable
        days={days}
        setDays={setDays}
        realtimeRef={realtimeRef}
        publishRef={publishRef}
        parents={parents}
      />
    <StatsPanel days={days} parents={parents} />
  </RealtimeProvider>
)
```

`renderAbove` prop is removed from `ScheduleTable` call. `StatsPanel` becomes a sibling after `ScheduleTable` within `RealtimeProvider`. No other changes to this file.

---

## Shared Patterns

### CSS Toggle (max-sm / sm breakpoints)
**Source:** `src/components/schedule/clear-panel.tsx` lines 97–129; `src/components/schedule/view-toolbar.tsx` lines 69–83; `src/components/schedule/schedule-cell.tsx` line 106
**Apply to:** Notes `<th>` (D-08), notes `<td>` in main row (D-06), mobile `<tr>` for second-row notes (D-09), mobile "add notes" `<td>` (D-11)

Pattern rule: never use JS state or `useMediaQuery` for layout toggles. Render both elements, hide one per breakpoint via Tailwind class:
- `max-sm:hidden` — visible on desktop (`sm:` and above), hidden on mobile
- `sm:hidden` — visible on mobile (below `sm:`), hidden on desktop
- `max-sm:table-row` — restores `display: table-row` on mobile when the element would otherwise be hidden

### `text-blue-700` / `text-rose-700` Father/Mother Colors
**Source:** `src/components/schedule/schedule-cell.tsx` lines 17–26 and current `stats-panel.tsx` lines 23–30
**Apply to:** All parent labels in the redesigned stats grid

```tsx
// Father: text-blue-700 (draft: bg-blue-200 text-blue-800 in cells)
// Mother: text-rose-700 (draft: bg-rose-200 text-rose-800 in cells)
```

### `colSpan={colCount}` for Table Spanning Rows
**Source:** `src/components/schedule/schedule-table.tsx` lines 244–251
**Apply to:** Second-row notes `<td>` (D-09); existing week separator already uses this pattern

```tsx
const colCount = childNames.length + 2  // Date + children + Notes
// ...
<td colSpan={colCount} className="h-px bg-border" />  // week separator (existing)
<td colSpan={colCount} className="px-1 py-1 pb-1">    // second-row notes (new)
```

For the stats table, colSpan is `childNames.length + 1` (label column + child data columns, no notes column).

### `text-xs text-muted-foreground` for Sub-Line Text
**Source:** `src/components/schedule/notes-cell.tsx` line 43 (`text-sm` base); shadcn/ui convention throughout
**Apply to:** Solo days sub-line in stats grid cells (D-16)

```tsx
<div className="text-xs text-muted-foreground">yksin {child.soloFather}</div>
```

### `style={{ touchAction: "manipulation" }}` on Interactive Elements
**Source:** `src/components/schedule/schedule-cell.tsx` line 100
**Apply to:** Per CONTEXT.md D-11, the "add notes" `<button>` should use this pattern; `NotesCell`'s `<input>` does not need it (native inputs handle tap delay automatically in modern iOS)

```tsx
// schedule-cell.tsx line 100 (existing):
style={{ touchAction: "manipulation" }}
```

---

## No Analog Found

No files in this phase lack analogs. All patterns are fully covered by existing codebase code.

---

## Anti-Patterns Confirmed to Avoid

| Anti-Pattern | Why | Confirmed Source |
|---|---|---|
| `grid-cols-[repeat(${N},1fr)]` dynamic Tailwind class | Tailwind v4 scans statically; runtime interpolation not generated | RESEARCH.md Pattern 5 |
| `useMediaQuery` for layout toggling | Causes hydration flash; explicitly rejected in STATE.md | RESEARCH.md anti-patterns section |
| `overflow-hidden` on sticky `thead` ancestor | Breaks iOS Safari `position: sticky`; use `overflow-clip` instead | RESEARCH.md Pattern 3 |
| `renderAbove` still passed after prop removal | TypeScript error; must update both files simultaneously | RESEARCH.md Pitfall 4 |
| `sm:h-[calc(100svh-8rem)]` without `sm:overflow-y-auto` | Must have both prefixes or neither — the height only constrains when overflow is controlled | RESEARCH.md Pitfall 5 |

---

## Metadata

**Analog search scope:** `src/components/schedule/` (all files read)
**Files scanned:** 8 source files
**Pattern extraction date:** 2026-05-20
