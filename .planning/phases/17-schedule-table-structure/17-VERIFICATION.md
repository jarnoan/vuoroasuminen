---
phase: 17-schedule-table-structure
verified: 2026-05-21T08:40:00Z
status: human_needed
score: 9/9 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open the app on a desktop viewport (>=1024px) and confirm the 'Viikko N' label appears above every Monday including the first week, with correct ISO week numbers and muted/small typography"
    expected: "Every Monday has a 'Viikko N' row above it (including the first visible Monday); the number matches the ISO week number for that date; the text is visually small and muted"
    why_human: "Correct week-number computation and visual styling cannot be confirmed by source inspection alone — rendering and ISO week math must be verified against a real calendar reference"
  - test: "On desktop, scroll the page and confirm only the page scrollbar moves (no separate inner scrollbar around the table); confirm the <thead> stays sticky as the page scrolls past the table"
    expected: "One page-level scrollbar; thead sticks to viewport top; ExtendPanel and ClearPanel scroll naturally below the table"
    why_human: "CSS overflow behavior and sticky positioning require live browser inspection to confirm — grep cannot detect rendering behavior"
  - test: "Reload the page on desktop and confirm today's row appears near the top of the visible area (not centered), and is not obscured by the sticky thead"
    expected: "Today's highlighted row is visible below the thead on initial load; scroll-mt-10 offset prevents overlap"
    why_human: "Auto-scroll behavior and scroll-margin-top compensation can only be confirmed by visual inspection in a running browser"
  - test: "Resize to a mobile viewport (<=430px) and confirm scroll behavior is unchanged from v1.4 (page scrolls as one unit, thead sticky, Viikko labels visible)"
    expected: "Mobile scroll is full-page; thead sticky; week labels render on mobile the same as desktop"
    why_human: "Mobile viewport behavior requires browser DevTools or physical device inspection"
---

# Phase 17: Schedule Table Structure — Verification Report

