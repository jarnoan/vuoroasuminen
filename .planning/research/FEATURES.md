# Features — Mobile-First Responsive Layout (v1.4)

**Project:** Vuoroasuminen v1.4
**Researched:** 2026-05-17
**Confidence:** HIGH for pattern recommendations (multiple sources); MEDIUM for app-specific tradeoff nuances

---

## Scope

This file covers UX patterns for five mobile areas added in v1.4:

- MOB-01: Schedule table reflow (no horizontal scroll on 360–430px)
- MOB-02: Clear button guard against accidental activation on touch
- MOB-03: View toolbar compact and touch-accessible
- MOB-04: Header/nav adapted for mobile
- MOB-05: Statistics panel stacked/collapsible on mobile

Existing features (Google OAuth, real-time sync, draft/publish, Google Calendar sync, onboarding) are unchanged.

---

## 1. Schedule Table Reflow (MOB-01)

**Context:** Table has rows = days (84 rows for 12-week window), columns = child1 | child2 | [child3] | notes. On desktop the table is fine. On 360px wide viewports, 4 columns plus a date column = ~5 columns forcing horizontal scroll.

### Strategies and Tradeoffs

| Strategy | How It Works | Complexity | Suitable for This Table? |
|----------|-------------|------------|--------------------------|
| **Sticky date column + horizontal scroll** | Date column fixed at left: 0; remaining cols scroll right | Low — pure CSS (`position: sticky; left: 0` on first `td`/`th`) | Yes, last resort if columns cannot shrink further |
| **Column hiding (priority columns only)** | Hide the notes column below a breakpoint; keep date + children visible | Low — single Tailwind `hidden sm:table-cell` | Yes — notes column is least critical on mobile |
| **Card-per-row reflow** | Each day row becomes a stacked block: date header + child assignments below | High — rewrite table to flex/grid layout; semantics lost | No — comparison across days is the core use case; cards destroy it |
| **Fixed-width narrow columns** | Shrink all columns to minimum content width; rely on text truncation | Low — CSS only | Yes — works if child names are short; breaks on long names |
| **Hybrid: narrow columns + sticky date + hide notes** | Notes hidden on mobile; date sticky; children columns shrink to ~80px each | Low/Medium — 3 independent CSS changes | YES — recommended approach |

**Recommendation:** Use the hybrid approach. At 360px:

- Date column: `sticky left-0 bg-white z-10 w-16` (≈64px; shows "Mon 12/5" abbreviated format)
- Each child column: `min-w-[72px]` — enough for a color chip + abbreviated parent initial
- Notes column: `hidden sm:table-cell` — completely hidden below `sm` (640px); visible on tablet and desktop
- Table wrapper: `overflow-x-auto` on a containing div, NOT on the `<table>` element itself (CSS spec issue)

**Why not card-per-row:** The entire point of this table is to compare custody across days at a glance. Cards eliminate horizontal comparison. This is not a shopping cart or a contact list — it is a schedule grid.

**Why not "full reflow" (label/value stacking per row):** jQuery Mobile–style reflow doubles page height (84 rows × ~3 lines each = 250+ stacked blocks) and breaks the schedule reading pattern entirely.

**Why notes column hiding is safe:** Notes are supplementary context. Users can tap a cell to open a detail view or scroll to notes on desktop. The PROJECT.md confirms notes are "shared per day" but secondary to child assignment.

### Sticky Column CSS Gotchas (HIGH confidence)

- `overflow-x: auto` must be on a wrapper `<div>`, not on `<table>` — setting it on the table itself has no effect in Chromium
- Sticky `<td>` and `<th>` in the first column need an explicit `background-color` — without it, scrolled content shows through
- Use `box-shadow: inset -1px 0 0 #e5e7eb` instead of `border-right` on sticky cells — borders on sticky elements cause 1px flickering artifacts on Chrome/Safari during scroll
- z-index layering: sticky `<thead>` first cell needs the highest z-index (e.g., `z-20`); sticky body cells `z-10`; header row `z-10`

### Table Stakes vs Differentiators vs Anti-Features

