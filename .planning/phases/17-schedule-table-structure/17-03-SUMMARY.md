---
plan: 17-03
phase: 17-schedule-table-structure
status: complete
completed: 2026-05-21
type: checkpoint
---

## Summary

Human visual verification checkpoint for Phase 17 (schedule-table-structure). Operator confirmed all four Phase 17 success criteria pass on desktop and mobile viewports.

## Verdict

**APPROVED** — all success criteria passed.

## Success Criteria Results

| Criterion | Description | Result |
|-----------|-------------|--------|
| SC-1 | `Viikko N` label appears above every Monday (including first), correct ISO week number, muted/small typography | ✓ PASS |
| SC-2 | Desktop full-page scroll — no separate inner scrollbar around the table | ✓ PASS |
| SC-3 | `<thead>` sticky at viewport top on desktop and mobile | ✓ PASS |
| SC-4 | Mobile scroll behavior unchanged from v1.4 | ✓ PASS |
| Today row | Today's row appears at top of visible area on load, not obscured by sticky thead | ✓ PASS |

## Viewports Tested

- Desktop (≥1024px)
- Mobile (≤430px)

## Follow-up Adjustments

None required. `scroll-mt-10` offset is correct — no adjustment to `scroll-mt-8` or `scroll-mt-12` needed.

## Self-Check

✓ PASSED — operator approval received, all SC-1 through SC-4 criteria confirmed.
