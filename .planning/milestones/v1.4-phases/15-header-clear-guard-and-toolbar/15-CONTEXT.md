# Phase 15: Header, Clear Guard, and Toolbar - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Four mobile requirements, all pure rendering-layer work — no schema changes, no new Server Actions, no data flow changes:

- **MOB-04** — Header shrinks to fit 360px: name and title hide, avatar stays, sign-out becomes icon-only
- **MOB-02** — Per-cell clear requires deliberate long-press + tap sequence on touch; desktop unchanged
- **MOB-03** — Date pickers switch to native `<input type="date">` on mobile via CSS toggle (ViewToolbar + ClearPanel)
- **MOB-03a** — Toolbar buttons compact on mobile: Prev → chevron icon, date → native input, "Tänään" keeps text

</domain>

<decisions>
## Implementation Decisions

### Clear Guard (MOB-02)
- **D-01:** Long-press (>1 second) on the custody **cell** → arms the × button (makes it visible). Short tap on the armed × → fires `onClear`. This is a two-step deliberate sequence on touch.
- **D-02:** Armed state timeout: 2 seconds. If user does not tap × within 2s, the × auto-disarms and returns to hidden.
- **D-03:** Cancel on tap-elsewhere: if user taps anywhere other than the armed × before the timeout, the armed state is cancelled. (Standard timeout handles this — no separate global click listener needed.)
- **D-04:** Desktop behavior **unchanged**: hover on the cell reveals ×, single click fires `onClear` immediately. No long-press, no confirmation.
- **D-05:** Implementation: modify `ScheduleCell` to own a `isArmed` state + `useRef` for the long-press timer. Extract to a `ConfirmClearButton` sub-component if the logic makes `ScheduleCell` too large. On touch, × is always visible when armed and invisible when not (not opacity-0 group-hover pattern on mobile — armed visibility is JS-driven).
- **D-06:** `max-sm:opacity-100` is NOT used for always-visible × — the × is shown only when the cell is armed. Hidden otherwise on mobile (avoids cluttering the table with × buttons on every cell).

### Header (MOB-04)
- **D-07:** On mobile (below `sm:` breakpoint): title "Vuoroasuminen" hides (`hidden sm:block`), full name hides (`hidden sm:inline`), avatar (32×32) stays visible, sign-out becomes icon-only (LogOut from lucide-react, `aria-label="Kirjaudu ulos"`).
- **D-08:** On desktop: unchanged — all elements visible (title, avatar, name, "Kirjaudu ulos" button text).
- **D-09:** Avatar fallback when `avatar_url` is null: render a `<div>` with the user's first initial in a colored circle (e.g. `bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center text-sm font-medium`). Same size as the Image (32×32 / `w-8 h-8`).
- **D-10:** Header padding: reduce from `px-6 py-4` to `px-3 py-3 sm:px-6 sm:py-4` to recover horizontal space on mobile.

### Date Pickers (MOB-03)
- **D-11:** Both **ViewToolbar** and **ClearPanel** (start date + end date) get the native input treatment on mobile.
- **D-12:** Implementation: CSS toggle — render BOTH the native `<input type="date">` AND the existing Calendar Popover. Native input gets `sm:hidden` (visible on mobile, invisible on desktop). Calendar Popover gets `hidden sm:flex` (hidden on mobile, visible on desktop). No `useMediaQuery` — avoids hydration flash.
- **D-13:** Native `<input type="date">` onChange wires to the same callback as Calendar's `onSelect` (e.g. `handleDateSelect` in ViewToolbar, `setPickedStart`/`setPickedEnd` in ClearPanel). Value attribute: `format(selectedDate, "yyyy-MM-dd")` when date is selected, empty string otherwise.
- **D-14:** In ViewToolbar, the "Valitse päivä" Calendar Popover trigger button is replaced entirely by the native input on mobile (CSS toggle). The CalendarIcon button only appears on desktop.
- **D-15:** ClearPanel's date input labels ("Alkaen:", "Päättyy:") remain in both mobile and desktop layouts — they apply to both the native input and the Calendar Popover.

### Toolbar Layout (MOB-03a)
- **D-16:** `@container` on the ViewToolbar outer `<div>` — component-internal breakpoints, consistent with v1.4 responsive strategy (ARCHITECTURE.md).
- **D-17:** "Prev week" button: below `@sm` shows chevron-left icon only (`ChevronLeft` from lucide-react, `aria-label="Edellinen viikko"`). At `@sm` and above shows full text "‹ Prev week".
- **D-18:** "Valitse päivä" Calendar button: hidden on mobile (CSS toggle from D-12 replaces it with native input). Visible on desktop only.
- **D-19:** "Tänään" button: keeps text on all viewports (6 characters fits even on 360px).
- **D-20:** `flex-wrap` on the toolbar row as overflow fallback — if layout is somehow still too tight, buttons wrap to a second row rather than overflow horizontally.

