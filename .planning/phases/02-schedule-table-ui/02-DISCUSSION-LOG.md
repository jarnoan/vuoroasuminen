# Phase 2: Schedule Table UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 02-schedule-table-ui
**Areas discussed:** Table layout & navigation, Cell interaction, Draft vs published visuals, Notes UX

---

## Table Layout & Navigation

| Option | Description | Selected |
|--------|-------------|----------|
| Vertical scroll, sticky header row | Column headers fixed at top; 84 rows scroll down | ✓ |
| Vertical scroll, sticky date column | Date column fixed; scroll right for children | |
| Week accordion / grouped sections | 12 collapsible week sections | |

**User's choice:** Vertical scroll, sticky header row

| Option | Description | Selected |
|--------|-------------|----------|
| Week separators + jump-to-today | Bold/shaded week dividers + Today button/auto-scroll | ✓ |
| Week separators only | Visual breaks but no jump-to-today | |
| Neither — flat list | Uniform rows, no grouping | |

**User's choice:** Week separators + jump-to-today

---

## Cell Interaction

| Option | Description | Selected |
|--------|-------------|----------|
| Click to toggle | One click flips father↔mother; no extra UI | ✓ |
| Click to open popover | Clicking opens a small popover with options | |
| Dropdown select | Cell renders as a select/combobox | |

**User's choice:** Click to toggle

| Option | Description | Selected |
|--------|-------------|----------|
| Optimistic update + background save | Cell flips immediately; Server Action in background; revert on failure | ✓ |
| Loading state on save | Spinner while Server Action completes | |
| You decide | Leave to Claude | |

**User's choice:** Optimistic update + background save

---

## Draft vs Published Visuals

| Option | Description | Selected |
|--------|-------------|----------|
| Muted/desaturated color | Published = full color; draft = same hue washed-out | ✓ |
| Dotted border + label | Dashed border and tiny 'draft' badge | |
| Striped/hatched background | Diagonal stripes overlaid on color | |

**User's choice:** Muted/desaturated color

---

## Notes UX

| Option | Description | Selected |
|--------|-------------|----------|
| Inline editable text cell | Regular table cell with input; click to edit in place | ✓ |
| Icon badge → popover | Note icon; click opens popover textarea | |

**User's choice:** Inline editable text cell

| Option | Description | Selected |
|--------|-------------|----------|
| Save on blur | Auto-save when focus leaves cell | ✓ |
| Save on Enter / explicit button | User presses Enter or clicks checkmark | |
| You decide | Leave to Claude | |

**User's choice:** Save on blur

---

## Claude's Discretion

- Date column format (locale display)
- Row height and column widths
- Color tokens for father/mother (exact hues and muted variants)
- Supabase Realtime subscription setup details
- Pre-fill trigger logic for alternating-week seeding
- Toast library/approach for optimistic update error feedback

## Deferred Ideas

- Publish/approve button — Phase 3
- Statistics panel — Phase 3
- Google Calendar sync — Phase 4
- Keyboard cell navigation — future enhancement
- Bulk/drag multi-cell edit — future enhancement
