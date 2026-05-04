# Phase 5: View Window Control - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-04
**Phase:** 05-view-window-control
**Areas discussed:** Preference storage, Data fetching, Controls placement, Reset behavior

---

## Preference Storage (VIEW-04)

| Option | Description | Selected |
|--------|-------------|----------|
| localStorage | Instant, per-device, no migration | |
| DB user_preferences table | Synced across devices, needs migration | |
| Auth.js session / JWT | JWT cookie, size limits | |
| **URL search parameter** | `?viewStart=YYYY-MM-DD` — reload-safe, shareable | ✓ |

**User's choice:** URL parameter — "store it in url parameter - reload preserves it, and the url can be sent to the other parent if needed. No need to preserve it across sessions."

**Notes:** User clarified first what "preferences" meant (just a single start date string). Once clarified, URL param was the clear choice. Shareable URL is a bonus feature.

---

## Data Fetching

| Option | Description | Selected |
|--------|-------------|----------|
| **Server re-fetch on URL change** | Next.js re-renders with new searchParams | ✓ |
| Pre-load extra weeks up front | Client-side slicing, wastes data | |
| Client-side Server Action | Hybrid, more complex | |

**User's choice:** Server re-fetch (recommended). Natural fit given URL param decision.

---

## URL Navigation Mode

| Option | Description | Selected |
|--------|-------------|----------|
| **router.replace() — no history** | Back button exits dashboard | ✓ |
| router.push() — back undoes | History stacks up | |

**User's choice:** Replace — no history stacking.

---

## Controls Placement

| Option | Description | Selected |
|--------|-------------|----------|
| **Toolbar above table, below header** | Separate row between header and table | ✓ |
| Inside sticky table header | Cramped, mixed with column headers | |

**User's choice:** Toolbar above table (with mockup preview).

---

## Tänään Button Location

| Option | Description | Selected |
|--------|-------------|----------|
| **Move to toolbar** | All navigation controls in one place | ✓ |
| Keep floating bottom-right | Always visible on scroll | |

**User's choice:** Move to toolbar. Floating button removed.

---

## Reset / Tänään Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| **Tänään resets view + scrolls** | Clears viewStart from URL + scroll-to-today | ✓ |
| Separate Reset button | Two controls for two actions | |
| No reset control | Date picker only way to go forward | |

**User's choice:** Tänään is the combined reset + scroll control.

---

## Date Picker Library

| Option | Description | Selected |
|--------|-------------|----------|
| **shadcn DatePicker** | Popover + Calendar + react-day-picker | ✓ |
| Native `<input type="date">` | Zero deps, browser-native look | |

**User's choice:** shadcn DatePicker (recommended). Consistent with existing UI patterns.

---

## Backward Navigation Limit

| Option | Description | Selected |
|--------|-------------|----------|
| **No limit** | Goes as far back as DB data exists | ✓ |
| Soft limit: N weeks | Button disabled at cap | |
| Schedule data start | Dynamic limit from first DB entry | |

**User's choice:** No limit. Simple.

---

## Claude's Discretion

- Loading state during server re-render (loading.tsx or Suspense)
- Toolbar button spacing and alignment
- Whether viewStart snaps to Monday or allows any date

## Deferred Ideas

None.