| Category | Feature | Complexity Cost |
|----------|---------|-----------------|
| Table stakes | Notes column hidden on mobile (`hidden sm:table-cell`) | Near zero |
| Table stakes | Sticky date column (`sticky left-0`) | Low (CSS only, 2–3 Tailwind classes per cell) |
| Table stakes | Touch-friendly row height (min 44px per row) | Near zero (Tailwind `py-3`) |
| Differentiator | Abbreviated date format on mobile (e.g., "Mon 12/5" → "M 12") | Low (date-fns format string swap at breakpoint) |
| Anti-feature | Card-per-row layout | Destroys comparison UX; do not implement |
| Anti-feature | Column group collapsing (hide/show children columns by tap) | Adds toggle state; low value for 2–3 fixed children; do not implement |
| Anti-feature | Horizontal scroll indicator/shadow overlay | Medium; users discover scroll via touch; adds complexity for marginal gain |

**Dependency on existing components:** The schedule table is a custom HTML `<table>` component. No TanStack Table is in use (confirmed by codebase: ~6,784 LOC TypeScript, custom table rendering). Tailwind classes can be added directly. No new dependencies required.

---

## 2. Clear Button Guard (MOB-02)

**Context:** "Clear cell" and "clear range" actions are destructive (set parent_id = null). On desktop they are protected by the existing ClearPanel inline expand flow. On mobile, touch targets are small and misactivation is likely.

### Guard Strategies and Tradeoffs

| Strategy | How It Works | Friction Added | Accessibility | Complexity |
|----------|-------------|----------------|---------------|------------|
| **Confirm dialog (single-tap → modal)** | Tap clear → shadcn/ui AlertDialog → "Clear this day?" → Confirm/Cancel | Medium (2 taps always) | HIGH — keyboard, screen reader, focus trap all native to AlertDialog | Low — AlertDialog already in project via shadcn/ui |
| **Long-press to activate** | Button hidden until 500ms hold | Medium (unfamiliar pattern for web) | LOW — no keyboard equivalent; not accessible | Medium — requires custom touch event handling (`onPointerDown` + timer) |
| **Swipe-to-reveal** | Swipe a row left to reveal Clear button | Low perceived friction | LOW — conflicts with screen reader swipe navigation; requires CSS + touch state | High — gesture detection, row state, animation |
| **Disabled on mobile, desktop-only** | Hide clear button below `sm` | Maximum safety (no accidental clears) | N/A | Near zero |
| **Undo via toast (reversible action)** | Clear happens immediately; snackbar with "Undo" button for ~5s | Lowest friction for intentional users | MEDIUM — requires focus management on toast | Medium — undo state, timer, revert mutation |

**Recommendation:** Confirm dialog (AlertDialog) for both clear-cell and clear-range on mobile.

Rationale:
- The project already uses shadcn/ui AlertDialog for the publish confirmation (see KEY DECISIONS: "dialog confirmation prevents accidental publish"). Extending the same pattern is zero new API surface.
- The existing ClearPanel already has a two-step confirm step on desktop (inline expand). The mobile equivalent is the AlertDialog, which is more touch-safe (large buttons, modal focus trap prevents mis-taps on the table beneath).
- Baymard Research confirms "Demonstrate Intent" (confirmation dialogs, two-tap requirements) is the correct strategy for rare, high-severity actions. Clear cell is exactly that: used infrequently, not easily undone.
- Swipe-to-reveal is explicitly flagged by accessibility research as conflicting with screen reader gestures and not meeting WCAG 2.5.1 (pointer cancellation). Do not implement.
- Long-press has no accessible keyboard equivalent. Apple HIG and Material Design 3 both discourage long-press as the sole access method for destructive actions.

**Google Calendar pattern (MEDIUM confidence, verified by Google Help docs):** Google Calendar mobile requires: tap event → tap More (3-dot) → tap Delete → confirm. This is a 4-step flow. A 2-step confirm dialog is less friction than Google Calendar's approach while still being intentional.

**Touch target requirement:** The clear button (trigger) must be `min-h-[44px] min-w-[44px]` (iOS HIG: 44pt; Material Design 3: 48dp). The existing clear button should be audited for touch target size.

