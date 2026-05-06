# Phase 6: Extend Schedule - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-05
**Phase:** 06-extend-schedule
**Areas discussed:** Entry point & confirm flow, Range input UI, Post-extend navigation

---

## Entry Point

| Option | Description | Selected |
|--------|-------------|----------|
| ViewToolbar button | Add '+ Lisää viikkoja' to existing toolbar row | |
| Below the table | Standalone button anchored below last schedule row | ✓ |

**User's choice:** Below the table
**Notes:** Visually attached to where new weeks will appear — more intuitive than toolbar.

---

## Confirm Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Inline expand below button | Reveals panel below the button with input + date preview + Confirm/Cancel | ✓ |
| Dialog / modal | Opens shadcn Dialog with the same content | |

**User's choice:** Inline expand (no modal)
**Notes:** Stays in context, no overlay friction.

---

## Range Input UI

| Option | Description | Selected |
|--------|-------------|----------|
| Number input + date picker toggle | Default: number input (12 weeks). Toggle link swaps to date picker mode. | ✓ |
| Number input only | Weeks only, EXTEND-03 deferred | |
| Date picker only | Always pick explicit end date | |

**User's choice:** Number input + date picker toggle
**Notes:** Both EXTEND-01 and EXTEND-03 satisfied. One mode shown at a time, toggle link switches between them.

---

## Post-Extend Navigation

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-navigate to new weeks | View jumps to first new week via router.replace() | ✓ |
| Stay in place | View stays, user navigates manually | |

**User's choice:** Auto-navigate
**Notes:** URL updates to `?viewStart=<new-start>`. User immediately sees what was created.

---

## Claude's Discretion

- Server Action for DB insert
- Conflict handling: `onConflictDoNothing`
- Inline panel styling
- Week count input element type
- End-of-week snap to Sunday for date picker mode
- Loading/pending state during Server Action

## Deferred Ideas

None.
