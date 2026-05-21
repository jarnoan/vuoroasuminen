# Phase 18: Mobile Cell and Note Interactions - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-21
**Phase:** 18-mobile-cell-and-note-interactions
**Areas discussed:** Tyhjennä cell style, Note row attribution, Hold feedback

---

## Tyhjennä Cell Style

| Option | Description | Selected |
|--------|-------------|----------|
| Red/destructive | Cell turns red with white 'Tyhjennä' text — strong visual warning | ✓ |
| Dark overlay on parent color | Cell keeps parent color but darkens (bg-black/40) and shows 'Tyhjennä' text | |
| Neutral/muted | Cell changes to muted/gray background | |

**User's choice:** Red/destructive

---

| Option | Description | Selected |
|--------|-------------|----------|
| Tap anywhere clears | Armed cell is one big button — tap anywhere triggers onClear | ✓ |
| Tap clears only if held briefly | Short hold on armed cell confirms | |

**User's choice:** Tap anywhere clears

---

| Option | Description | Selected |
|--------|-------------|----------|
| Mobile only (max-sm) | Desktop keeps corner × on hover | |
| Large touch screens too | Freeform: long-press support on tablets/large touch screens, but not when hovered | ✓ |

**User's choice:** Freeform — "for large touch screens / tablets with no hover it would be good to have that long press support too. maybe don't do that when hovered?"
**Notes:** Led to using `@media (hover: none)` instead of `max-sm` breakpoint. Hover devices keep corner ×; no-hover devices (phones + tablets) get full-cell Tyhjennä.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Corner × on hover, long-press ignored on mouse devices | Clean separation | ✓ |
| Corner × on hover + long-press also works on mouse devices | Consistent everywhere | |

**User's choice:** Corner × on hover, long-press ignored on mouse devices

---

## Note Row Attribution

| Option | Description | Selected |
|--------|-------------|----------|
| Zero gap (remove top spacing) | Note row directly attached to day row, no dividing line | ✓ |
| Left border accent | Muted left border on note row | |
| Background tint | Slightly different background color | |
| You decide | Claude picks approach | |

**User's choice:** Zero gap

---

| Option | Description | Selected |
|--------|-------------|----------|
| Slightly indented | pl-8 or pl-10 left padding, appears nested | ✓ |
| Full-width (no change) | Note input stays left-aligned | |

**User's choice:** Slightly indented

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — remove day row bottom border when note row follows | Day+note form one visual unit | ✓ |
| No — keep existing border | Simpler | |

**User's choice:** Yes — remove day row bottom border when note row follows

---

## Hold Feedback

| Option | Description | Selected |
|--------|-------------|----------|
| No feedback — instant arm | Cell transforms suddenly at 1s | |
| Subtle opacity pulse | Cell gently dims/pulses | |
| Scale down slightly | CSS transform scale | |
| Freeform | Other approach | ✓ |

**User's choice:** Freeform — "it should fade to red (or whatever is the armed colour)"
**Notes:** Cell fades from parent color to red over the 1s hold duration via CSS transition. Not one of the preset options.

---

| Option | Description | Selected |
|--------|-------------|----------|
| CSS transition on background | Transition class on pointerdown, reverses on cancel | ✓ |
| JS opacity/color via timer | Progress value updated every ~100ms | |

**User's choice:** CSS transition on background

---

| Option | Description | Selected |
|--------|-------------|----------|
| Fade back (CSS transition reverses) | Smooth reverse on cancel | |
| Snap back instantly | Remove transition class, jumps back | ✓ |

**User's choice:** Snap back instantly
**Notes:** Deliberate preference — avoids lingering red tint from partial holds.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Only on full arm | Parent name shows during fade, 'Tyhjennä' appears at 1s | ✓ |
| Fade in alongside background | Text cross-fades with color | |

**User's choice:** Only on full arm

---

## Claude's Discretion

- Exact lucide-react icon name for pen (Pencil / PenLine / Pen)
- Exact left-padding value for note row indentation
- CSS class names / Tailwind variants for the red fade transition
- Whether isHolding is a separate state or ref-driven

## Deferred Ideas

None.