### Table Stakes vs Differentiators vs Anti-Features

| Category | Feature | Complexity Cost |
|----------|---------|-----------------|
| Table stakes | AlertDialog confirmation on clear-cell tap (mobile) | Low — shadcn/ui AlertDialog already available |
| Table stakes | AlertDialog confirmation on clear-range submit (mobile) | Low — same pattern as above |
| Table stakes | 44px minimum touch target on clear button | Near zero (Tailwind `min-h-11 min-w-11`) |
| Differentiator | Undo via toast with 5s revert window | Medium — requires optimistic mutation + revert |
| Anti-feature | Swipe-to-reveal clear | Accessibility violations; conflicts with scroll gestures; do not implement |
| Anti-feature | Long-press activation | No keyboard equivalent; breaks accessibility; do not implement |
| Anti-feature | Disable clear on mobile | Removes functionality; defeats the purpose of MOB-02 |

**Dependency on existing components:** shadcn/ui AlertDialog is already available (used for publish confirmation). The clear-cell mutation already exists in the Server Action layer. The confirm dialog wraps the existing action without changes to the mutation itself.

---

## 3. View Toolbar — Mobile (MOB-03)

**Context:** The view toolbar contains: date picker (start date), "previous week" button, "+ Lisää viikkoja" (extend schedule) button. On desktop these are inline in a toolbar row. On 360px, they overflow or become too small to tap.

### Patterns and Tradeoffs

| Strategy | How It Works | Complexity | Thumb-Friendliness |
|----------|-------------|------------|--------------------|
| **Inline compact** | Reduce padding; abbreviate labels; stack on two lines if needed | Low — CSS only | Medium — buttons remain in header zone (top of screen, thumb-unfriendly) |
| **Bottom sheet (Drawer)** | "Controls" button in toolbar opens Vaul-based bottom sheet with all controls | Medium — add shadcn/ui Drawer; wire controls | HIGH — bottom of screen, thumb zone |
| **Sticky bottom toolbar** | Toolbar moves to bottom of viewport as sticky bar | Medium — layout restructure | HIGH — always in thumb zone |
| **Overflow menu (3-dot)** | Less-used controls (date picker, extend) collapse into overflow menu | Low/Medium | Low — top-right corner, single tap to open |
| **Drawer per action** | Each control (date picker, extend panel) opens its own bottom sheet | High — multiple drawers | HIGH |

**Recommendation:** Inline compact with Drawer for date picker only.

Specifically:
- Previous week button: keep visible inline; icon-only on mobile (`<` arrow, 44px tap target). This is a frequent action (used every session to adjust view start).
- "+ Lisää viikkoja" (extend): keep as visible button on mobile; opens existing ExtendPanel. The panel already uses the "inline expand" pattern — on mobile it can expand below the toolbar row without change.
- Date picker: the `<Popover>` + `<Calendar>` that opens on desktop is unusable on small viewports (popover covers the table). Replace with a conditional: on mobile, open a `<Drawer>` (Vaul/shadcn) from the bottom with the same `<Calendar>` component inside. The shadcn/ui docs explicitly show a "Responsive Dialog" pattern (Dialog on desktop, Drawer on mobile) using a single `useMediaQuery` or `useIsMobile()` hook.

**Why not sticky bottom toolbar:** Restructuring the entire layout to move the toolbar to the bottom is a larger change than the milestone warrants. The schedule table itself needs the vertical space. A bottom toolbar competes with future bottom-tab navigation (MOB-04).

**Why not Drawer for all controls:** The extend panel already works as an inline expand; it does not need a drawer. Over-engineering the toolbar for a two-user app adds complexity without proportional gain.

**Vaul performance note (MEDIUM confidence):** Vaul can lag when drawer content exceeds ~20 list items. The Calendar component inside the drawer is a 7×N grid (≤35 cells) — within safe limits. No performance concern for this use case.

### Table Stakes vs Differentiators vs Anti-Features

