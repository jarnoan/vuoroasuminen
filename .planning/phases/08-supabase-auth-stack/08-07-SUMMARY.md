---
phase: 08-supabase-auth-stack
plan: "07"
subsystem: dashboard-banner
tags: [dashboard, banner, shadcn, alert, owner-token, sauth-07]
dependency_graph:
  requires: [08-03, 08-06]
  provides: [owner-warning-banner, showOwnerWarning-prop]
  affects: [src/app/dashboard/page.tsx, src/components/schedule/dashboard-shell.tsx]
tech_stack:
  added: [shadcn Alert component (base-nova style)]
  patterns: [server-component-DB-check, client-component-dismiss-state, shadcn-primitive]
key_files:
  created:
    - src/components/ui/alert.tsx
    - src/components/owner-warning-banner.tsx
  modified:
    - src/components/schedule/dashboard-shell.tsx
    - src/app/dashboard/page.tsx
decisions:
  - "shadcn Alert (default variant) used per UI-SPEC; not destructive — owner-not-signed-in is informational"
  - "Per-session dismiss via useState only (no localStorage) per D-07"
  - "Token-row query runs in parallel with schedule queries inside existing Promise.all"
  - "config.parents[0].ownerEmail is canonical (D-01 single-owner mode)"
metrics:
  duration: "259s"
  completed: "2026-05-10"
  tasks_completed: 4
  files_changed: 4
---

# Phase 08 Plan 07: Dashboard Owner-Token Warning Banner Summary

## One-liner

Dismissible Finnish warning banner in dashboard when calendar owner has no `user_google_tokens` row, using shadcn Alert with per-session useState dismiss and Supabase OAuth CTA.

## What Was Built

Four files implement SAUTH-07 — a dashboard warning banner that surfaces GCal sync failures before the user presses publish:

1. **`src/components/ui/alert.tsx`** — shadcn Alert primitive installed via `npx shadcn@latest add alert` using the project's base-nova style. Exports `Alert`, `AlertTitle`, `AlertDescription`, `AlertAction`.

2. **`src/components/owner-warning-banner.tsx`** — New Client Component. Renders a shadcn Alert (default variant) with verbatim Finnish body copy "Kalenterin omistaja ei ole kirjautunut — kalenterisynkronointi ei toimi." and a "Kirjaudu sisään" CTA that triggers Supabase OAuth with the same scopes/queryParams as `sign-in-button.tsx`. Dismissed in-memory via `useState(false)` (no localStorage per D-07). X dismiss button has `aria-label="Sulje ilmoitus"` per UI-SPEC.

3. **`src/components/schedule/dashboard-shell.tsx`** — Added optional `showOwnerWarning?: boolean` prop (defaults to false). Banner renders between `{header}` and `<ViewToolbar>` per UI-SPEC. All existing logic preserved verbatim.

4. **`src/app/dashboard/page.tsx`** — Server Component extended with: imports for `eq`, `db`, `userGoogleTokens`, `config`; reads `config.parents[0].ownerEmail`; adds a parallel token-row query to the existing `Promise.all`; derives `showOwnerWarning = !tokenRow`; passes it to `<DashboardShell>`.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | e182691 | feat(08-07): install shadcn Alert component |
| 2 | b847393 | feat(08-07): create OwnerWarningBanner client component |
| 3 | 01ced85 | feat(08-07): add showOwnerWarning prop to DashboardShell |
| 4 | c96fecb | feat(08-07): query owner token row in dashboard page, pass showOwnerWarning |

## Decisions Made

- **shadcn Alert default variant**: UI-SPEC explicitly requires `variant="default"` (not destructive). Owner-not-signed-in is informational, not an error.
- **Per-session dismiss only**: D-07 mandates `useState` with no persistence. Banner reappears on every page reload until the token row exists.
- **Parallel token query**: Added as third element to existing `Promise.all` — runs concurrently with schedule queries (negligible latency, indexed PK lookup on a small table).
- **`config.parents[0].ownerEmail` canonical**: D-01 single-owner mode — both parent entries share the same ownerEmail; index 0 is used per plan spec.

## Deviations from Plan

None — plan executed exactly as written.

The shadcn install added `AlertAction` export in addition to the three required exports (`Alert`, `AlertTitle`, `AlertDescription`). This is a standard part of the shadcn Alert primitive and is not used by this plan — it's inert additional API surface, not a deviation.

## Known Stubs

None. The banner's data source (`user_google_tokens` query in dashboard page) is fully wired. The component renders real state from the database on every request.

## Threat Flags

No new security-relevant surface beyond what is documented in the plan's `<threat_model>`. The dashboard page gains one additional DB read (admin Drizzle, indexed PK) and the banner CTA reuses the existing OAuth flow from Plan 04.

## Self-Check: PASSED

Files verified to exist:
- FOUND: src/components/ui/alert.tsx
- FOUND: src/components/owner-warning-banner.tsx
- FOUND: src/components/schedule/dashboard-shell.tsx (modified)
- FOUND: src/app/dashboard/page.tsx (modified)

Commits verified in git log:
- FOUND: e182691
- FOUND: b847393
- FOUND: 01ced85
- FOUND: c96fecb
