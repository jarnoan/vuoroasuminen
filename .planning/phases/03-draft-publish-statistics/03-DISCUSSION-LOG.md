# Phase 3: Draft/Publish + Statistics - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-06
**Phase:** 03-draft-publish-statistics
**Areas discussed:** Publish scope, Confirmation dialog, Stats panel placement, Publish button location

---

## Publish Scope

| Option | Description | Selected |
|--------|-------------|----------|
| All drafts in the window | Every draft entry in the 84-row window gets published — past and future | ✓ |
| Today-and-forward only | Only draft entries from today onward get published | |
| User picks a date range | A date picker in the dialog lets the parent choose a from/to range | |

**User's choice:** All drafts in the window
**Notes:** Simple, predictable, matches "publish the plan" semantics.

---

## Confirmation Dialog

| Option | Description | Selected |
|--------|-------------|----------|
| Count + date range | "Publish 48 draft entries (6 Jan – 29 Mar)?" — clean and informative | ✓ |
| Simple yes/no only | "Publish draft? This cannot be undone." — minimal | |
| Per-child breakdown | Small table showing days per child per parent before committing | |

**User's choice:** Count + date range
**Notes:** Informative without being heavy.

---

## Stats Panel Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Above the table | Compact strip between header and table — always visible | ✓ |
| Collapsible panel | Toggleable section above or below the table | |
| Separate tab | Schedule tab and Statistics tab — zero space cost on schedule view | |

**User's choice:** Above the table
**Notes:** Always visible, no interaction needed to see the balance.

---

## Publish Button Location

| Option | Description | Selected |
|--------|-------------|----------|
| In the header | Right side of existing Header component | ✓ |
| Above the stats panel | Toolbar row between header and stats | |
| Floating button | Fixed bottom-right FAB | |

**User's choice:** In the header
**Notes:** Always visible while scrolling 84 rows.

---

## Claude's Discretion

- Exact Publish button label
- Whether draft count for dialog is computed server-side or from loaded client state
- Disabled vs hidden state for Publish button when no drafts exist
- Statistical formatting details

## Deferred Ideas

- Per-cell or per-week granular publish
- Undo / revert to draft
- Stats breakdown by month or school term (v2 EXPRT-02)
