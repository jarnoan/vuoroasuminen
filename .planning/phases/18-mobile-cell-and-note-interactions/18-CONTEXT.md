# Phase 18: Mobile Cell and Note Interactions - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Three mobile-only rendering improvements — no schema changes, no new Server Actions:

1. **UI-03 (Pen icon):** The mobile note affordance button changes from `PlusIcon` to a pen/pencil icon.
2. **UI-04 (Tyhjennä full-cell):** Long-pressing a custody cell on a touch device fades the cell to red (CSS transition over 1s), then arms it as a full-cell "Tyhjennä" button with haptic vibration. Tapping anywhere on the armed cell clears it. Desktop/hover behavior is unchanged.
3. **UI-05 (Note row attribution):** The mobile note row is visually merged with its day row — zero gap, slight indent, no dividing border between them.

</domain>

<decisions>
## Implementation Decisions

### UI-03: Pen Icon

- **D-01:** Replace `PlusIcon` (from lucide-react) with a pen/pencil icon — Claude's discretion on exact icon name (`Pencil`, `PenLine`, `Pen`). Size stays `h-4 w-4`.

### UI-04: Tyhjennä Full-Cell Interaction

- **D-02:** Armed state visual: full-cell red/destructive background with white "Tyhjennä" text. Replaces the current corner `×` button entirely on touch devices.
- **D-03:** Tap anywhere on the armed cell triggers `onClear` — no sub-target needed.
- **D-04:** Media query split: `@media (hover: none)` devices (phones + tablets) get the full-cell Tyhjennä on long-press. `@media (hover: hover)` devices (mouse/trackpad) keep the existing corner `×` on hover unchanged.
- **D-05:** CSS transition fades the cell background from its parent color to red over 1s during the hold. This uses an `isHolding` state that adds a transition class on `pointerdown`. The 1s JS timer for arming fires simultaneously — when it fires, `isArmed` becomes true, vibration plays, text switches to "Tyhjennä".
- **D-06:** On cancel (pointerup before 1s): snap the cell back to original color instantly. Remove the transition class so there is no reverse animation.
- **D-07:** "Tyhjennä" text (and the red armed style) only appear when fully armed (after 1s). During the fade the cell still shows the parent name.
- **D-08:** Haptic vibration fires via `navigator.vibrate(100)` exactly when `isArmed` becomes true (at the 1s mark).

### UI-05: Note Row Attribution

- **D-09:** Zero top gap on the note row: remove top padding from the note `<tr>` so it sits directly attached to its day row above with no visual separation.
- **D-10:** Slightly indented: note row content has a small left padding (e.g., `pl-8` or `pl-10`) so the input appears nested under the date column.
- **D-11:** Day row loses its bottom border when a note row follows it. The day row and note row form one visual unit; the dividing line comes only after the note row.

### Claude's Discretion

- Exact lucide-react icon name for UI-03 (Pencil / PenLine / Pen)
- Exact left-padding value for note row indentation (pl-8 / pl-10 — match the date column's content offset)
- CSS class names for the red background transition (Tailwind arbitrary value or mapped token)
- Whether `isHolding` is a separate state or derived from a class added/removed directly via a ref

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and Roadmap
- `.planning/REQUIREMENTS.md` — UI-03, UI-04, UI-05 definitions with acceptance criteria
- `.planning/ROADMAP.md` Phase 18 — success criteria (5 numbered items, including desktop unchanged)

### Key Implementation Files
- `src/components/schedule/schedule-cell.tsx` — current long-press implementation (isArmed state, 1s arm timer, 2s auto-disarm, pointerDown/Up/Move/Cancel handlers, corner × button). This is the primary file to modify for UI-04.
- `src/components/schedule/schedule-table.tsx` — note affordance button (line ~344–354, PlusIcon), note row `<tr>` (line ~364–383). Primary file for UI-03 and UI-05.
- `src/components/schedule/notes-cell.tsx` — note input component (referenced from schedule-table, no changes expected)

### Prior Art / Lessons
- `.planning/STATE.md` §"Accumulated Context / v1.4" — `touchAction: "manipulation"` pattern already on cell buttons; long-press guard (MOB-02) established the 1s+2s timer pattern; desktop/mobile separation via `max-sm:` (now switching to `@media (hover: none)` for tablet support)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `isArmed` state + `armTimerRef` + `disarmTimerRef` in `schedule-cell.tsx` — the 1s arm + 2s auto-disarm machinery is already in place; Phase 18 extends it with CSS transition fade and full-cell rendering
- `PlusIcon` import (lucide-react) in `schedule-table.tsx` — swap to pen icon, same import pattern
- `notesOpenDates` state (Set<string>) — already manages when note row appears; no changes needed

### Established Patterns
- `touchAction: "manipulation"` on interactive cells — already present; keeps it
- `style={{ touchAction: "manipulation" }}` inline style on note button — keep
- `max-sm:table-row sm:hidden` / `max-sm:table-cell sm:hidden` — current mobile/desktop split via viewport. For UI-04, switch to `@media (hover: none)` CSS so large touch screens are correctly covered
- `bg-blue-500 / bg-rose-500` parent color classes — the fade transition will animate FROM these TO red

### Integration Points
- **UI-04 armed state rendering:** `schedule-cell.tsx` needs to conditionally render either the corner `×` (hover devices) or replace the entire button content with full-cell Tyhjennä (touch devices). Consider CSS `@media (hover: none)` via Tailwind's `[@media(hover:none)]` variant
- **UI-05 border removal:** The day `<tr>` needs a conditional class when `day.notes || notesOpenDates.has(day.date)` — remove bottom border on that row
- **UI-03:** Change `PlusIcon` → pen icon on line ~352 of `schedule-table.tsx` — one-line change

</code_context>

<specifics>
## Specific Ideas

- The red fade during the hold is the key UX innovation of this phase — it gives real-time feedback that the long-press is registering, making the 1s threshold feel deliberate rather than arbitrary.
- "Snap back instantly" on cancel is intentional (user decision) — no reverse fade animation; the snap-back is clean and avoids a lingering red tint if the user accidentally started a hold.
- `@media (hover: none)` replaces `max-sm:` for all UI-04 logic — this ensures iPad-sized touch screens get the Tyhjennä flow, not the desktop hover flow.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 18-Mobile Cell and Note Interactions*
*Context gathered: 2026-05-21*
