---
slug: child-columns-drift-stats
status: resolved
trigger: "child columns still don't align in schedule table and stats table"
created: 2026-05-24
updated: 2026-05-24
---

## Symptoms

- **Expected:** Each child column lines up exactly between both tables — the child name columns in the stats panel match column widths pixel-for-pixel with the schedule grid
- **Actual:** First column aligns but others drift — alignment is correct at the start but accumulates error across columns
- **Error messages:** None — purely visual layout misalignment
- **Timeline:** Phase 19-01 (stats-column-alignment) was supposed to fix this but the issue persists after the fix
- **Reproduction:** Open the app in a browser and observe the schedule table and stats panel — the column headers for child names in the stats panel visually drift from the corresponding columns in the schedule table

## Current Focus

hypothesis: "stats-panel colgroup has a trailing <col> with no corresponding cell, consuming width that shifts child columns narrower than schedule-table"
test: "remove trailing col from stats-panel colgroup and verify alignment"
expecting: "child columns align pixel-for-pixel after removing phantom trailing col"
next_action: "apply fix"
reasoning_checkpoint: "Both tables use table-layout:fixed with matching colgroup structure (label 104px + N auto children + 1 responsive trailing col). But stats-panel thead and tbody only render N+1 cells (label + N children) — no cell fills the trailing col. This phantom col eats width from the child columns, making them narrower than the schedule-table's child columns which properly have a notes cell consuming the trailing col space. Result: first child column aligns because both tables share the same 104px label col, but subsequent child columns accumulate drift because the effective per-child width differs."

## Evidence

- timestamp: 2026-05-24T00:00:00Z
  file: src/components/schedule/schedule-table.tsx
  finding: "colgroup has 3 cols: col[104px] + N child cols (auto) + col[responsive notes]. thead has 3 ths: label + N children + notes (max-sm:hidden). tbody data rows have 4 tds: label + N children + mobile-pencil (max-sm:table-cell sm:hidden) + desktop-notes (max-sm:hidden). The 4th td has no corresponding colgroup entry — it falls into the last defined col."

- timestamp: 2026-05-24T00:00:00Z
  file: src/components/schedule/stats-panel.tsx
  finding: "colgroup has 3 cols: col[104px] + N child cols (auto) + col[responsive trailing]. But stats-panel thead has only 1+N ths (label + N children). All stats-panel tbody data rows have 1+N tds only. The trailing col in colgroup has NO corresponding cell in any row — it consumes width silently, making child cols narrower than schedule-table's child cols."

- timestamp: 2026-05-24T00:00:00Z
  analysis: "The fix applied in phase 19-01 correctly set table-layout:fixed on both tables and set the label col to 104px on both. But it copied the full 3-col colgroup structure to stats-panel without recognising that the stats-panel has no notes column and therefore the trailing <col> has no corresponding <td>. This phantom col shifts all child column widths downward and causes drift."

## Eliminated

- table-layout:fixed missing from one table — both tables now have it
- label col width mismatch — both use 104px for the label col

## Resolution

root_cause: "schedule-table data rows have 6 tds (date + N children + mobile-pencil[sm:hidden] + notes), but colgroup only has 5 entries; the browser creates an implicit 6th column slot, distributing auto width across 4 slots (children + ghost), giving each child col (1678-264)/4=353.5px. stats-panel had only N+1 colgroup entries with 3 auto cols, giving each child (1678-264)/3=471px — causing drift from the second column onward. Additionally stats-panel label col had no explicit 104px width."
fix: "stats-panel.tsx colgroup: (1) set label col to 104px, (2) add col[max-sm:w-8 sm:w-40] to mirror schedule-table's notes col, (3) add trailing auto col to mirror schedule-table's ghost col. colSpan on separator/vapaa rows updated from +1 to +3 to cover all 6 colgroup entries."
verification: "browser measurement confirmed child col positions: schedule Eino left=474/Hilla left=827 matches stats Eino left=474/Hilla left=827; Taimi 1px off (16 vs 17) due to stats panel border — acceptable"
files_changed:
  - src/components/schedule/stats-panel.tsx
