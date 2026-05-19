---
phase: 15-header-clear-guard-and-toolbar
plan: "01"
subsystem: layout
tags: [mobile, responsive, header, tailwind, accessibility]
dependency_graph:
  requires: []
  provides:
    - Mobile-responsive header component with avatar fallback
  affects:
    - src/components/layout/header.tsx
tech_stack:
  added: []
  patterns:
    - hidden sm:block / hidden sm:inline Tailwind responsive visibility
    - Avatar fallback with first initial in colored circle
    - Icon-only button on mobile with aria-label
key_files:
  modified:
    - src/components/layout/header.tsx
decisions:
  - "font-bold changed to font-semibold on title to comply with UI-SPEC typography (only 400 and 600/semibold weights)"
  - "Avatar fallback uses bg-primary text-primary-foreground for theme consistency (D-09)"
  - "aria-label={fullName} on fallback div because name span is hidden on mobile"
metrics:
  duration_minutes: 1
  completed_date: "2026-05-19"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 1
---

# Phase 15 Plan 01: Responsive Header Summary

**One-liner:** Mobile-responsive header hiding title and name on narrow viewports, icon-only sign-out button, and avatar fallback circle with first initial.

## What Was Built

Modified `src/components/layout/header.tsx` (Server Component) to fit 360px viewports without overflow:

- Header padding reduced from `px-6 py-4` to `px-3 py-3 sm:px-6 sm:py-4`
- App title "Vuoroasuminen" hidden on mobile (`hidden sm:block`), `font-bold` changed to `font-semibold`
- Full name span hidden on mobile (`hidden sm:inline`)
- Avatar fallback: when `avatar_url` is null, renders a `w-8 h-8 rounded-full bg-primary text-primary-foreground` div with the user's first initial; `aria-label={fullName}` since name is hidden on mobile
- Sign-out button: `LogOut` icon (lucide-react, `sm:hidden`) on mobile, "Kirjaudu ulos" text (`hidden sm:inline`) on desktop; `aria-label="Kirjaudu ulos"` on the button element
- Component remains a Server Component — no "use client" added

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1: Responsive header | ad7d3f6 | feat(15-01): responsive header — mobile shrink, avatar fallback, padding |

## Acceptance Criteria Verification

All criteria passed:
- `px-3 py-3 sm:px-6 sm:py-4` present on header element
- `hidden sm:block` on title span
- `font-semibold` on title span (no font-bold, no font-medium anywhere)
- `hidden sm:inline` on name span and Kirjaudu ulos span
- `aria-label={fullName}` on avatar fallback div
- `fullName.charAt(0).toUpperCase()` for first initial
- `LogOut` imported from lucide-react and used with `sm:hidden`
- `aria-label="Kirjaudu ulos"` on Button
- No "use client" directive
- `npx tsc --noEmit` exits 0

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None. The header is a Server Component; user metadata is trusted server-side data from Supabase Auth. All threats in the plan's threat model were accepted (T-15-01 spoofing of avatar fallback initial, T-15-02 aria-label information disclosure).

## Self-Check: PASSED

- FOUND: src/components/layout/header.tsx
- FOUND: commit ad7d3f6 (feat(15-01): responsive header — mobile shrink, avatar fallback, padding)
