# Phase 16: Schedule Table Reflow and Stats - Research

**Researched:** 2026-05-20
**Domain:** Tailwind CSS responsive layout, HTML table reflow, CSS grid/table for stats
**Confidence:** HIGH

## Summary

Phase 16 is a pure rendering-layer change across three files: `schedule-table.tsx`, `stats-panel.tsx`, and `schedule-with-realtime.tsx`. No schema changes, no new Server Actions, no new packages, no data-flow changes. All three requirements (MOB-01, MOB-01b, MOB-05) have well-defined locked decisions in CONTEXT.md.

The implementation uses Tailwind v4's `max-sm:` and `sm:` breakpoint variants — already used in the codebase via Phase 15's CSS toggle pattern. The primary technique is hiding columns on mobile with `max-sm:hidden` and rendering a conditional second `<tr>` for notes below each day row. The stats panel moves outside `ScheduleTable`'s scroll container into `ScheduleWithRealtime` as a sibling.

One structural subtlety demands attention: the existing `overflow-y-auto h-[calc(100vh-8rem)]` container must become `sm:overflow-y-auto sm:h-[calc(100svh-8rem)]` — stripping the constraint on mobile so the page scrolls naturally. The `thead`'s sticky positioning must be verified against `overflow-clip` vs `overflow-hidden` on the ancestor div (iOS Safari breaks `position: sticky` inside `overflow: hidden`).

**Primary recommendation:** Implement in task order — scroll container first (D-01/D-03/D-04), then column layout (D-06/D-07/D-08), then two-row notes (D-09/D-10/D-11), then move StatsPanel (D-13), then redesign StatsPanel grid (D-14 through D-18).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Mobile Scroll Model (MOB-01)
- **D-01:** Page scroll on mobile — `overflow-y-auto h-[calc(100vh-8rem)]` on `ScheduleTable`'s inner `<div>` becomes `sm:overflow-y-auto sm:h-[calc(100svh-8rem)]`. On mobile (below `sm:`), no height constraint — full page scrolls naturally.
- **D-02:** ViewToolbar is NOT sticky on mobile — scrolls away with page.
- **D-03:** Fix iOS Safari: `h-[calc(100vh-8rem)]` → `h-[calc(100svh-8rem)]` on the desktop breakpoint.
- **D-04:** Verify `thead`'s `position: sticky` ancestor does NOT have `overflow-hidden`. If found, replace with `overflow-clip`.
- **D-05:** Stats panel moves outside scroll container — see D-12. `renderAbove` in `ScheduleTable` becomes unused.

#### Table Column Layout (MOB-01)
- **D-06:** Notes `<td>` in the main day `<tr>` gets `max-sm:hidden`.
- **D-07:** Child custody columns get `min-w-[72px]` (down from `min-w-[90px]`) on mobile via responsive class. Sticky date column stays with `position: sticky left-0 z-10 bg-background`.
- **D-08:** Notes `<th>` column header also gets `max-sm:hidden`.

#### Two-Row Notes Layout (MOB-01b)
- **D-09:** A conditional second `<tr>` rendered after each day's main row on mobile, ONLY when `day.notes` is non-empty. Single `<td colSpan={childCount + 2}>` (spanning date + all child columns) containing existing `NotesCell`. The `<tr>` gets `max-sm:table-row sm:hidden`.
- **D-10:** `NotesCell` in the second row is fully editable on mobile — same component, same tap-to-edit behavior.
- **D-11:** When a day has no notes, a small + icon button in the main day `<tr>` on mobile to allow adding notes. Tapping triggers the notes editor. Exact placement and icon are Claude's discretion.
- **D-12:** Desktop layout UNCHANGED — one `<tr>` per day with notes as the final `<td>` in the same row.

#### Statistics Panel Architecture (MOB-05)
- **D-13:** `StatsPanel` moves OUTSIDE and BELOW `ScheduleTable`'s scroll container. In `ScheduleWithRealtime`, `StatsPanel` rendered as sibling AFTER `<ScheduleTable />`. `renderAbove` prop becomes unused.
- **D-14:** Stats panel displays as a child-column grid on ALL viewports. Replaces existing `flex items-center gap-4` layout.

