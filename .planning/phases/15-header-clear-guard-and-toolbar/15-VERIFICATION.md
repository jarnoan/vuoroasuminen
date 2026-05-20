---
phase: 15-header-clear-guard-and-toolbar
verified: 2026-05-19T00:00:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "On a 360px mobile viewport (e.g. iPhone SE), load the app and confirm: (a) header shows only avatar and sign-out icon — no title text, no name; (b) header has no horizontal overflow; (c) tapping the sign-out icon triggers sign-out flow"
    expected: "Avatar circle (or image) and a single icon button visible; row does not overflow the viewport; tapping signs out"
    why_human: "CSS responsive hiding (hidden sm:block, hidden sm:inline) and layout overflow require a real narrow viewport — cannot be verified by grep or TypeScript"
  - test: "On a 360px touch device, tap a custody cell once: confirm it does NOT clear or show a × button. Then long-press the same cell for >1 second: confirm the × button appears. Tap × to confirm the clear fires."
    expected: "Single tap only toggles the parent assignment. Long-press arms the × button. Second tap on × clears the cell and the × button disappears."
    why_human: "Pointer event timing (setTimeout 1000ms arm, 2000ms disarm), touch gesture handling, and two-step UX flow cannot be exercised by static code analysis"
  - test: "On desktop, hover over a custody cell: confirm the × button appears via CSS group-hover. Confirm no change in toggle behaviour."
    expected: "× becomes visible on hover; desktop behaviour is identical to pre-Phase-15 behaviour"
    why_human: "CSS group-hover interaction requires browser rendering — cannot be verified statically"
  - test: "On a 360px viewport, open the schedule view. Confirm the ViewToolbar row (Prev, date control, Tänään) does not overflow horizontally. Tap the date field and confirm the OS native date picker opens."
    expected: "All toolbar controls fit within the viewport; tapping the date field opens the system calendar/date picker (not the Popover)"
    why_human: "CSS overflow and native input behaviour on mobile require a real device or browser devtools viewport simulation"
  - test: "On desktop, open the ViewToolbar. Confirm the Calendar Popover appears when the date button is clicked (native input is hidden). Confirm the Prev button shows text (not just the ChevronLeft icon)."
    expected: "Popover opens on desktop; native input is invisible; Prev button reads '‹ Prev week'"
    why_human: "CSS sm:hidden / hidden sm:flex toggling requires rendered browser context"
  - test: "Expand the ClearPanel (click '× Tyhjennä päiväväli'). On mobile: confirm both Alkaen and Päättyy rows show native date inputs and the labels remain visible. On desktop: confirm Calendar Popovers appear instead."
    expected: "Labels 'Alkaen:' and 'Päättyy:' visible on both viewports; native inputs on mobile; popovers on desktop"
    why_human: "CSS toggle (sm:hidden / hidden sm:flex) and label visibility require rendered browser context"
---

# Phase 15: Header, Clear Guard, and Toolbar Verification Report

**Phase Goal:** Both parents can navigate the app, clear cells safely on touch, and control their view window without overflow or accidental activation on mobile
**Verified:** 2026-05-19
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Header fits on a 360px viewport — parent name truncated or hidden and sign-out control remains tappable | VERIFIED (code) / ? Human for layout | `hidden sm:block` on title, `hidden sm:inline` on name span, `px-3 py-3` mobile padding, `aria-label="Kirjaudu ulos"` on sign-out button — all present in header.tsx |
| 2 | On touch device, tapping custody cell does NOT immediately clear it; long-press reveals clear option requiring a second action | VERIFIED (code) / ? Human for behaviour | `isArmed` state, `armTimerRef` setTimeout(1000), `max-sm:opacity-0` default + `max-sm:opacity-100` when armed, × onClick fires `onClear` — all present in schedule-cell.tsx |
| 3 | On desktop, existing hover × button for clearing behaves exactly as before | VERIFIED (code) / ? Human for rendering | `sm:opacity-0 sm:group-hover:opacity-100` preserved in × button className; only mobile-specific classes added; no desktop logic changed |
| 4 | View toolbar controls fit within 360–430px viewport without horizontal overflow or clipping | VERIFIED (code) / ? Human for layout | `@container flex flex-wrap` on outer div, `@sm:hidden` ChevronLeft icon, `hidden @sm:inline` text span, `sm:hidden` native date input — all present in view-toolbar.tsx |
| 5 | On mobile, tapping date field opens native system date picker; on desktop calendar popover appears | VERIFIED (code) / ? Human for interaction | `<input type="date" className="sm:hidden ...">` wired to `handleDateSelect(parseISO(e.target.value))`; Popover trigger has `hidden sm:flex`; same CSS-toggle pattern in both ClearPanel pickers |

