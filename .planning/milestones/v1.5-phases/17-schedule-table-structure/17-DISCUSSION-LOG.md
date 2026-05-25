# Phase 17: Schedule Table Structure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-20
**Phase:** 17-schedule-table-structure
**Areas discussed:** Week row visual design, Desktop scroll side effects

---

## Week Row Visual Design

### Q1: What should happen to the existing h-px separator row?

| Option | Description | Selected |
|--------|-------------|----------|
| Replace it — week label row is the separator | The 'Viikko 21' row replaces the thin hairline; one row per week boundary; row can have a border | ✓ |
| Keep both — label row + separator below | Two rows at each week boundary; more breathing room but taller | |
| You decide | Claude picks | |

**User's choice:** Replace it — week label row is the separator

---

### Q2: How should the week label look inside the row?

| Option | Description | Selected |
|--------|-------------|----------|
| Label in date column only, border line across the rest | Date column: 'Viikko 21' text; other columns: horizontal border | |
| Full-width label spanning all columns | One colSpan cell across entire row, 'Viikko X' left-aligned; simpler | ✓ |
| You decide | Claude picks | |

**User's choice:** Full-width label spanning all columns

---

### Q3: Typography/color for 'Viikko 21'?

| Option | Description | Selected |
|--------|-------------|----------|
| Muted + small (text-xs text-muted-foreground) | Low-key, informational, unobtrusive; consistent with secondary labels | ✓ |
| Slightly bolder (text-sm font-medium text-foreground/60) | More prominent — clearly a section heading | |
| You decide | Claude picks | |

**User's choice:** Muted + small (text-xs text-muted-foreground)

---

### Q4: Show label for first week too, or only at week boundaries?

| Option | Description | Selected |
|--------|-------------|----------|
| Only at week boundaries — current behavior | Shown above Monday only when index > 0; first week has no label | |
| Every week — including the first week | Show 'Viikko X' above every Monday including first row | ✓ |

**User's choice:** Every week — including the first week

---

## Desktop Scroll Side Effects

### Q1: Auto-scroll to today on mount — what scroll position?

| Option | Description | Selected |
|--------|-------------|----------|
| Center today in the viewport on load | Same as current mobile; viewport scrolls so today is vertically centered | |
| No scroll on desktop — load at top of page | Remove auto-scroll on desktop; mobile keeps it | |
| You decide | Claude picks | |

**User's choice:** Free text — "it should scroll so that today's row is the first visible row (same on mobile and desktop)"
**Notes:** User wants `block: "start"` behavior (today = first visible row) consistently on both mobile and desktop. Planner should handle scroll-margin-top to account for sticky thead.

---

### Q2: Sticky thead on desktop after scroll container removal?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — thead sticks at viewport top once header scrolls away | Standard sticky table header behavior | ✓ |
| No — also make the app header sticky | Different scope; deferred | |

**User's choice:** Yes — thead sticks at viewport top once header scrolls away

---

### Q3: ExtendPanel and ClearPanel behavior with full-page scroll?

| Option | Description | Selected |
|--------|-------------|----------|
| Natural page flow is correct | They scroll with the page below the table | ✓ |
| You decide | Claude picks | |

**User's choice:** Natural page flow is correct

---

## Claude's Discretion

- **Week number source:** User skipped the "Week number computation" gray area. Claude decided: compute `getISOWeek(new Date(day.date))` from `date-fns` directly in the component — no changes to `ScheduleDay` type. Lightweight, no type propagation needed.

## Deferred Ideas

- **Sticky app header on desktop:** User confirmed current approach (header scrolls away, then thead sticks) is correct. Making the app header sticky is not in scope for Phase 17.
