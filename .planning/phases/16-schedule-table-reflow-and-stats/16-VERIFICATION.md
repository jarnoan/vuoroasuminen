---
phase: 16-schedule-table-reflow-and-stats
verified: 2026-05-20T20:20:00Z
status: passed
score: 12/12 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open the app in Chrome DevTools at 360px width. Scroll the schedule table left and right."
    expected: "No horizontal scroll at any point — the table fits completely within 360px width."
    why_human: "CSS column-width constraints cannot be verified programmatically without rendering; grep confirms classes are present but not their computed layout effect."
  - test: "On 360px viewport, find a day with no notes. Tap the PlusIcon button in the main row."
    expected: "A second row appears below that day containing a focusable NotesCell. Typing and blurring saves the note. If the note is cleared, the second row collapses."
    why_human: "Touch event behavior, row visibility, and input focus cannot be verified without a browser."
  - test: "On 360px viewport, find a day that already has notes."
    expected: "The notes text appears on a second row directly below the main day row (not in the same row). The notes column in the main row is not visible."
    why_human: "Conditional second-row render and max-sm:hidden behavior require visual confirmation."
  - test: "On desktop (>= 640px), compare the schedule layout to the pre-Phase-16 behavior."
    expected: "Single-row layout with child custody cells and notes column side by side; sticky thead works within the scroll container; no layout regression."
    why_human: "Desktop layout preservation cannot be confirmed without visual inspection."
  - test: "On any viewport, scroll past the schedule table."
    expected: "The custody statistics panel (child-column grid with Isä/Äiti rows, per-child day counts, solo-days sub-lines, and Vapaa rows) appears below the table — not inside it, not above it."
    why_human: "StatsPanel sibling position in React tree is code-verified, but visual positioning below the scroll container requires a rendered viewport check."
  - test: "On 360px viewport, check the statistics panel."
    expected: "Statistics display as a grid: child names as column headers, Isä and Äiti as row labels, day count and 'yksin N' sub-line per cell. Vapaa rows span the full width. No horizontal scroll."
    why_human: "Grid layout correctness and absence of overflow cannot be confirmed without rendering."
---

# Phase 16: Schedule Table Reflow and Stats Verification Report