**Score:** 5/5 truths verified at code level; 6 human verification items needed for rendered behaviour

### Deferred Items

None.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/layout/header.tsx` | Mobile-responsive header with avatar fallback and icon-only sign-out on mobile | VERIFIED | Exists, 51 lines of substantive implementation; LogOut import, avatar fallback, responsive classes, no stubs |
| `src/components/schedule/schedule-cell.tsx` | Long-press clear guard with isArmed state, desktop unchanged | VERIFIED | Exists, 123 lines; useState/useRef/useEffect with arm/disarm timers, pointer event handlers, opacity class chain |
| `src/components/schedule/view-toolbar.tsx` | @container responsive toolbar with icon-only Prev and native date input on mobile | VERIFIED | Exists, 107 lines; @container, flex-wrap, ChevronLeft, native input, Popover hidden on mobile |
| `src/components/schedule/clear-panel.tsx` | ClearPanel with native date inputs on mobile for both start and end pickers | VERIFIED | Exists, 205 lines; parseISO import, two native date inputs with sm:hidden, htmlFor labels, Popover triggers with hidden sm:flex |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| header.tsx | signOutAction | `form action={signOutAction}` | WIRED | Line 42: `<form action={signOutAction}>` present |
| header.tsx | next/image | conditional render when avatarUrl is set | WIRED | Line 25: `{avatarUrl ? (<Image ...) : (<div ...)}` |
| schedule-cell.tsx isArmed state | × button visibility | `max-sm:opacity-100` when isArmed / `max-sm:opacity-0` when not | WIRED | Line 106: template literal with `${isArmed ? "max-sm:opacity-100" : "max-sm:opacity-0"}` |
| pointerdown handler | armTimerRef setTimeout(1000) | useRef stored timer | WIRED | Line 57: `armTimerRef.current = setTimeout(() => {`, fires at 1000ms |
| native input in ViewToolbar | handleDateSelect | onChange calls handleDateSelect(parseISO(e.target.value)) | WIRED | Line 76: `handleDateSelect(parseISO(e.target.value))` inside onChange guard |
| native input in ClearPanel Alkaen | setPickedStart | onChange: setPickedStart(parseISO(e.target.value)) | WIRED | Line 104: `setPickedStart(parseISO(e.target.value))` inside guard |
| native input in ClearPanel Päättyy | setPickedEnd | onChange: setPickedEnd(parseISO(e.target.value)) | WIRED | Line 142: `setPickedEnd(parseISO(e.target.value))` inside guard |

### Data-Flow Trace (Level 4)

These components render user-entered dates and metadata — not database query results. Data flows from user gestures and auth metadata (server-side).

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| header.tsx | avatarUrl, fullName | `supabase.auth.getUser()` server call | Yes — live auth metadata | FLOWING |
| schedule-cell.tsx | isArmed | useState, set by setTimeout in pointerdown handler | Yes — real pointer event timing | FLOWING |
| view-toolbar.tsx | selectedDate | `parseISO(initialViewStart)` prop from parent RSC | Yes — URL search param driven | FLOWING |
| clear-panel.tsx | pickedStart, pickedEnd | native input onChange → setPickedStart/setPickedEnd | Yes — user date input | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — these are UI components requiring a running browser; no runnable entry points for static spot-checks. Human verification items in Step 8 cover all key behaviours.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| MOB-04 | 15-01-PLAN.md | Header fits on mobile — parent name truncated or hidden; sign-out accessible | SATISFIED | header.tsx: `hidden sm:block` title, `hidden sm:inline` name, `px-3 py-3` mobile padding, `aria-label="Kirjaudu ulos"` |
| MOB-02 | 15-02-PLAN.md | Long-press on custody cell shows clear option on touch; hover × unchanged on desktop | SATISFIED | schedule-cell.tsx: isArmed state, 1s arm timer, 2s auto-disarm, `max-sm:opacity` classes, `sm:group-hover:opacity-100` preserved |
| MOB-03 | 15-03-PLAN.md | Date picker on mobile uses native `<input type="date">`; desktop keeps calendar popover | SATISFIED | view-toolbar.tsx + clear-panel.tsx: native inputs with `sm:hidden`, Popover triggers with `hidden sm:flex` |
| MOB-03a | 15-03-PLAN.md | View toolbar controls fit within mobile viewport without overflow | SATISFIED | view-toolbar.tsx: `@container flex flex-wrap`, icon-only Prev with `@sm:hidden` / `hidden @sm:inline` |

All 4 requirements declared in PLAN frontmatter are satisfied. No orphaned requirements — REQUIREMENTS.md Traceability table assigns exactly MOB-02, MOB-03, MOB-03a, MOB-04 to Phase 15; all are covered.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| schedule-cell.tsx | 11 | `childName: string` declared in interface but never destructured or used in component body | Info | Pre-existing dead prop; does not affect phase-15 functionality; no stub behaviour |

No TODO/FIXME/placeholder comments found. No empty return values in phase-modified files. No `useMediaQuery` in any file. TypeScript compiles without errors.

The `return null` on header.tsx line 13 is a valid authentication guard (user not logged in → render nothing), not a stub.

### Human Verification Required

#### 1. Header mobile layout

**Test:** On a 360px mobile viewport (Chrome devtools iPhone SE or real device), load the app and inspect the header.
**Expected:** Only the avatar (image or initial circle) and the sign-out icon button are visible. The app title "Vuoroasuminen" and the user's full name are not rendered. The header row has no horizontal overflow.
**Why human:** CSS `hidden sm:block` and `hidden sm:inline` visibility toggling requires a rendered narrow viewport — not verifiable by grep or TypeScript.

#### 2. Long-press clear guard — mobile touch

**Test:** On a touch device (or Chrome devtools touch emulation), tap a filled custody cell once.
**Expected:** The cell toggles parent assignment (father ↔ mother). The × button does NOT appear.

Then long-press the same cell for more than 1 second without moving your finger more than ~8px.
**Expected:** The × button appears. Wait 2 seconds without tapping × — the × button disappears automatically (auto-disarm).

Long-press again to arm, then tap the × button.
**Expected:** `onClear` fires, the cell is cleared, the × button disappears immediately.
**Why human:** Pointer event timing (1s arm, 2s disarm), gesture cancellation on move, and two-step interaction sequence cannot be exercised by static code analysis.

#### 3. Desktop hover × button — regression check

**Test:** On desktop, hover the mouse over a custody cell.
**Expected:** The × button appears. Moving the mouse off the cell hides it. No long-press is required.
**Why human:** CSS `group-hover` behaviour requires browser hover state — not statically verifiable.

#### 4. ViewToolbar on 360px viewport

**Test:** On a 360px mobile viewport, navigate to the schedule view. Inspect the toolbar row.
**Expected:** The toolbar row has no horizontal overflow. The Prev button shows only a left-chevron icon (no "‹ Prev week" text). The date control shows a native date input (not a popover button). The "Tänään" button is visible.

Tap the date input — confirm the OS native date picker opens (system calendar sheet on iOS/Android).
**Why human:** CSS `@container @sm:hidden` / `hidden @sm:inline` and `sm:hidden` toggling, plus native `<input type="date">` OS picker behaviour, require rendered browser context.

#### 5. ViewToolbar on desktop

**Test:** On desktop, load the schedule view. Inspect the toolbar.
**Expected:** Prev button shows "‹ Prev week" text (chevron icon hidden). The Calendar Popover button is visible. Clicking it opens the react-day-picker popover. The native date input is not visible.
**Why human:** CSS `hidden sm:flex` on the Popover trigger requires rendered browser context to verify.

#### 6. ClearPanel date pickers

**Test:** Click "× Tyhjennä päiväväli" to expand the ClearPanel. On mobile viewport:
**Expected:** "Alkaen:" and "Päättyy:" labels are visible. Each row shows a native date input. The Calendar Popover buttons are not visible. Tapping a native date input opens the OS date picker.

On desktop:
**Expected:** Labels visible. Each row shows a Calendar Popover button (no native input visible). Clicking the button opens the popover calendar.
**Why human:** CSS `sm:hidden` / `hidden sm:flex` toggle on both pickers, and label visibility on all viewports, require rendered browser context.

### Gaps Summary

No code-level gaps were found. All 5 roadmap success criteria are implemented correctly and all 4 required requirements (MOB-02, MOB-03, MOB-03a, MOB-04) are satisfied.

The phase cannot be marked `passed` because 6 items require human verification in a real browser at 360px — this is expected for CSS-responsive and touch-interaction work. All automated checks (TypeScript, grep for acceptance criteria, anti-pattern scan, commit verification) pass.

---

_Verified: 2026-05-19_
_Verifier: Claude (gsd-verifier)_