#### Statistics Grid Layout (MOB-05)
- **D-15:** Grid structure — children are columns, parents are rows:
  - Column headers: child names, preceded by an empty label column
  - Father row: "Isä" + per-child cells: custody day count / solo days sub-line
  - Mother row: same structure
  - Separator
  - Vapaa Isä row: full-width spanning — `Isä X pv (Y vkl)`
  - Vapaa Äiti row: full-width spanning — `Äiti X pv (Y vkl)`
- **D-16:** Solo days appear as separate sub-line below day count: `45 pv` / `yksin 12` (smaller/muted text: `text-xs text-muted-foreground`).
- **D-17:** If only 1 child exists, grid degrades to a single data column — Claude's discretion.
- **D-18:** CSS grid implementation: `grid-cols-[auto_repeat(N,1fr)]` where N = number of children. Or a `<table>` — Claude's discretion.

### Claude's Discretion
- Exact position and icon for the mobile "add notes" affordance (+ icon or pencil; after last child cell is suggested)
- Whether to remove or keep the unused `renderAbove` prop from `ScheduleTable`
- Single-child grid degradation details
- Whether to use CSS grid or HTML `<table>` for the stats grid layout
- Whether to show or omit the child name header row in the stats grid
- `touch-action: manipulation` on interactive cells — add to `schedule-cell.tsx` and `notes-cell.tsx` if not already present

### Deferred Ideas (OUT OF SCOPE)
- Safe area insets (`env(safe-area-inset-*)`) — not needed for table/stats
- Per-month or per-term statistics breakdown
- Collapsible stats panel
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MOB-01 | Schedule table fits 360–430px viewport without horizontal scrolling | D-01/D-03: remove mobile height constraint; D-06/D-07/D-08: hide notes column, narrow child columns |
| MOB-01b | Each day row on mobile shows child cells on top and notes text on a second row below; desktop layout unchanged | D-09/D-10/D-11/D-12: conditional second `<tr>` for notes; CSS toggle pattern |
| MOB-05 | Statistics panel positioned below schedule table on all viewports; 2-column grid on mobile | D-13: move outside scroll container; D-14 through D-18: redesign to child-column grid |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Mobile scroll model | Browser / Client | — | CSS layout change in a `"use client"` component |
| Column visibility on mobile | Browser / Client | — | Tailwind responsive classes, no server involvement |
| Two-row notes layout | Browser / Client | — | Conditional JSX rendering based on `day.notes` value |
| Stats panel positioning | Browser / Client | — | React tree restructure in `ScheduleWithRealtime` |
| Stats grid redesign | Browser / Client | — | Pure CSS + JSX; `computeStats()` logic unchanged |

All five capabilities are purely client-side rendering changes. No API, database, or server component involvement.

## Standard Stack

No new packages are installed in this phase. All required libraries are already present.

### Core (already installed)
| Library | Installed Version | Purpose in Phase 16 |
|---------|------------------|---------------------|
| Tailwind CSS | 4.x (`^4`) | `max-sm:`, `sm:`, `grid-cols-[...]` responsive classes | [VERIFIED: package.json]
| React | 19.2.4 | Conditional `<tr>` rendering, JSX structure | [VERIFIED: package.json]
| lucide-react | 1.7.0 | `PlusIcon` or `PencilIcon` for mobile notes affordance | [VERIFIED: package.json]
| Next.js | 16.2.2 | App Router framework; no new APIs used | [VERIFIED: package.json]

### No New Installations Required

This phase is CSS and JSX changes only. The Package Legitimacy Gate protocol is skipped — no packages to audit.

## Architecture Patterns

### System Architecture Diagram

```
DashboardShell
  └─ main.p-4
       ├─ ScheduleWithRealtime (restructured in this phase)
       │    ├─ RealtimeProvider
       │    │    └─ ScheduleTable (scroll container: sm:overflow-y-auto sm:h-[calc(100svh-8rem)])
       │    │         ├─ thead (sticky top-0 z-10) ← ancestor must have overflow-clip, not overflow-hidden
       │    │         └─ tbody
       │    │              └─ per day: main <tr> + conditional notes <tr> (max-sm:table-row sm:hidden)
       │    └─ StatsPanel (NEW POSITION: sibling after ScheduleTable, outside scroll container)
       │         └─ child-column grid (replaces flex layout)
       ├─ ExtendPanel
       └─ ClearPanel
```