| Category | Feature | Complexity Cost |
|----------|---------|-----------------|
| Table stakes | Previous week button touch-safe (44px, icon-only on mobile) | Near zero |
| Table stakes | Date picker opens Drawer (not Popover) on mobile | Low — shadcn/ui Drawer wrapping existing Calendar component |
| Table stakes | "+ Lisää viikkoja" button readable and tappable on 360px | Near zero (padding/font size) |
| Differentiator | Swipe-to-navigate weeks (swipe left/right on table) | High — gesture detection, conflicts with table scroll; skip |
| Anti-feature | Full bottom sheet for entire toolbar | Hides all controls behind a tap; adds unnecessary indirection for frequent actions |
| Anti-feature | Overflow menu (3-dot) for primary controls | Buries high-frequency actions; contradicts mobile nav best practice ("do not bury high-frequency actions in hidden menus") |

**Dependency on existing components:** shadcn/ui Drawer not currently in project (Vaul-based). Requires `npx shadcn@canary add drawer`. The existing Calendar component plugs into it without modification. The existing date picker Server Action / URL param flow is unchanged.

---

## 4. Header / Navigation — Mobile (MOB-04)

**Context:** The app has two primary views: schedule (/) and statistics (/stats or inline panel). Current header likely contains the app name and user avatar/logout. Navigation between schedule and stats is not formalized.

### Navigation Patterns for a Two-View App

| Pattern | Typical Use | Two-View Fit | Complexity |
|---------|------------|--------------|------------|
| **Bottom tab bar (2 items)** | 3–5 primary sections in native apps | Below the HIG/MD3 recommended minimum of 3; two large equal tabs feel unbalanced; standard guidance says use tabs for 3–5 items | Low |
| **Sticky top header with two nav links** | Simple web apps | Standard for web; familiar pattern; both items always visible | Near zero |
| **Hamburger menu** | Complex hierarchies, 6+ items | Overkill; hides navigation unnecessarily for a 2-view app | Low |
| **Tab control in header (not bottom)** | Segmented control at top | Works for 2–3 items; keeps navigation visible without bottom bar | Near zero |

**Recommendation:** Sticky top header with two inline nav links (or a segmented control/tabs).

Rationale:
- Both iOS HIG and Material Design 3 recommend bottom tabs for 3–5 destinations. Two tabs is below the threshold. Multiple 2026 UX sources confirm "odd numbers (3 or 5) create better visual rhythm" for bottom bars; a two-item bottom bar wastes real estate.
- For a web app (not native), a compact sticky header with "Schedule | Stats" links is the simplest, most familiar pattern. This is what most mobile-web scheduling apps do (Google Calendar web, Teamup, When2meet all use top navigation on mobile web).
- The schedule view dominates usage (estimated 90%+ of sessions). Stats is secondary. A persistent bottom bar treating both as equal-weight destinations is misleading.
- Header should contain: app name/logo (small), "Kalenteri | Tilastot" (or icons), user avatar with logout on tap. All content fits in 56dp height.

**Touch targets:** Each nav link must be `min-h-[44px]` (padding-y). If using icon-only, include `aria-label`.

### Hamburger menu: when to use it here

A hamburger is appropriate only for: settings, logout confirmation, "About", help. These secondary items can live in a `<DropdownMenu>` or `<Sheet>` triggered by a profile avatar tap. Do not use a hamburger for primary navigation between schedule and stats.

### Table Stakes vs Differentiators vs Anti-Features

| Category | Feature | Complexity Cost |
|----------|---------|-----------------|
| Table stakes | Sticky top header with Schedule / Stats nav links visible on all viewports | Near zero — existing header with responsive classes |
| Table stakes | User avatar / logout accessible on mobile (e.g., in header dropdown) | Near zero — shadcn/ui DropdownMenu |
| Table stakes | Header height ≤56px to preserve vertical space for schedule table | Near zero — padding adjustment |
| Differentiator | Active tab indicator (underline or bold) on current view | Near zero |
| Anti-feature | Bottom tab bar with 2 items | Below MD3/HIG minimum; wastes bottom viewport space; skip |
| Anti-feature | Hamburger menu for Schedule/Stats toggle | Buries primary navigation; skip |
| Anti-feature | Full-page drawer navigation | Massive overkill for two destinations; skip |

