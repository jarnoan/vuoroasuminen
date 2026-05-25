---
phase: 19-stats-column-alignment
verified: 2026-05-25T00:00:00Z
status: human_needed
score: 4/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Confirm child column alignment at 360px viewport with WR-01 colgroup discrepancy present"
    expected: "Each child column in StatsPanel aligns within ~2px of the corresponding child column in ScheduleTable at 360px"
    why_human: "stats-panel.tsx uses max-sm:w-0 for the notes col while schedule-table.tsx uses max-sm:w-8 — a 32px difference on viewports below 640px. The code-level mismatch is observable; only visual inspection confirms whether child column edges still align despite this difference. The operator UAT (50a8999) pre-dates the code review that surfaced WR-01, so it cannot be treated as evidence that the mismatch is harmless."
---

# Phase 19: Stats Column Alignment Verification Report

**Phase Goal:** Stats panel columns align with schedule table columns so the layout is visually coherent when both are on screen (UI-06)
**Verified:** 2026-05-25
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | StatsPanel child columns are the same width as ScheduleTable child columns | ✓ VERIFIED | stats-panel.tsx lines 30, 43, 55 all carry `min-w-[72px] sm:min-w-[90px]`; `tableLayout: "fixed"` on line 17; colgroup structure mirrors schedule-table |
| 2 | Alignment holds at 360px (mobile) viewport | ? UNCERTAIN | Code-level discrepancy WR-01: stats-panel notes col is `max-sm:w-0 sm:w-40` (line 23); schedule-table notes col is `max-sm:w-8 sm:w-40` (line 279). On viewports below 640px schedule-table allocates 32px to the notes col that stats-panel collapses to 0px. This shifts column boundaries and may cause child column misalignment at mobile. Operator UAT recorded "approved" (commit 50a8999) but the fix commit (2af60b7) that introduced `max-sm:w-0` was committed before the UAT, so the operator tested this exact code. The post-phase code review (3502cea) then flagged it as WR-01. Requires a new targeted check with the mismatch in mind. |
| 3 | Alignment holds at 1280px (desktop) viewport | ✓ VERIFIED | At sm and above, both components use `sm:w-40` for the notes col — the discrepancy only applies below 640px. Operator UAT confirmed desktop alignment. |
| 4 | StatsPanel label column uses the same horizontal padding as ScheduleTable date column | ✓ VERIFIED | stats-panel.tsx label `<th>` (line 28), father `<td>` (line 39), mother `<td>` (line 51) all use `px-3`, matching ScheduleTable date column `px-3` |
| 5 | Wrapper horizontal padding removed so StatsPanel table fills same width as ScheduleTable | ✓ VERIFIED | stats-panel.tsx line 16: `border rounded-lg py-3 mt-4 bg-muted/30 text-sm` — `p-3` replaced with `py-3` |

**Score:** 4/5 truths verified (1 uncertain)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/schedule/stats-panel.tsx` | StatsPanel with fixed table layout and matching child column widths | ✓ VERIFIED | Exists, substantive, wired. Contains `tableLayout: "fixed"`, `<colgroup>`, `min-w-[72px] sm:min-w-[90px]` on child `<th>` and `<td>`, `px-3` on label cells, `py-3` wrapper. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `stats-panel.tsx` child column `<th>`/`<td>` | `schedule-table.tsx` child column `<th>`/`<td>` | Replicated `min-w-[72px] sm:min-w-[90px]` classes | ✓ WIRED | Pattern confirmed in stats-panel.tsx lines 30, 43, 55 |
| `stats-panel.tsx` colgroup notes col | `schedule-table.tsx` colgroup notes col | `max-sm:w-0 sm:w-40` vs `max-sm:w-8 sm:w-40` | ⚠️ PARTIAL | Mobile width differs by 32px (0 vs 32px); desktop widths match |

### Data-Flow Trace (Level 4)

Not applicable. This is a CSS/layout-only change. StatsPanel renders dynamic data via `computeStats` which was unchanged; its data pipeline was not modified by this phase.

### Behavioral Spot-Checks

Step 7b: SKIPPED — column alignment is a purely visual behavior that cannot be verified by command-line output. The server must be running and a browser must inspect the rendered layout.

### Probe Execution

No probes declared in PLAN.md. No `scripts/*/tests/probe-*.sh` files exist for this phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| UI-06 | 19-01-PLAN.md, 19-02-PLAN.md | Stats panel child columns are aligned with the same child columns in the schedule table above (same widths) | ✓ SATISFIED at desktop; ? UNCERTAIN at mobile | Code changes complete; desktop alignment confirmed by operator UAT; mobile alignment uncertain due to WR-01 colgroup discrepancy |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/schedule/stats-panel.tsx` | 23 | `max-sm:w-0 sm:w-40` vs schedule-table `max-sm:w-8 sm:w-40` | ⚠️ Warning | On viewports < 640px the notes column in stats-panel is 32px narrower than in schedule-table. This shifts the right edge of all child columns and may prevent precise alignment at 360px. |

No debt markers (TBD, FIXME, XXX) found in modified files.

### Human Verification Required

#### 1. Mobile Alignment with WR-01 Present

**Test:** Open the app in a browser at 360px viewport width. Scroll until both ScheduleTable and StatsPanel are visible simultaneously. Draw an imaginary vertical line from the left edge of each child column header in ScheduleTable downward. Verify the left edge of the matching child column in StatsPanel is on the same line (within ~2px). Repeat for the right edge.

**Expected:** Child column edges in StatsPanel align with corresponding edges in ScheduleTable within ~2px tolerance despite the notes col width difference (`max-sm:w-0` vs `max-sm:w-8`). The alignment holds because the ghost col (`max-sm:w-0`) absorbs the slack.

**Why human:** The colgroup mismatch (WR-01 in 19-REVIEW.md) is a measurable code discrepancy. The operator UAT at commit 50a8999 approved alignment visually, but the code review (3502cea) was written after UAT and explicitly flags this as a warning. A targeted re-check is needed to determine whether the WR-01 mismatch is visually consequential or absorbed by the table layout engine.

### Gaps Summary

No hard blockers found. One observable code discrepancy exists (WR-01): stats-panel.tsx line 23 uses `max-sm:w-0` for the notes col while schedule-table.tsx line 279 uses `max-sm:w-8`. This 32px difference on narrow viewports is the only concern against SC-1/SC-3 at 360px. The post-phase code review (19-REVIEW.md) already flags it as a warning. The operator UAT approved visual alignment after this code was in place, but a targeted mobile re-check is warranted to confirm that the approval was made while observing the correct behavior, not a layout coincidence.

If the human check passes (child columns align within ~2px at 360px), status upgrades to `passed`. If columns are misaligned, the fix is straightforward: change line 23 of stats-panel.tsx from `max-sm:w-0 sm:w-40` to `max-sm:w-8 sm:w-40`.

---

_Verified: 2026-05-25_
_Verifier: Claude (gsd-verifier)_