**Phase Goal:** Replace the ScheduleTable's hairline week separator with a "Viikko N" week label row (UI-01) and convert the desktop layout to full-page scroll (UI-02), removing the inner scroll container while keeping the sticky thead and updating the auto-scroll-to-today behavior.
**Verified:** 2026-05-21T08:40:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | A 'Viikko X' label row appears above every Monday in the view, including the first week | VERIFIED | Line 278-287: `{day.isWeekStart && (<tr><td colSpan={colCount} className="px-3 pt-3 pb-1 text-xs text-muted-foreground">Viikko {getISOWeek(new Date(day.date))}</td></tr>)}` — no `index > 0` guard |
| 2  | The existing hairline separator row (h-px bg-border) is gone — the label row IS the separator | VERIFIED | `grep -n 'h-px bg-border'` returns no matches; confirmed absent from file |
| 3  | The week number is the ISO week number computed from day.date via date-fns getISOWeek | VERIFIED | Line 6: `import { getISOWeek } from "date-fns"`; Line 284: `getISOWeek(new Date(day.date))` |
| 4  | The label uses muted, small typography consistent with other secondary labels | VERIFIED | Line 282: `className="px-3 pt-3 pb-1 text-xs text-muted-foreground"` — matches plan spec exactly |
| 5  | On desktop (sm and above), the schedule table no longer has an inner scroll container — page scrolls instead | VERIFIED | Line 255: `<div>` with no className; `sm:overflow-y-auto` and `sm:h-[calc(100svh-8rem)]` both absent from file |
| 6  | The thead remains sticky to the viewport top on both mobile and desktop | VERIFIED | Line 257: `<thead className="sticky top-0 z-10 bg-background">` — unchanged from pre-phase state |
| 7  | On mount, today's row scrolls to the top of the visible area with scroll-margin-top offsetting the sticky thead height | VERIFIED | Line 89: `todayRow.scrollIntoView({ behavior: "instant", block: "start" })`; Line 291: `className={day.isToday ? "bg-yellow-50 dark:bg-yellow-950/20 scroll-mt-10" : "scroll-mt-10"}` |
| 8  | On mobile, scroll behavior is unchanged (was already full-page scroll) | VERIFIED | The removed classes (`sm:overflow-y-auto`, `sm:h-[calc(...)]`) were `sm:` breakpoint classes inactive at mobile; no mobile-specific class was added or removed |
| 9  | Plan 03 human-verify checkpoint: operator confirmed SC-1 through SC-4 pass | VERIFIED | 17-03-SUMMARY.md records "APPROVED — all success criteria passed" with SC-1/SC-2/SC-3/SC-4 all marked PASS on desktop and mobile viewports |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/schedule/schedule-table.tsx` | Week label row rendered when day.isWeekStart is true; wrapper div with no overflow/height classes; auto-scroll useEffect with block:start; today tr with scroll-mt-* class | VERIFIED | All four contracts confirmed at lines 278-287, 255, 89, 291 respectively |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| schedule-table.tsx | date-fns getISOWeek | named import `import { getISOWeek } from "date-fns"` | VERIFIED | Line 6 — exact pattern matches plan spec |
| schedule-table.tsx week-label tr | day.isWeekStart and day.date | JSX conditional + getISOWeek(new Date(day.date)) | VERIFIED | Lines 278, 284 — isWeekStart gate present, no index > 0 guard |
| schedule-table.tsx wrapper div | page scroll on desktop | absence of sm:overflow-y-auto / sm:h-[calc(...)] | VERIFIED | `grep -nE 'sm:overflow-y-auto'` returns no match; `grep -nE 'sm:h-\[calc'` returns no match |
| schedule-table.tsx useEffect auto-scroll | today's tr via document.querySelector('[data-today="true"]') | scrollIntoView with block:start | VERIFIED | Line 89: `block: "start"` confirmed; `block: "center"` absent |
| today tr | sticky thead offset compensation | scroll-mt-10 Tailwind class | VERIFIED | Line 291: both branches of className conditional include `scroll-mt-10` |

### Data-Flow Trace (Level 4)

The week label row renders `getISOWeek(new Date(day.date))` — a pure computation from `day.date`, which is a server-fetched `ScheduleDay.date` field. No stub or hardcoded values involved. The date flows from the server through the existing `days` prop; `getISOWeek` is a deterministic arithmetic function. No hollow-prop risk.

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| schedule-table.tsx week label | day.date | Server-fetched ScheduleDay array via `days` prop | Yes — existing data field, pure arithmetic | FLOWING |
| schedule-table.tsx scroll behavior | DOM layout | CSS class removal (no data source needed) | N/A — layout-only change | N/A |

### Behavioral Spot-Checks

Step 7b skipped for layout-only changes (UI-01 and UI-02 are rendering/CSS changes with no runnable API or CLI entry point to spot-check without a live browser).

### Probe Execution

No probes defined or applicable for this phase (rendering/layout changes only).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| UI-01 | 17-01-PLAN.md | User sees a week number label row above each Monday in the schedule table (e.g. "Viikko 21") | SATISFIED | `getISOWeek` import at line 6; week label `<tr>` at lines 278-287; hairline separator absent |
| UI-02 | 17-02-PLAN.md | On desktop, the entire page scrolls — the schedule table has no separate scroll container; sticky thead behaves the same as on mobile | SATISFIED | Wrapper `<div>` has no className (line 255); inner-scroll classes absent; `block: "start"` at line 89; `scroll-mt-10` at line 291 |

No orphaned requirements found. REQUIREMENTS.md maps UI-01 and UI-02 to Phase 17 — both are covered.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| schedule-table.tsx | 110 | Revert logic in `handleToggle` hardcodes inverse parentId instead of capturing prior state | Warning | Pre-existing pattern in the file; not introduced by this phase; documented in 17-REVIEW.md as CR-01 |
| schedule-table.tsx | 93 | `notesOpenDates` Set never cleared when `days` changes | Warning | Pre-existing; documented in 17-REVIEW.md as WR-04 |

No TBD, FIXME, or XXX debt markers found in the modified file. The two warnings above are pre-existing issues documented in the code review (17-REVIEW.md) and not introduced by Phase 17's changes. They do not affect the phase goal.

### Human Verification Required

The operator approved SC-1 through SC-4 in 17-03-SUMMARY.md. That summary records a human pass/fail verdict. However, the Plan 03 checkpoint is a `type: checkpoint` plan whose `autonomous: false` flag means the executor is required to pause and wait for human input. The SUMMARY records the approval, but the ROADMAP still marks 17-03-PLAN.md as `[ ]` (unchecked). The automated code checks are all VERIFIED. Visual behavior requires human confirmation — recorded here for completeness, even though the operator already approved in the SUMMARY.

#### 1. Week Label Visual Correctness (SC-1)

**Test:** Open the schedule on desktop; verify "Viikko N" appears above every Monday (including the first), with the correct ISO week number and muted/small typography.
**Expected:** Every Monday row is preceded by a "Viikko N" label row; N matches ISO week for that date; text is visually small and muted.
**Why human:** Rendering and ISO week arithmetic require live browser verification against a calendar reference.

#### 2. Desktop Full-Page Scroll (SC-2)

**Test:** On desktop, scroll the schedule page and confirm only the page scrollbar is active — no separate inner scroll container around the table.
**Expected:** Page scrolls as one unit; ExtendPanel and ClearPanel scroll naturally below the table; no dual-scrollbar appearance.
**Why human:** CSS overflow behavior requires live browser inspection.

#### 3. Sticky Thead on Desktop and Mobile (SC-3)

**Test:** On desktop and mobile, scroll past the table's first row and confirm thead sticks to viewport top.
**Expected:** Thead remains visible and stuck to the top of the viewport until the table scrolls fully out of view.
**Why human:** `position: sticky` behavior and potential ancestor overflow conflicts can only be confirmed visually.

#### 4. Mobile Scroll Unchanged (SC-4)

**Test:** On mobile viewport (<=430px), confirm page scrolls as one unit and thead is sticky.
**Expected:** Mobile behavior matches v1.4 (full-page scroll was already active at mobile breakpoints).
**Why human:** Mobile viewport CSS behavior requires DevTools or physical device.

#### 5. Today Row Positioning (D-07)

**Test:** Reload the page; confirm today's row is visible at the top of the visible area and not obscured by the sticky thead.
**Expected:** scroll-mt-10 offset (40px) correctly compensates for thead height; today row fully visible below thead.
**Why human:** scroll-margin-top compensation can only be confirmed visually across different viewport sizes.

*Note: The operator already provided approval for all items above in 17-03-SUMMARY.md. These human-verification items are listed here because Plan 03 is marked `autonomous: false` and `blocking`, meaning the GSD workflow requires explicit human sign-off before the phase is considered closed.*

### Gaps Summary

No automated gaps found. All 9 observable truths are VERIFIED in the codebase. All must-have artifacts exist, are substantive, and are wired. Both requirement IDs (UI-01, UI-02) are covered. No debt markers introduced by this phase.

The `human_needed` status is driven by Plan 03 being a blocking human-verify checkpoint (`autonomous: false`, `gate: blocking`) per the GSD workflow. The operator approved in 17-03-SUMMARY.md, but that approval is recorded in a SUMMARY file, not through the automated verification pipeline. The human verification items above capture what the operator needs to confirm (or has already confirmed) before the phase is formally closed.

---

_Verified: 2026-05-21T08:40:00Z_
_Verifier: Claude (gsd-verifier)_