**Dependency on existing components:** The existing header component needs responsive adjustments only. shadcn/ui DropdownMenu (for user avatar / logout) is likely already in use. No new routing changes — schedule and stats are already separate views.

---

## 5. Statistics Panel — Mobile (MOB-05)

**Context:** The statistics panel shows: days per child per parent, solo days, child-free days and weekends. Computed from both draft and published entries. Currently rendered as a table or inline panel on desktop. On mobile, a multi-column statistics table will not fit without horizontal scroll.

### Display Patterns for Statistics on Mobile

| Pattern | How It Works | Complexity | Scan-ability |
|---------|-------------|------------|--------------|
| **Stacked stat cards** | Each statistic = a full-width card with label + value | Near zero — flex-col layout | HIGH — large tap targets, readable values |
| **Collapsible accordion** | Section headers (e.g., "Per Child", "Per Parent") expand/collapse | Low — shadcn/ui Collapsible or Accordion | MEDIUM — requires taps to see data |
| **Horizontal scroll table** | Statistics table scrolls left/right | Near zero | LOW — statistics are comparison data; hiding columns defeats the purpose |
| **Responsive grid (2-col)** | 2 cards per row on mobile | Near zero | HIGH — efficient use of space |

**Recommendation:** Stacked stat cards (or 2-column card grid) — no accordion needed.

Rationale:
- The statistics panel has a bounded, small number of values (custody days per child × 2 parents + 3–4 aggregate stats = ~10–12 values total). This fits in a vertically scrolled card list without overwhelming the user.
- Accordions add interaction cost (tap to open each section) for a panel with minimal content. HubSpot and Syncfusion both note accordions are "beneficial for mobile by reducing scrolling" — but that benefit only applies when the content is long. 10–12 stats is not long.
- Horizontal scroll for comparison data is a last resort (confirmed by multiple sources as "less than ideal"). Do not apply it to the stats panel.
- A 2-column card grid (`grid grid-cols-2 gap-3`) on mobile gives each stat a generous card without excess vertical scroll.

**Implementation pattern:**
```
grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3
```
Each card: `rounded-lg border p-4 text-center` with label below value. This matches the shadcn/ui Card component or can be built with plain Tailwind — no new component library needed.

**Collapsible as optional differentiator:** If the stats panel grows (e.g., breakdown by month added in a future milestone), an accordion becomes valuable. For v1.4 with the current bounded set, it adds complexity with no benefit.

### Table Stakes vs Differentiators vs Anti-Features

| Category | Feature | Complexity Cost |
|----------|---------|-----------------|
| Table stakes | Stats displayed as responsive card grid (`grid-cols-2` on mobile, `grid-cols-4` on desktop) | Near zero — Tailwind grid classes |
| Table stakes | Each stat card has minimum 44px height for readability | Near zero |
| Differentiator | Collapsible accordion sections if stats grow beyond ~15 values | Low — shadcn/ui Collapsible (already available) |
| Differentiator | Animated value counters (count-up on render) | Medium — adds delight but zero functional value; defer |
| Anti-feature | Horizontal scroll stats table | Makes comparison data harder; skip |
| Anti-feature | Paginated stats (swipe between "pages" of stats) | No benefit for 10–12 values; skip |

**Dependency on existing components:** The `computeStats` pure function is unchanged. The rendering layer switches from a table/inline layout to a card grid. shadcn/ui Card component is available. No new dependencies needed.

---

## Cross-Cutting: Touch Target Sizes

All interactive elements on mobile must meet the 44×44px minimum (iOS HIG) / 48×48dp (Material Design 3):

| Element | Current Risk | Fix |
|---------|-------------|-----|
| Clear cell button | Likely under-sized (inline table cell) | Add `min-h-[44px] min-w-[44px]` padding |
| Child assignment cell (tap to toggle parent) | Table row height may be <44px | Add `py-2.5` to ensure row height ≥44px |
| Previous week `<` button | Often rendered small in toolbars | Explicit `h-11 w-11` or padding equivalent |
| Date picker trigger | Usually OK if it's a full-width input | Verify `h-11` |
| Nav links in header | Often thin links | Add `py-3` to nav anchor elements |