### Recommended File Modification Order

```
1. schedule-with-realtime.tsx   — move StatsPanel outside ScheduleTable
2. schedule-table.tsx           — scroll container + column widths + notes second-row
3. stats-panel.tsx              — redesign to grid layout
```

### Pattern 1: CSS Toggle for Responsive Visibility (Phase 15 established)

**What:** Render both elements, hide one per breakpoint via Tailwind. No JS media queries, no hydration flash.
**When to use:** Whenever an element needs to exist on one breakpoint and be absent on another.

```tsx
// Source: Phase 15 clear-panel.tsx (already in codebase)
// Native input: visible on mobile, hidden on desktop
<input type="date" className="sm:hidden border rounded-md px-2 py-1 text-sm" />
// Calendar popover: hidden on mobile, visible on desktop
<Button className="hidden sm:flex" />
```

For Phase 16, the same pattern applies to the notes column and second-row notes `<tr>`:

```tsx
// Notes <th>: hidden on mobile
<th className="px-1 py-2 text-left text-sm font-semibold border-b min-w-[160px] max-sm:hidden">
  Muistiinpanot
</th>

// Notes <td> in main row: hidden on mobile
<td className="px-1 py-1 max-sm:hidden">
  <NotesCell ... />
</td>

// Second-row for notes: visible on mobile only
<tr className="max-sm:table-row sm:hidden">
  <td colSpan={childCount + 2}>
    <NotesCell ... />
  </td>
</tr>
```

### Pattern 2: Scroll Container Scope Restriction [ASSUMED based on Tailwind v4 docs pattern]

**What:** Add `sm:` prefix to both the `overflow-y-auto` and `h-[...]` utilities so the height constraint only applies at `sm` and above. On mobile, the div has no height constraint and the page scrolls naturally.

```tsx
// Before (current):
<div className="overflow-y-auto h-[calc(100vh-8rem)]">

// After (Phase 16):
<div className="sm:overflow-y-auto sm:h-[calc(100svh-8rem)]">
```

This is safe because the Tailwind v4 `sm:` prefix applies utilities at `min-width: 640px` and above. Without the prefix, the utility is entirely absent on mobile. [VERIFIED: CLAUDE.md Tailwind v4 section]

### Pattern 3: iOS Safari Sticky + overflow-clip Fix

**What:** `position: sticky` on `thead` breaks on iOS Safari if any ancestor has `overflow: hidden`. The fix is `overflow-clip` which clips visually but does not create a new scroll context.
**Current state:** The `overflow-y-auto` container creates a scroll context — this is the ancestor to check. After changing it to `sm:overflow-y-auto`, on mobile there is no scroll container at all, so the sticky thead anchors to the page. On desktop, the container remains with `overflow-y-auto` (not `overflow-hidden`), so this is not the problematic case. No `overflow-hidden` is found in the current schedule-table ancestor chain. [VERIFIED: grep of source — no `overflow-hidden` found on ScheduleTable or its parent containers]

### Pattern 4: Column Count Arithmetic

The existing `colCount` variable in `ScheduleTable`:

```tsx
// Current (line 216):
const colCount = childNames.length + 2  // Date + children + Notes
```

For the `colSpan` in the second-row notes `<tr>`, the span should cover the visible columns on mobile (date + child columns, excluding notes which is hidden). That is `childCount + 1` on mobile, but using `colCount` (which includes notes) is safe because the notes column is `max-sm:hidden` — an extra colSpan on a hidden column causes no layout issue.

Using `colSpan={colCount}` is correct and simpler than computing a mobile-specific count. [ASSUMED — standard HTML table behavior, not verified via spec]

### Pattern 5: Stats Grid — HTML table vs CSS grid

The locked decision (D-18) allows Claude's discretion on `<table>` vs CSS grid. Both approaches are valid given the confirmed stats sketch:

```
          | Lapsi1     | Lapsi2
----------+------------+----------
Isä       | 45 pv      | 38 pv
          | yksin 12   | yksin 10
Äiti      | 39 pv      | 46 pv
          | yksin 8    | yksin 7
----------+------------+----------
Vapaa Isä  14 pv (3 vkl)
Vapaa Äiti  9 pv (2 vkl)
```

