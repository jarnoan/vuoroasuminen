# Phase 15: Header, Clear Guard, and Toolbar - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-19
**Phase:** 15-header-clear-guard-and-toolbar
**Areas discussed:** Clear guard (MOB-02), Header (MOB-04), Date pickers (MOB-03), Toolbar layout (MOB-03a)

---

## Clear Guard (MOB-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Inline 2-tap toggle | First tap arms ×, second tap fires onClear, 2s timeout | |
| AlertDialog modal | Tap × opens modal with Peruuta/Vahvista buttons | |
| Always-visible ×, no confirmation | × always visible on mobile, single tap fires | |
| **Long-press + 2-tap** | Long-press cell (>1s) arms ×, tap × to confirm, 2s auto-disarm | ✓ |

**User's choice:** Inline 2-tap toggle variant but requiring long press (>1s) as the first trigger. Long-press on the CELL (not the ×) arms the × button. Tap × to confirm. 2 second timeout then auto-disarm. Desktop unchanged.

**Notes:** User specifically called out the ROADMAP success criterion 2: "a long-press reveals a clear option that requires a second deliberate action to confirm". STATE.md had logged AlertDialog as the approach based on research, but user prefers the long-press + inline × sequence from the original roadmap.

---

## Header (MOB-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Avatar + icon-only sign-out | Title + name hide, avatar stays, sign-out = LogOut icon | ✓ |
| Avatar + name truncated + icon-only sign-out | Title hides, name truncates to ~80px | |
| Title only + icon-only sign-out | No avatar on mobile, title stays | |

**User's choice:** Avatar stays, name and title hide, sign-out becomes icon-only (LogOut from lucide-react).

| Avatar fallback option | Description | Selected |
|------------------------|-------------|----------|
| First initial in circle | Colored div with first initial | ✓ |
| Nothing | Sign-out icon only | |
| Generic person icon | lucide UserCircle | |

**User's choice:** First initial in a colored circle as avatar fallback.

---

## Date Pickers (MOB-03)

| Option | Description | Selected |
|--------|-------------|----------|
| ViewToolbar only | Only toolbar date picker gets native input on mobile | |
| ViewToolbar + ClearPanel both | Both toolbar and ClearPanel's start/end date pickers | ✓ |
| Skip native input | Keep Calendar popover everywhere, rely on CSS | |

**User's choice:** Both ViewToolbar and ClearPanel get native `<input type="date">` on mobile.

| Implementation option | Description | Selected |
|----------------------|-------------|----------|
| CSS toggle (render both) | Native input sm:hidden + Calendar popover hidden sm:flex | ✓ |
| useMediaQuery | Conditionally render one or the other in JS | |

**User's choice:** CSS toggle — render both elements, CSS controls visibility. No JS media query, no hydration flash.

---

## Toolbar Layout (MOB-03a)

| Option | Description | Selected |
|--------|-------------|----------|
| All three, "Tänään" keeps text | Prev → icon, date → native input, Tänään = text | ✓ |
| All three icon-only | Every button icon-only including Tänään | |
| Two rows on mobile | Prev + Tänään top, date input full-width bottom row | |

**User's choice:** Prev week → chevron-left icon, date picker replaced by native input, "Tänään" keeps its text (fits at 6 chars on 360px).

---

## Claude's Discretion

- Long-press detection implementation (pointerdown + setTimeout vs useLongPress hook)
- Whether ConfirmClearButton is extracted as a separate file
- Exact color scheme for first-initial avatar circle
- touch-action: manipulation inclusion timing

## Deferred Ideas

- Safe area insets — add if iPhone QA surfaces notch conflicts
- Next-week navigation button — new capability, backlog