---

## Existing shadcn/ui Components Available (No New Install Required)

| Component | Used For |
|-----------|---------|
| `AlertDialog` | Clear cell/range confirmation on mobile (MOB-02) |
| `Calendar` | Inside Drawer for date picker (MOB-03) |
| `DropdownMenu` | User avatar / logout in header (MOB-04) |
| `Card` (or plain Tailwind) | Statistics cards (MOB-05) |
| `Collapsible` | Optional stats accordion (future, not needed for v1.4) |

## New Component Required (One Install)

| Component | Install Command | Used For |
|-----------|----------------|---------|
| `Drawer` (Vaul-based) | `npx shadcn@canary add drawer` | Date picker on mobile (MOB-03) |

---

## Anti-Feature Summary (Do Not Build)

| Anti-Feature | Why Not |
|-------------|---------|
| Card-per-row table layout | Destroys day-comparison UX; schedule is a grid, not a list |
| Swipe-to-reveal clear | Accessibility violations (WCAG 2.5.1, screen reader conflicts); horizontal swipe conflicts with table scroll |
| Long-press for destructive actions | No keyboard/accessibility equivalent |
| Bottom tab bar with 2 items | Below HIG/MD3 minimum of 3; awkward visual balance; sticky top header is simpler and more appropriate for web |
| Horizontal scroll statistics table | Comparison data becomes inaccessible; card grid is strictly better for bounded stat sets |
| Overflow/hamburger menu for primary nav | Buries high-frequency Schedule/Stats toggle; confirmed anti-pattern by 2026 mobile nav research |
| Swipe-to-navigate weeks | Conflicts with table horizontal scroll gesture; high complexity for low value |

---

## Sources

- UX Movement — Designing User-Friendly Data Tables for Mobile Devices: https://medium.com/design-bootcamp/designing-user-friendly-data-tables-for-mobile-devices-c470c82403ad
- Smashing Magazine — Accessible Front-End Patterns for Responsive Tables (Part 1): https://www.smashingmagazine.com/2022/12/accessible-front-end-patterns-responsive-tables-part1/
- CSS-Tricks — A Table with Both a Sticky Header and a Sticky First Column: https://css-tricks.com/a-table-with-both-a-sticky-header-and-a-sticky-first-column/
- Baymard Institute — 3 Strategies for Handling Accidental Taps on Touch Devices: https://baymard.com/blog/handling-accidental-taps-on-touch-devices
- LogRocket UX — Designing Swipe-to-Delete and Swipe-to-Reveal Interactions (accessibility concerns): https://blog.logrocket.com/ux-design/accessible-swipe-contextual-action-triggers/
- UX Psychology — How to Design Better Destructive Action Modals: https://uxpsychology.substack.com/p/how-to-design-better-destructive
- UXPin — Mobile Navigation Design 8 Types Best Practices 2026: https://www.uxpin.com/studio/blog/mobile-navigation-examples/
- AppMySite — Bottom Navigation Bar in Mobile Apps 2025: https://blog.appmysite.com/bottom-navigation-bar-in-mobile-apps-heres-all-you-need-to-know/
- Design Studio UIUX — Mobile Navigation UX Best Practices 2026: https://www.designstudiouiux.com/blog/mobile-navigation-ux/
- shadcn/ui — Drawer component (Vaul): https://ui.shadcn.com/docs/components/radix/drawer
- shadcn/ui — Collapsible component: https://ui.shadcn.com/docs/components/radix/collapsible
- HubSpot — Accordion Design UI Best Practices: https://blog.hubspot.com/website/accordion-design
- Google Calendar Help — Delete an Event (Android): https://support.google.com/calendar/answer/37113?hl=en&co=GENIE.Platform%3DAndroid
- Phone Simulator — Mobile Navigation Patterns That Work in 2026: https://phone-simulator.com/blog/mobile-navigation-patterns-in-2026