**Recommendation: HTML `<table>`** — the stats have a genuine tabular structure with row/column semantics. An HTML table provides:
- Correct column alignment automatically without explicit `grid-cols-[auto_repeat(N,1fr)]` arithmetic
- `colSpan` for the Vapaa rows is straightforward
- Screen reader semantics (accessible data table)
- No dynamic class computation for variable child counts

CSS grid requires constructing `grid-cols-[auto_repeat(${N},1fr)]` as a dynamic inline style (Tailwind v4 arbitrary values don't support runtime interpolation). [ASSUMED — Tailwind arbitrary values are static at build time]

**CSS grid alternative:** Use inline style `style={{ gridTemplateColumns: `auto repeat(${children.length}, 1fr)` }}` with `className="grid"`. This works but loses semantic table roles.

### Pattern 6: colSpan for Vapaa rows in stats table

```tsx
// Vapaa rows span all columns (label + all child columns)
<tr>
  <td colSpan={children.length + 1} className="pt-1 text-blue-700">
    Isä {fatherFree.childFreeDays} pv ({fatherFree.childFreeWeekends} vkl)
  </td>
</tr>
```

### Pattern 7: Conditional Second-Row Notes + Add Button

The second-row notes `<tr>` is only rendered when `day.notes` is non-empty. When notes are empty, a mobile-visible "add notes" affordance is needed in the main row.

```tsx
// In the main <tr>, after the last child cell, on mobile only:
{!day.notes && (
  <td className="px-1 py-1 max-sm:table-cell sm:hidden">
    <button
      type="button"
      onClick={() => { /* trigger notes input focus */ }}
      aria-label={`Lisää muistiinpano — ${day.dayLabel}`}
      className="text-muted-foreground hover:text-foreground"
    >
      <PlusIcon className="h-4 w-4" />
    </button>
  </td>
)}
```

Triggering focus on the `NotesCell` input requires either a `ref` passed to `NotesCell` or converting the button tap into a direct render of a focused `NotesCell`. Simplest approach: render an empty `NotesCell` (which accepts input immediately on focus) in the second-row position even when `day.notes` is empty, but only show the second row if notes are non-empty OR the user has tapped the `+`. This requires a `useState` per-row "notesOpen" flag.

Alternatively: render the second-row `<tr>` when `day.notes !== ""` OR a per-row `notesOpen` state is true. [ASSUMED — implementation detail left to Claude's discretion per D-11]

### Anti-Patterns to Avoid

- **Dynamic Tailwind class interpolation:** Do not use `grid-cols-[repeat(${N},1fr)]` as a Tailwind class — Tailwind v4 scans statically and will not generate this class. Use inline `style` prop for dynamic grid column counts.
- **overflow-hidden on sticky thead ancestor:** Confirmed not present in current codebase. Do not add it.
- **useMediaQuery for layout toggles:** Explicitly rejected in STATE.md — causes hydration flash. Use CSS toggle (render both, hide one) instead.
- **Separate mobile/desktop component trees:** The CSS toggle pattern renders both in one JSX tree. Do not create separate mobile and desktop components.
- **Changing computeStats():** The stats computation logic is correct and tested. Phase 16 only changes the rendering of its output.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Variable-column grid | Dynamic Tailwind class computation | Inline `style={{ gridTemplateColumns: ... }}` |
| Column visibility | JS-based show/hide with state | Tailwind `max-sm:hidden` / `sm:hidden` CSS |
| Mobile breakpoint detection | `useMediaQuery` hook | Tailwind responsive variants |
| Stats table alignment | Custom CSS grid with manual column widths | HTML `<table>` with natural column sizing |

**Key insight:** Every "should this be visible on mobile?" question is answered with a CSS class, not a JavaScript condition. This eliminates hydration mismatches entirely.

## Common Pitfalls

### Pitfall 1: `colSpan` miscount after hiding notes column

**What goes wrong:** The week separator `<tr>` and any future spanning rows use `colCount` which includes the notes column. If the notes column is hidden on mobile via `max-sm:hidden`, the colSpan in the separator `<tr>` over-counts but CSS ignores the extra span — no visual issue. However, if a developer tries to compute mobile-specific colSpan, an off-by-one is easy.
**Why it happens:** `colCount = childNames.length + 2` includes the notes column.
**How to avoid:** Reuse `colCount` for all `colSpan` values. The hidden column does not affect layout.
**Warning signs:** Layout breaking or console warnings about colSpan mismatch.

### Pitfall 2: Sticky thead breaks when scroll container is removed on mobile

**What goes wrong:** On desktop, `thead` with `position: sticky top-0` sticks within the `overflow-y-auto` scroll container. On mobile, after removing the height constraint, the scroll container is no longer constrained — the `thead` will now stick relative to the page viewport instead.
**Why it happens:** `position: sticky` sticks within the nearest scrolling ancestor. When the scroll container has no height constraint on mobile, the page becomes the scroll ancestor.
**How to avoid:** This is actually the desired behavior on mobile — the header row sticking to the top of the viewport as the page scrolls is correct. No fix needed; verify on device.
**Warning signs:** Header not sticking at all, or sticking in the wrong position.

### Pitfall 3: Second-row notes `<tr>` breaks week separator visual rhythm

**What goes wrong:** Week separator rows (`<tr>` with `h-px bg-border`) are rendered between `isWeekStart` days. With second-row notes `<tr>` inserted after each day row, the separator logic must still fire before the MAIN row, not before the notes row.
**Why it happens:** The separator is rendered inside `React.Fragment key={day.date}` before the main `<tr>`. Adding the notes `<tr>` inside the same Fragment is safe — separator fires first, then main row, then notes row.
**How to avoid:** Keep notes `<tr>` inside the existing `React.Fragment key={day.date}` after the main `<tr>`. Do not create a new Fragment that wraps differently.
**Warning signs:** Separator appearing in wrong position or after notes rows.

### Pitfall 4: `renderAbove` still referenced after removal

**What goes wrong:** If `renderAbove` is removed from `ScheduleTable`'s prop interface but `schedule-with-realtime.tsx` still passes it, TypeScript will error. If `ScheduleTable` still calls `renderAbove?.(days)` but the prop is gone from the call site, no error but the prop goes unused.
**Why it happens:** Refactoring props across two files.
**How to avoid:** Update both files in the same task. Remove the prop from the interface and from the JSX call in `ScheduleTable`, and remove the `renderAbove={...}` from `ScheduleWithRealtime` simultaneously.
**Warning signs:** TypeScript build errors about unknown prop.

### Pitfall 5: `100svh` on desktop requires `sm:` prefix

**What goes wrong:** If `100svh` is written without the `sm:` prefix, it applies on mobile too — but on mobile we want NO height constraint, so the class must be `sm:h-[calc(100svh-8rem)]`.
**Why it happens:** Easy to forget the prefix when changing just the unit from `vh` to `svh`.
**How to avoid:** The full class is `sm:overflow-y-auto sm:h-[calc(100svh-8rem)]`. Both utilities must carry the `sm:` prefix.

### Pitfall 6: Notes second-row `<tr>` interferes with `data-today` auto-scroll

**What goes wrong:** `ScheduleTable` uses `document.querySelector('[data-today="true"]')` to auto-scroll to today. If the notes second-row `<tr>` appears before the main `<tr>`, the selector would still work (it's on the main row). But if `scrollIntoView` pulls a notes row into view, the offset may be wrong.
**Why it happens:** Auto-scroll targets the main row via `data-today`.
**How to avoid:** Keep `data-today` on the main `<tr>` only. The notes `<tr>` has no `data-today` attribute. The existing `scrollIntoView({ block: "center" })` will center the main row, which is correct.

## Code Examples

### Scroll container change

```tsx
// Source: schedule-table.tsx line 221 (current)
// Before:
<div className="overflow-y-auto h-[calc(100vh-8rem)]">

// After (Phase 16):
<div className="sm:overflow-y-auto sm:h-[calc(100svh-8rem)]">
```
[VERIFIED: current source read]

### Child column min-width responsive

```tsx
// Source: schedule-table.tsx line 229-234 (current)
// Before:
<th className="px-1 py-2 text-left text-sm font-semibold border-b min-w-[90px]">
// After:
<th className="px-1 py-2 text-left text-sm font-semibold border-b min-w-[72px] sm:min-w-[90px]">
```
[VERIFIED: current source read]

### Notes column hidden on mobile

```tsx
// Notes <th>:
<th className="px-1 py-2 text-left text-sm font-semibold border-b min-w-[160px] max-sm:hidden">
  Muistiinpanot
</th>

// Notes <td> in main row:
<td className="px-1 py-1 max-sm:hidden">
  <NotesCell ... />
</td>
```
[ASSUMED — Tailwind max-sm pattern consistent with Phase 15]

### Second-row notes tr

```tsx
// Inside React.Fragment key={day.date}, after the main <tr>:
{day.notes && (
  <tr className="max-sm:table-row sm:hidden">
    <td
      colSpan={colCount}
      className="px-1 py-1 pb-1"
    >
      <NotesCell
        entryId={day.notesEntryId}
        value={day.notes}
        onSave={handleNoteSave}
      />
    </td>
  </tr>
)}
```
[ASSUMED — pattern from D-09]

### StatsPanel moved outside ScheduleTable

```tsx
// schedule-with-realtime.tsx — after Phase 16:
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
[VERIFIED: current source read — renderAbove prop removed]

### StatsPanel grid structure (HTML table approach)

```tsx
// stats-panel.tsx — after Phase 16 redesign:
const childNames = stats.childStats.map(c => c.childName)

<div className="border rounded-lg p-3 mt-4 bg-muted/30 text-sm">
  <table className="w-full">
    <thead>
      <tr>
        <th className="text-left font-medium pr-2" />
        {childNames.map(name => (
          <th key={name} className="text-left font-medium px-2">{name}</th>
        ))}
      </tr>
    </thead>
    <tbody>
      {/* Father row */}
      <tr>
        <td className="text-blue-700 font-medium pr-2 py-1">Isä</td>
        {stats.childStats.map(child => (
          <td key={child.childName} className="px-2 py-1">
            <div>{child.father} pv</div>
            <div className="text-xs text-muted-foreground">yksin {child.soloFather}</div>
          </td>
        ))}
      </tr>
      {/* Mother row */}
      <tr>
        <td className="text-rose-700 font-medium pr-2 py-1">Äiti</td>
        {stats.childStats.map(child => (
          <td key={child.childName} className="px-2 py-1">
            <div>{child.mother} pv</div>
            <div className="text-xs text-muted-foreground">yksin {child.soloMother}</div>
          </td>
        ))}
      </tr>
      {/* Separator */}
      <tr><td colSpan={childNames.length + 1} className="py-1"><div className="border-t" /></td></tr>
      {/* Vapaa rows */}
      {stats.parentFreeStats.map(ps => (
        <tr key={ps.parentId}>
          <td colSpan={childNames.length + 1} className={ps.parentId === "father" ? "text-blue-700 py-0.5" : "text-rose-700 py-0.5"}>
            {ps.parentName} {ps.childFreeDays} pv ({ps.childFreeWeekends} vkl)
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```
[ASSUMED — implementation interpretation of D-15 through D-18]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `100vh` for scroll container | `100svh` (small viewport height) | iOS Safari 15.4+ | Correct height excluding Safari's dynamic browser toolbar |
| `overflow-hidden` on sticky ancestor | `overflow-clip` | iOS Safari sticky fix | `overflow-clip` clips visually without creating scroll context |
| `flex` layout for stats | CSS grid / HTML table | Phase 16 | Proper column alignment, scales with child count |
| StatsPanel rendered inside ScheduleTable via `renderAbove` | Rendered as sibling after ScheduleTable | Phase 16 | Escapes scroll container so it's always visible below the table |

**Deprecated in this phase:**
- `renderAbove` prop: becomes unused after D-13; may be removed entirely

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Using `colSpan={colCount}` for second-row notes td is safe even though the notes column is hidden on mobile | Common Pitfalls #1, Code Examples | Negligible — extra colSpan on hidden column is CSS-harmless |
| A2 | HTML `<table>` is recommended for stats grid over CSS grid | Pattern 5 | Low — both approaches work; CSS grid would require inline style for dynamic columns |
| A3 | Tailwind arbitrary values (`grid-cols-[repeat(N,1fr)]`) do not support runtime interpolation | Pattern 5 | Low — this is well-known Tailwind behavior; inline style is the correct workaround |
| A4 | `min-w-[72px] sm:min-w-[90px]` pattern for child columns works in Tailwind v4 | Code Examples | Low — Tailwind v4 uses same mobile-first breakpoint system as v3 |
| A5 | Second-row notes `<tr className="max-sm:table-row sm:hidden">` produces correct display value on mobile | Code Examples | Low — `table-row` is the correct display value for a `<tr>` element; `sm:hidden` sets `display: none` on desktop |
| A6 | `touch-action: manipulation` already present on `ScheduleCell` main button — `NotesCell` `<input>` does not need it (native inputs handle 300ms delay automatically in modern iOS) | Architecture Patterns | Low — native inputs in iOS 13+ do not have the 300ms delay |

## Open Questions

1. **Notes "add" button triggers focus on NotesCell**
   - What we know: D-11 requires a `+` button to appear on mobile when a day has no notes. Tapping it should trigger the notes editor.
   - What's unclear: `NotesCell` is an `<input>` that auto-saves on blur. Triggering focus from a sibling button requires either a forwarded ref or an intermediate state that reveals a focused NotesCell.
   - Recommendation: Use a per-row `notesOpen` state (boolean). When `+` is tapped, set it to `true`. Render the second-row notes `<tr>` when `day.notes !== "" || notesOpen[day.date]`. When NotesCell blurs (saved or empty), set back to `false`. This is the simplest implementation that doesn't require ref forwarding.

2. **Single-child stats grid appearance**
   - What we know: D-17 says "Claude's discretion on the exact implementation."
   - What's unclear: With one child, the grid has one data column. The "Vapaa" rows spanning `childNames.length + 1` columns still work correctly (2 columns total). No special casing needed.
   - Recommendation: No single-child special case needed. The table degrades naturally.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build toolchain | ✓ | 25.3.0 | — |
| Next.js | Framework | ✓ | 16.2.2 | — |
| Tailwind CSS | Responsive classes | ✓ | 4.x | — |
| lucide-react | PlusIcon / PencilIcon for notes affordance | ✓ | 1.7.0 | — |
| Vitest | Unit tests (nyquist disabled, but stats.test.ts exists) | ✓ | 4.1.2 | — |

**Missing dependencies with no fallback:** None.

**Note:** `nyquist_validation` is `false` in `.planning/config.json` — Validation Architecture section is omitted.

## Security Domain

Phase 16 is a rendering-only change. No new input surfaces, no new data flows, no authentication changes, no API endpoints. ASVS categories V2 (Authentication), V3 (Session), V4 (Access Control), V6 (Cryptography) are not applicable. V5 (Input Validation) is unchanged — `NotesCell` already exists and saves via the existing `saveNotes` Server Action which is unchanged.

**No new security considerations introduced by this phase.**

## Sources

### Primary (HIGH confidence)
- Current source files read directly: `schedule-table.tsx`, `stats-panel.tsx`, `schedule-with-realtime.tsx`, `notes-cell.tsx`, `schedule-cell.tsx`, `dashboard-shell.tsx`, `globals.css`, `stats.ts`, `vitest.config.ts`
- `package.json` — confirmed installed versions [VERIFIED]
- `CONTEXT.md` — locked decisions D-01 through D-18 [VERIFIED]
- `STATE.md` — v1.4 decisions carry-forwards confirmed [VERIFIED]
- `CLAUDE.md` — Tailwind v4 `max-sm:`, CSS toggle pattern confirmed as project standard [VERIFIED]

### Secondary (MEDIUM confidence)
- Phase 15 CONTEXT.md D-12 — CSS toggle pattern established (render both, hide via `sm:hidden`/`max-sm:hidden`) [VERIFIED: source grep confirms actual usage in clear-panel.tsx, view-toolbar.tsx, header.tsx, schedule-cell.tsx]
- Phase 15 CONTEXT.md D-16 — `@container` on ViewToolbar confirmed as component-internal breakpoint strategy

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all dependencies verified in package.json
- Architecture: HIGH — all three files fully read; data flow completely understood
- Pitfalls: HIGH — derived from actual source code analysis, not assumptions
- Implementation patterns: MEDIUM — CSS toggle and table patterns verified from existing code; stats grid structure inferred from D-15/sketch

**Research date:** 2026-05-20
**Valid until:** 2026-06-20 (stable CSS/Tailwind domain; 30 days)