**Phase Goal:** Both parents can read and edit the full custody schedule on any modern smartphone without horizontal scrolling, and custody statistics are visible below the table on all viewports
**Verified:** 2026-05-20T20:20:00Z
**Status:** human_needed (automated checks PASSED — 12/12; 6 visual/interactive items require human confirmation)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Schedule table fits 360px viewport without horizontal scrolling (SC1 / MOB-01) | ✓ VERIFIED (code) / ? HUMAN for visual | Notes column hidden via `max-sm:hidden` on both `<th>` (line 236) and `<td>` (line 302). Child columns narrowed to `min-w-[72px] sm:min-w-[90px]`. Scroll container scoped to `sm:overflow-y-auto sm:h-[calc(100svh-8rem)]` so mobile has no height constraint. No `overflow-x-auto` wrapper. |
| 2 | On mobile, each day row shows child custody cells on top and notes on second row below (SC2 / MOB-01b) | ✓ VERIFIED (code) / ? HUMAN for visual | Conditional `<tr className="max-sm:table-row sm:hidden">` rendered when `day.notes || notesOpenDates.has(day.date)` at line 310-329. PlusIcon add-notes affordance in `<td className="px-1 py-1 max-sm:table-cell sm:hidden">` at line 289-301. |
| 3 | Desktop single-row layout unchanged (SC3) | ✓ VERIFIED (code) / ? HUMAN for visual | `sm:hidden` on second-row `<tr>` hides it on desktop. Notes `<td>` retains `max-sm:hidden` (visible on sm+). `sm:overflow-y-auto` preserves desktop contained scroll. |
| 4 | StatsPanel appears below schedule table on all viewports (SC4 / MOB-05 positioning) | ✓ VERIFIED | `<StatsPanel days={days} parents={parents} />` rendered as JSX sibling at line 46 of schedule-with-realtime.tsx, AFTER `</ScheduleTable>` at line 45, inside `<RealtimeProvider>`. No `renderAbove` prop remains. |
| 5 | Statistics display in a 2-column grid on mobile (SC5 / MOB-05 grid) | ✓ VERIFIED (code) / ? HUMAN for visual | HTML `<table className="w-full">` with child-name column headers in `<thead>`, Father and Mother rows with per-child cells, separator, and Vapaa rows. No viewport-conditional logic — grid applies on all viewports per D-14. |
| 6 | D-14: Statistics panel renders as child-column grid on every viewport | ✓ VERIFIED | stats-panel.tsx L17: `<table className="w-full">` with thead child-name headers and tbody parent rows. No media query or breakpoint gating — same structure at all widths. |
| 7 | D-16: Per-child cells show day count line 1 and 'yksin N' muted sub-line on line 2 | ✓ VERIFIED | Lines 36-39 (father) and 47-50 (mother): `<div>{child.father} pv</div>` + `<div className="text-xs text-muted-foreground">yksin {child.soloFather}</div>`. |
| 8 | D-15: Horizontal separator between per-child rows and Vapaa rows | ✓ VERIFIED | Lines 54-58: `<tr><td colSpan={stats.childStats.length + 1} className="py-1"><div className="border-t" /></td></tr>`. |
| 9 | D-15: Vapaa rows span full grid width and show 'ParentName X pv (Y vkl)' in correct color | ✓ VERIFIED | Lines 60-69: `stats.parentFreeStats.map` with `colSpan={stats.childStats.length + 1}` and conditional `text-blue-700` / `text-rose-700`. Content: `{ps.parentName} {ps.childFreeDays} pv ({ps.childFreeWeekends} vkl)`. |
| 10 | D-05/D-13: renderAbove prop fully removed from both files | ✓ VERIFIED | `grep -n "renderAbove" schedule-table.tsx schedule-with-realtime.tsx` returns empty. Neither interface, destructuring, nor call site remains. |
| 11 | computeStats() logic untouched — only rendering modified | ✓ VERIFIED | `git log -- src/lib/schedule/stats.ts` shows last modification was phase 07 (feat) — no changes in phase 16. `npx vitest run src/lib/schedule/__tests__/stats.test.ts`: 6/6 pass. |
| 12 | D-03/D-01: Scroll container uses sm:overflow-y-auto sm:h-[calc(100svh-8rem)]; no h-[calc(100vh-8rem)] remains | ✓ VERIFIED | Line 221: `<div className="sm:overflow-y-auto sm:h-[calc(100svh-8rem)]">`. `grep -c "h-[calc(100vh-8rem)]"` returns 0. |

**Score:** 12/12 truths verified (code-level); 6 require human visual/interactive confirmation

### Deferred Items

