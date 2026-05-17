---
plan: 12-04
phase: 12-onboarding-wizard
status: complete
wave: 2
completed: 2026-05-16
requirements_addressed:
  - ONBR-03
key-files:
  created:
    - src/app/setup/page.tsx
    - src/app/setup/setup-wizard.tsx
    - src/app/setup/step-indicator.tsx
    - src/app/setup/steps/step-family-data.tsx
    - src/app/setup/steps/step-calendars.tsx
    - src/app/setup/steps/step-review.tsx
    - src/app/setup/steps/step-complete.tsx
    - src/components/ui/input.tsx
    - src/components/ui/label.tsx
    - src/components/ui/radio-group.tsx
    - src/components/ui/separator.tsx
    - src/components/ui/select.tsx
    - src/components/ui/command.tsx
---

## What Was Built

4-step onboarding wizard at `/setup` per the 12-UI-SPEC contract (ONBR-03).

**Step 1 — Perhetiedot:** Collects parent A name (pre-filled from Google account), parent B name, parent B email, children list (dynamic add/remove), start date (Monday-only via `isMonday()` gate), first-parent radio choice. All validation inline in Finnish.

**Step 2 — Kalenterit:** Loads parent A's Google calendars via `listCalendars()` on mount, presents Combobox (Popover + Command composition) for parent A selection, paste fallback Input for parent A and parent B calendar IDs. Collapsible Finnish instructions block.

**Step 3 — Katselmus (Review):** Read-only definition list summary of all entered data. "Tallenna ja jatka" invokes `saveWizardConfig` with loading state. Error Alert on failure. "Muokkaa" returns to Step 1.

**Step 4 — Valmis:** "Asennus valmis!" heading, body text, Phase 13 hand-off note (Alert variant=default with Info icon), "Siirry aikatauluun" Button linking to `/dashboard`.

## shadcn Primitives Added

| File | Source |
|------|--------|
| `src/components/ui/input.tsx` | `npx shadcn@canary add input` |
| `src/components/ui/label.tsx` | `npx shadcn@canary add label` |
| `src/components/ui/radio-group.tsx` | `npx shadcn@canary add radio-group` |
| `src/components/ui/separator.tsx` | `npx shadcn@canary add separator` |
| `src/components/ui/select.tsx` | `npx shadcn@canary add select` |
| `src/components/ui/command.tsx` | `npx shadcn@canary add command` |

## Auth + Redirect Logic

`src/app/setup/page.tsx` (Server Component):
- Signed-out → redirect to `/`
- Signed-in + family_config already exists → redirect to `/dashboard`
- Signed-in + no config → render `<SetupWizard>` with parentAEmail + parentAName from Google user metadata

## Deviations

**Plan 04 execution hit usage limit** after Tasks 1–3 (shadcn primitives, wizard route + orchestrator, Step 1 + 2). Task 4 (Step 3 + 4 + SUMMARY) completed inline by orchestrator:
- `step-review.tsx` was untracked in the worktree — rescued and committed before merge
- `step-complete.tsx` created inline per UI-SPEC §Step 4 spec
- SUMMARY.md created inline

## Self-Check

- [x] `/setup` route with Server Component auth gate exists
- [x] SetupWizard client orchestrator with 4-step state machine
- [x] StepIndicator with aria-current step marking
- [x] All 4 step components (step-family-data, step-calendars, step-review, step-complete)
- [x] All 6 shadcn primitives installed
- [x] Form state preserved across Back navigation (via useState in SetupWizard)
- [x] Finnish copy throughout, matching UI-SPEC copywriting contract
- [x] `saveWizardConfig` called from Step 3 with proper loading/error states
- [x] `listCalendars` called from Step 2 on mount
- [x] 47/47 vitest tests pass (no regressions)

## Self-Check: PASSED