### Claude's Discretion
- Long-press detection implementation: `pointerdown` + `setTimeout(1000)` + `pointermove`/`pointerup` cancel. Or `useLongPress` if a lightweight hook is already present in the codebase.
- Exact color for the first-initial avatar circle: use `bg-primary text-primary-foreground` (follows theme) unless a different approach is cleaner.
- Whether `ConfirmClearButton` is extracted as a separate file or kept inline in `ScheduleCell`.
- `touch-action: manipulation` in globals.css (eliminates 300ms tap delay on iOS) — include in this phase if not already added in Phase 14.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §MOB-02, §MOB-03, §MOB-03a, §MOB-04 — requirement definitions and out-of-scope items (swipe-to-reveal WCAG 2.5.1 violation, bottom tab bar below HIG minimum)

### Roadmap
- `.planning/ROADMAP.md` §Phase 15 — goal, 5 success criteria (especially SC2: no immediate clear on touch tap; SC3: desktop unchanged; SC5: native date picker on mobile)

### Research artifacts (MUST read)
- `.planning/research/ARCHITECTURE.md` §1, §2, §4, §5, §6 — responsive strategy (sm: vs @container), component integration map (which files change, what changes), Server vs. Client component boundary implications, safe-area notes
- `.planning/research/STACK.md` §Drawer, §useMediaQuery, §MOB-02 — component library notes, useMediaQuery hook copy-paste location (shadcn.io/hooks/use-media-query — NOT used in this phase but referenced for context)

### Files to modify
- `src/components/layout/header.tsx` — D-07 through D-10: mobile shrink, avatar fallback, padding
- `src/components/schedule/view-toolbar.tsx` — D-16 through D-20: @container, icon-only Prev, native date input CSS toggle
- `src/components/schedule/schedule-cell.tsx` — D-01 through D-06: long-press armed state for × button
- `src/components/schedule/clear-panel.tsx` — D-11 through D-15: native date input CSS toggle for start/end date pickers

### Prior phase decisions (carry forward)
- `.planning/phases/14-realtime-reliability-mobile-baseline/14-CONTEXT.md` D-06, D-07: viewport meta and overflow-x baseline already added in Phase 14
- `.planning/STATE.md` §v1.4 decisions: build order confirmed (Phase 14 realtime → Phase 15 header/clear/toolbar → Phase 16 table/stats); safe area insets deferred to this phase if header/toolbar needs them

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lucide-react`: already installed — use `ChevronLeft`, `LogOut`, `CalendarIcon` (already imported in `view-toolbar.tsx`)
- `src/components/ui/button.tsx`: Button with `size="sm"`, `variant="outline"` — all toolbar/header buttons use this
- `src/components/ui/calendar.tsx` + `src/components/ui/popover.tsx`: existing Calendar Popover — keep on desktop, hide on mobile via CSS

### Established Patterns
- `hidden sm:inline`, `hidden sm:block`: standard Tailwind v4 responsive visibility used across codebase
- `@container` with `@sm:` prefixes: v1.4 responsive strategy for component internals — ARCHITECTURE.md §2
- Server Component for `header.tsx`: pure class changes only — no new client boundary needed
- `"use client"` for schedule components: all schedule components are already client; `ScheduleCell` can add `useState`/`useRef` for armed state without boundary change

### Integration Points
- `ScheduleCell` receives `onClear` from `ScheduleTable` → passes through to clear handler: long-press + armed state lives entirely within `ScheduleCell`
- `ViewToolbar` reads `initialViewStart` and calls `navigateTo` — native date input's `onChange` calls `handleDateSelect` (already exists)
- `ClearPanel` owns `setPickedStart`/`setPickedEnd` state — native date inputs wire directly to these setters

</code_context>

<specifics>
## Specific Ideas

- Long-press implementation: `pointerdown` → start 1000ms timer. `pointerup` or `pointermove` (beyond small threshold) before timer fires → cancel. Timer fires → arm state. This pattern avoids scroll interference.
- Avatar fallback circle: `<div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium select-none">{firstInitial}</div>` — matches Image sizing.
- Native date input styling: apply `className="border rounded-md px-2 py-1 text-sm"` to match Button visual weight in the toolbar.

</specifics>

<deferred>
## Deferred Ideas

- Safe area insets (`env(safe-area-inset-*)`) — if iPhone QA reveals notch/Dynamic Island conflicts, add `pb-safe` via `tailwindcss-safe-area` plugin. Not added proactively per D-08 of Phase 14 context.
- `touch-action: manipulation` in globals.css — if not already included in Phase 14 output, include in this phase (Claude's discretion).
- Next-week navigation button — toolbar currently only has Prev; adding Next could be useful but is a new capability, belongs in backlog.

</deferred>

---

*Phase: 15-header-clear-guard-and-toolbar*
*Context gathered: 2026-05-19*