None.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/schedule/stats-panel.tsx` | Child-column stats grid replacing prior flex-row layout; exports StatsPanel; contains `<table` | ✓ VERIFIED | 74 lines. `<table className="w-full">` present. `stats.childStats.map` called 3× (thead + father row + mother row). `stats.parentFreeStats.map` called once. `colSpan={stats.childStats.length + 1}` on separator and Vapaa rows. `text-blue-700` and `text-rose-700` both present. `mt-4` on outer container. No `flex items-center gap-4`. No `parentName = (` helper. |
| `src/components/schedule/schedule-table.tsx` | Mobile-reflowed table; exports ScheduleTable; contains `max-sm:hidden` | ✓ VERIFIED | 336 lines. `max-sm:hidden` present 2× (notes `<th>` line 236, notes `<td>` line 302). `min-w-[72px] sm:min-w-[90px]` on child columns. Sticky date `<th>` and `<td>`. `PlusIcon` imported and used. `notesOpenDates` state declared. Second-row `<tr className="max-sm:table-row sm:hidden">`. No `renderAbove`. |
| `src/components/schedule/schedule-with-realtime.tsx` | StatsPanel as sibling after ScheduleTable inside RealtimeProvider; no renderAbove | ✓ VERIFIED | 49 lines. `<StatsPanel days={days} parents={parents} />` at line 46, after `</ScheduleTable>` at line 45, inside `<RealtimeProvider>` block. Import retained on line 5. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| ScheduleTable scroll container | Page scroll on mobile / contained scroll on desktop | `sm:overflow-y-auto sm:h-[calc(100svh-8rem)]` | ✓ WIRED | Line 221 of schedule-table.tsx — exact string present once. |
| Mobile notes second-row `<tr>` | NotesCell editor | `(day.notes \|\| notesOpenDates.has(day.date))` condition; className `max-sm:table-row sm:hidden` | ✓ WIRED | Lines 310-329: condition at 310, tr class at 311, NotesCell with collapse-on-empty onSave at 312-328. |
| Add-notes PlusIcon button | notesOpenDates state | `onClick` sets `new Set(prev).add(day.date)` | ✓ WIRED | Line 293: `setNotesOpenDates(prev => new Set(prev).add(day.date))`. `style={{ touchAction: "manipulation" }}` present at line 296. |
| ScheduleWithRealtime | StatsPanel | JSX sibling after `<ScheduleTable />` within `<RealtimeProvider>` | ✓ WIRED | Line 46: `<StatsPanel days={days} parents={parents} />` immediately follows `</ScheduleTable>` at line 45. |
| stats.childStats | Per-child cell rendering | `.map()` inside Father and Mother `<tr>` rows | ✓ WIRED | stats-panel.tsx lines 34-39 (father) and 46-51 (mother): `stats.childStats.map((child) => ...)`. |
| stats.parentFreeStats | Vapaa rows | `.map()` producing one `<tr>` per parent | ✓ WIRED | stats-panel.tsx lines 60-69: `stats.parentFreeStats.map((ps) => ...)`. |
| computeStats | stats variable | `useMemo(() => computeStats(days, parents), [days, parents])` | ✓ WIRED | stats-panel.tsx line 13: exact pattern present. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| stats-panel.tsx | `stats` (childStats, parentFreeStats) | `computeStats(days, parents)` via useMemo | Yes — computeStats performs pure computation on the `days` prop passed from ScheduleWithRealtime which receives it from the database-backed server component | ✓ FLOWING |
| schedule-table.tsx | `days` | Props from ScheduleWithRealtime | Yes — same `days` state that drives the main table; no hardcoded empty values | ✓ FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED for visual/interactive checks (require running browser). TypeScript typecheck and unit tests run instead.

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles with no errors | `npx tsc --noEmit` | Exit 0, no output | ✓ PASS |
| computeStats unit tests pass | `npx vitest run src/lib/schedule/__tests__/stats.test.ts` | 6/6 tests passed | ✓ PASS |
| Structural markers in stats-panel.tsx | grep for `<table`, map counts, colSpan, color classes | All present as required | ✓ PASS |
| Structural markers in schedule-table.tsx | grep for scroll class, sticky classes, max-sm:hidden, PlusIcon, notesOpenDates | All present | ✓ PASS |
| renderAbove completely removed | `grep renderAbove` both files | Empty result | ✓ PASS |

### Probe Execution

No probes declared in PLAN files for this phase. Step 7c: N/A.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|------------|------------|-------------|--------|----------|
| MOB-01 | 16-02-PLAN | Schedule table fits 360–430px viewport without horizontal scrolling | ✓ SATISFIED | Notes column hidden via `max-sm:hidden`; child columns narrowed to `min-w-[72px]` on mobile; scroll container scoped to `sm:` breakpoint so mobile has full page scroll; sticky date column via `sticky left-0 z-10 bg-background`. |
| MOB-01b | 16-02-PLAN | Each day row on mobile shows child cells on top and notes text on a second row below; desktop layout unchanged | ✓ SATISFIED | Second-row `<tr className="max-sm:table-row sm:hidden">` with NotesCell rendered when notes or notesOpenDates set; PlusIcon affordance in mobile-only `<td className="max-sm:table-cell sm:hidden">`; desktop row unchanged. |
| MOB-05 | 16-01-PLAN, 16-02-PLAN | Statistics panel positioned below schedule table on all viewports; 2-column grid on mobile | ✓ SATISFIED | StatsPanel rendered as sibling after ScheduleTable inside RealtimeProvider (positioning); HTML table grid with child-name column headers applies on all viewports including mobile (grid structure). |

No orphaned requirements. All three phase requirements (MOB-01, MOB-01b, MOB-05) are covered by the two plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | No debt markers (TBD, FIXME, XXX), no stubs, no hardcoded empty returns found in any of the three modified files. |

iOS sticky check: `overflow-hidden` is absent from `schedule-table.tsx` (grep returned 0). Only `sm:overflow-y-auto` is used on the scroll container ancestor — consistent with RESEARCH.md Pattern 3 guidance. Clean.

**data-today note:** The attribute appears on both the main `<tr>` (line 255) and the sticky date `<td>` (line 260). The plan explicitly requires this dual placement so the sticky cell can display the yellow highlight via `data-[today=true]:bg-yellow-50`. The notes second-row `<tr>` does NOT carry `data-today`, preserving the auto-scroll selector behavior per Pitfall 6. This is correct, not an anti-pattern.

### Human Verification Required

All automated structural and logic checks pass. The following items require a rendered browser to confirm.

#### 1. No horizontal scroll at 360px

**Test:** Open the app in browser DevTools at 360px width. Navigate to the schedule view. Attempt to scroll horizontally.
**Expected:** The table fits completely within the viewport — no horizontal scrollbar and no content clipped beyond the viewport edge.
**Why human:** CSS min-width constraints and the absence of overflow-x cannot be verified without rendering; grep confirms classes are present but not their computed layout effect under the actual content.

#### 2. PlusIcon "add notes" affordance — tap behavior

**Test:** At 360px viewport, find a day with no notes. Tap the PlusIcon (+) button that appears in the main row.
**Expected:** A second row appears directly below that day containing a fully editable NotesCell. Typing and blurring saves the note. Clearing the note and blurring collapses the second row.
**Why human:** Touch events and conditional row visibility require a rendered browser; input focus behavior after programmatic state change cannot be grep-verified.

#### 3. Second-row notes visibility on mobile

**Test:** At 360px viewport, find a day that already has notes text.
**Expected:** The notes text appears on a second row directly below the main day row. The main row shows only the date and child custody cells — the notes column in the main row is invisible.
**Why human:** `max-sm:hidden` and `max-sm:table-row` CSS behavior requires rendering to confirm at the correct breakpoint.

#### 4. Desktop layout unchanged

**Test:** At ≥ 640px viewport, verify the schedule table layout.
**Expected:** Single-row layout with child custody cells and notes column side by side. Sticky thead works within the scroll container. No second-row notes visible. No PlusIcon button visible.
**Why human:** Layout regression from `sm:` prefixed classes requires visual inspection.

#### 5. StatsPanel positioned below table (visual)

**Test:** On any viewport, scroll the page/table.
**Expected:** The custody statistics panel appears below the schedule table content area — outside the scroll container, not trapped inside it.
**Why human:** Although the React tree position is code-verified (sibling after ScheduleTable inside RealtimeProvider), confirming that StatsPanel is visually below and outside the scroll container requires rendering.

#### 6. Statistics grid layout on mobile

**Test:** At 360px viewport, view the statistics panel below the schedule table.
**Expected:** Statistics show as a grid with child names as column headers, Isä (blue) and Äiti (rose) as row labels, day count on line 1 and "yksin N" (muted) on line 2 per cell, a separator line, and full-width Vapaa rows below. No horizontal overflow.
**Why human:** Grid layout correctness at narrow viewport requires visual confirmation.

---

## Gaps Summary

No gaps found. All 12 must-have truths are verified at the code level. All three requirement IDs (MOB-01, MOB-01b, MOB-05) are satisfied by the implementation. The phase status is `human_needed` because the Roadmap success criteria include visual and interactive behaviors (SC1: no horizontal scroll, SC2: mobile two-row notes UX, SC3: desktop layout unchanged, SC4: stats visually below table, SC5: stats grid on mobile) that cannot be confirmed without a rendered browser.

---

_Verified: 2026-05-20T20:20:00Z_
_Verifier: Claude (gsd-verifier)_
