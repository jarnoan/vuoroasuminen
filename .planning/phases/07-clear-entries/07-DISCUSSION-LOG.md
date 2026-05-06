# Phase 7: Clear Entries - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-06
**Phase:** 07-clear-entries
**Areas discussed:** Draft vs immediate clear, Single cell clear trigger, Bulk clear UI

---

## Draft vs Immediate Clear

| Option | Description | Selected |
|--------|-------------|----------|
| Immediate (no draft for clear) | Cell disappears to — instantly. GCal delete queued for next publish. No schema change for clearing itself. | ✓ |
| Through draft (like toggling) | Cleared cell shows "cleared draft" state. Publishing makes it official. Needs nullable parentId in schema. | |

**User's choice:** Immediate — cell becomes — right away, no draft visual for the clear state.
**Notes:** GCal cleanup for published cells happens on next publish (consistent with existing sync trigger). Implementation note: DB row set to parentId = NULL rather than deleted, to preserve gcal_events link for sync. This is invisible to the user — visually identical to unassigned.

---

## GCal Cleanup Timing (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Next publish (Recommended) | GCal event stays until next Publish action. Consistent with existing sync model. | ✓ |
| Immediately on clear | GCal API fires on cell clear. Faster but adds latency outside publish flow. | |

**User's choice:** Next publish.
**Notes:** Consistent with how custody switches work — publish is always the sync trigger.

---

## Single Cell Clear Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Three-state toggle | Click cycles father → mother → unassigned → father. Same click target, no extra UI. | |
| Hover × button | × appears on hover/focus. Cell body click still toggles. Two distinct targets. | ✓ |
| Right-click context menu | Context menu with "Clear assignment". Poor on touch. | |

**User's choice:** Hover × button.
**Notes:** Main cell body still toggles (father ↔ mother). × button on hover clears to unassigned.

---

## Unassigned Cell Click Behavior (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — click — to assign (Recommended) | Clicking — assigns to father first, then toggle cycle continues. | ✓ |
| No — — stays inert | Only pre-existing cells are interactive. | |

**User's choice:** Yes — unassigned cells are clickable to assign.
**Notes:** Makes accidentally-cleared cells recoverable without extend. Assigns father first.

---

## Bulk Clear UI (CLEAR-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Inline panel below table (Recommended) | "× Tyhjennä päiväväli" button below table opens inline panel with date pickers. Same pattern as ExtendPanel. | ✓ |
| Toolbar button + modal | "× Tyhjennä" in ViewToolbar opens a Dialog. | |

**User's choice:** Inline panel below table.
**Notes:** Consistent with Phase 6 ExtendPanel pattern. Panel shows start/end date pickers and a live preview of how many days/children will be cleared.

---

## Post-Clear Navigation (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Stay in place | View stays at current scroll position. | ✓ |
| Navigate to cleared range | URL updates to ?viewStart=<range-start>. | |

**User's choice:** Stay in place.
**Notes:** Clearing differs from extending — the user is likely already looking at the range they want to clear.

---

## Claude's Discretion

- DB strategy: nullable parentId (not row deletion) to preserve gcal_events for GCal sync tracking
- Hover × button positioning and styling within the cell
- Server Action signatures and pending state handling
- Notes migration if clearing the notesEntryId holder
- Optimistic update strategy for bulk clear

## Deferred Ideas

None.
