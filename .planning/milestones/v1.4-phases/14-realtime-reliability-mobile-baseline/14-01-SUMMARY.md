---
phase: 14-realtime-reliability-mobile-baseline
plan: "01"
subsystem: schedule-actions, app-layout, global-styles
tags: [server-action, viewport, mobile-baseline, css]
dependency_graph:
  requires: []
  provides:
    - getScheduleDays Server Action (src/actions/schedule.ts)
    - Next.js Viewport export (src/app/layout.tsx)
    - overflow-x: hidden mobile guard (src/app/globals.css)
  affects:
    - src/components/schedule/realtime-provider.tsx (will import getScheduleDays in plan 02)
tech_stack:
  added: []
  patterns:
    - Server Action with requireAuthorizedParent() auth guard (established pattern)
    - Next.js Viewport export via typed constant (not raw meta tag)
    - CSS overflow-x guard inside @layer base html rule
key_files:
  created: []
  modified:
    - src/actions/schedule.ts
    - src/app/layout.tsx
    - src/app/globals.css
decisions:
  - Use `result` (not `window`) as intermediate variable name in getScheduleDays to avoid shadowing browser global
  - viewport export placed immediately after metadata export, before RootLayout function
  - overflow-x: hidden added inside existing html rule in @layer base (not as a separate rule)
metrics:
  duration: "~2 minutes"
  completed: "2026-05-18T05:54:12Z"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 3
---

# Phase 14 Plan 01: getScheduleDays Action + Mobile Viewport Baseline Summary

**One-liner:** Added getScheduleDays Server Action with auth guard plus typed Viewport export and overflow-x guard for mobile baseline.

## What Was Built

Three targeted changes to three files, each independent:

1. **`src/actions/schedule.ts`** — New `getScheduleDays(viewStart?: string): Promise<ScheduleDay[]>` export. Calls `requireAuthorizedParent()` before any DB access (same auth pattern as all other exports in the file), then delegates to `getScheduleWindow(viewStart)` and returns `result.days`. This is the Server Action that plan 02's visibility recovery mechanism will call to re-fetch schedule data after a background tab wakes up.

2. **`src/app/layout.tsx`** — Extended the `import type { Metadata }` line to include `Viewport`, and added `export const viewport: Viewport = { width: "device-width", initialScale: 1 }` immediately after the metadata export. Uses the Next.js Viewport API (D-06) — no raw `<meta name="viewport">` tag.

3. **`src/app/globals.css`** — Added `overflow-x: hidden;` as a second declaration inside the existing `html { @apply font-sans; }` rule within `@layer base`. Prevents horizontal scroll bleed on 360–430px viewports (D-07). One occurrence only; no duplicate rule outside the layer.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add getScheduleDays Server Action | 636dd05 | src/actions/schedule.ts |
| 2 | Add viewport export to layout.tsx (D-06) | 7f5ddcf | src/app/layout.tsx |
| 3 | Add overflow-x: hidden to globals.css (D-07) | 571683a | src/app/globals.css |

## Verification

- `npx tsc --noEmit` → **zero errors**
- `grep "export async function getScheduleDays" src/actions/schedule.ts` → 1 match
- `grep "export const viewport" src/app/layout.tsx` → 1 match
- `grep "overflow-x: hidden" src/app/globals.css` → 1 match
- `grep -c "html {" src/app/globals.css` → 1 (no duplicate html rule)

## Threat Model Compliance

| Threat ID | Status |
|-----------|--------|
| T-14-01 (EoP: getScheduleDays auth) | Mitigated — `requireAuthorizedParent()` is the first call in the function body |
| T-14-02 (Info Disclosure: return value) | Accepted — same data the authenticated parent already sees; RLS scopes at DB level |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all three changes are complete and functional. `getScheduleDays` will have no callers until plan 02 wires it into the realtime-provider, but the function itself is fully implemented.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes beyond the Server Action already covered by the plan's threat model.

## Self-Check: PASSED

- [x] `src/actions/schedule.ts` — modified, committed at 636dd05
- [x] `src/app/layout.tsx` — modified, committed at 7f5ddcf
- [x] `src/app/globals.css` — modified, committed at 571683a
- [x] All three commits verified in git log
- [x] TypeScript: zero errors
