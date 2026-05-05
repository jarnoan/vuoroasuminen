---
phase: 06-extend-schedule
plan: "02"
subsystem: client-components
status: partial — awaiting human UAT (Task 3)
tags:
  - client-component
  - shadcn
  - schedule
  - extend
dependency_graph:
  requires:
    - src/actions/schedule.ts::extendSchedule (Plan 01)
    - src/components/ui/popover.tsx
    - src/components/ui/calendar.tsx
    - src/components/ui/button.tsx
    - src/components/schedule/dashboard-shell.tsx
  provides:
    - ExtendPanel client component (src/components/schedule/extend-panel.tsx)
    - ExtendPanel mounted in DashboardShell below ScheduleWithRealtime
  affects:
    - src/components/schedule/dashboard-shell.tsx (2 lines added)
tech_stack:
  added: []
  patterns:
    - inline expand panel (isOpen boolean state — no Dialog)
    - isPending boolean for Server Action loading state
    - navigateTo helper (router.replace + URLSearchParams) copied from view-toolbar.tsx
    - fi locale aliasing (fiFormat from date-fns/locale, fiPicker from react-day-picker/locale)
    - endOfWeek(date, { weekStartsOn: 1 }) for Sunday snap
key_files:
  created:
    - src/components/schedule/extend-panel.tsx
  modified:
    - src/components/schedule/dashboard-shell.tsx
decisions:
  - "Inline panel (isOpen boolean) instead of Dialog — no analog existed in codebase; matches D-02 from CONTEXT.md"
  - "isPending boolean instead of phase enum (publish-button uses 3-phase enum; extend has one async step)"
  - "fi locale aliased: fiFormat (date-fns) for format() calls, fiPicker (react-day-picker) for Calendar locale prop — matches PATTERNS.md guidance"
  - "rangeEnd derived via useMemo, updates live on every state change — satisfies D-04 (no separate preview step)"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-05"
  tasks_completed: 2
  tasks_pending: 1
  files_changed: 2
requirements:
  - EXTEND-01
  - EXTEND-02
  - EXTEND-03
---

# Phase 6 Plan 2: ExtendPanel UI Component Summary

**One-liner:** `ExtendPanel` Client Component with trigger button, inline week/date-picker modes, live date preview, and auto-navigation to first new week on confirm — mounted below ScheduleWithRealtime in DashboardShell.

**Status: PARTIAL — Tasks 1 and 2 complete; Task 3 (human UAT) pending.**

## What Was Built

### Task 1: `src/components/schedule/extend-panel.tsx` (NEW)

A `"use client"` Client Component implementing all of D-01 through D-09 from CONTEXT.md and the 06-UI-SPEC.md visual contract.

**State machines:**

1. **Mode toggle** (`"weeks" | "date"`):
   - Default: `"weeks"` — shows number input pre-filled with 12
   - Toggle link `tai valitse päättymispäivä →` switches to `"date"` — shows Popover + Calendar
   - Toggle link `tai määritä viikkoina ←` switches back to `"weeks"`
   - Mode change clears error message; does not reset weeks value

2. **isPending lifecycle** (single boolean):
   - `false` → idle (Vahvista enabled, Peruuta enabled)
   - `true` → pending (Vahvista shows "Lisätään...", both buttons disabled)
   - On success: `resetPanel()` called (collapses, resets mode/weeks/pickedEnd/error), then `navigateTo(newStartDate)`
   - On error (`result.success === false`): `setErrorMsg(result.error)` — panel stays open
   - On throw: `setErrorMsg("Viikkojen lisääminen epäonnistui. Yritä uudelleen.")`
   - `finally` block always sets `isPending = false`

**Key implementation details:**

- `rangeStart = addDays(parseISO(scheduleEndDate), 1)` — first new day (Monday)
- `rangeEnd` derived via `useMemo` from mode + weeks/pickedEnd — updates live (D-04)
- In weeks mode: `endOfWeek(addWeeks(rangeStart, weeks - 1), { weekStartsOn: 1 })` — snaps to Sunday
- In date mode: `endOfWeek(pickedEnd, { weekStartsOn: 1 })` — also snaps to Sunday (D-07)
- `previewLabel` via `useMemo`: `format(rangeStart, "EEEEEE d.M.", { locale: fiFormat })` — Finnish abbreviated weekdays
- `navigateTo` helper: sets `viewStart` param, calls `router.replace()` — copied from view-toolbar.tsx

**All Finnish copy strings (cross-checked vs 06-UI-SPEC.md Copywriting Contract):**

| Element | Copy | Location |
|---------|------|----------|
| Trigger button | `+ Lisää viikkoja` | line 114 |
| Week count label | `Lisätään: [n] viikkoa` | lines 127, 142 |
| Toggle to date picker | `tai valitse päättymispäivä →` | line 153 |
| Toggle back to weeks | `tai määritä viikkoina ←` | line 191 |
| Date picker label | `Päättyy:` | line 159 |
| Date preview | `Ajanjakso: ${startLabel} – ${endLabel}` | line 51 |
| Confirm idle | `Vahvista` | line 210 |
| Confirm pending | `Lisätään...` | line 210 |
| Cancel | `Peruuta` | line 219 |
| Error | `Viikkojen lisääminen epäonnistui. Yritä uudelleen.` | line 93 |

**Accessibility:**
- `aria-label="Viikkojen määrä"` on number input
- `aria-live="polite"` on date preview paragraph
- `role="alert"` on error paragraph
- Toggle links use `<button type="button">` (keyboard activatable)

**Threat mitigations (T-06-09, T-06-14):**
- `min={1}` / `max={52}` on number input (UX hint only; server validates)
- `disabled={isPending}` on both Vahvista and Peruuta prevents re-entry (D-14)
- `navigateTo` uses `result.newStartDate` from server (not user-typed string) — T-06-11

### Task 2: `src/components/schedule/dashboard-shell.tsx` (MODIFIED)

Two surgical changes only:

1. Added import line after ViewToolbar import:
   ```typescript
   import { ExtendPanel } from "./extend-panel"
   ```

2. Added `<ExtendPanel scheduleEndDate={initialData.endDate} />` immediately after `<ScheduleWithRealtime>` inside `<main>`:
   ```typescript
   <main className="flex-1 p-4">
     <ScheduleWithRealtime initialData={initialData} onDaysChange={setDays} publishRef={publishRef} />
     <ExtendPanel scheduleEndDate={initialData.endDate} />
   </main>
   ```

All existing code (useState, useRef, handlePublished, ViewToolbar, PublishButton, outer div) unchanged.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 3967d75 | feat(06-02) | Create ExtendPanel client component |
| 26cc4f1 | feat(06-02) | Mount ExtendPanel in DashboardShell below schedule table |

## Acceptance Criteria Verification

**Task 1 — extend-panel.tsx:**
- `head -1` → `"use client"` — PASS
- `export function ExtendPanel` — 1 match — PASS
- `scheduleEndDate: string` in props interface — 1 match — PASS
- `import { extendSchedule } from "@/actions/schedule"` — 1 match — PASS
- All 10 Finnish copy strings present verbatim — PASS
- `aria-label="Viikkojen määrä"` — 1 match — PASS
- `aria-live="polite"` — 1 match — PASS
- `role="alert"` — 1 match — PASS
- `endOfWeek` with `weekStartsOn: 1` — 3 matches — PASS
- `router.replace` — 1 match — PASS
- `min={1}` / `max={52}` on input — PASS
- `border rounded-lg p-3 bg-muted/30 text-sm` panel container — PASS
- `fi as fiFormat` / `fi as fiPicker` locale aliases — PASS
- `npx tsc --noEmit` — no errors in extend-panel.tsx — PASS
- ESLint — no errors — PASS

**Task 2 — dashboard-shell.tsx:**
- `import { ExtendPanel } from "./extend-panel"` — 1 match — PASS
- `<ExtendPanel scheduleEndDate={initialData.endDate} />` — 1 match — PASS
- `<ScheduleWithRealtime>` still present — 1 match — PASS
- `<ViewToolbar>` still present — 1 match — PASS
- `<PublishButton>` still present — 1 match — PASS
- ExtendPanel appears after ScheduleWithRealtime inside `<main>` — PASS
- `npx tsc --noEmit` — no errors in dashboard-shell.tsx — PASS
- ESLint — no errors — PASS

## Deviations from Plan

None — plan executed exactly as written. The component content from the plan's `<action>` block was used verbatim.

## Known Stubs

None — `ExtendPanel` is fully wired: it imports and calls `extendSchedule`, uses `router.replace` for navigation, and receives `initialData.endDate` from DashboardShell. No placeholder data or hardcoded empty values.

## Threat Flags

No new threat surface beyond what the plan's `<threat_model>` covers. All four threats (T-06-09, T-06-10, T-06-11, T-06-14) are mitigated as specified.

## Pending: Task 3 — Human UAT

Task 3 is a `checkpoint:human-verify` gate. The executor stopped here as instructed.

**What to test:**
1. `+ Lisää viikkoja` trigger button visible below schedule table
2. Week-count mode: inline panel, pre-filled 12, live preview, Vahvista → collapses + navigates
3. Date-picker mode: toggle link, Finnish Calendar popover, Sunday snap, live preview, Vahvista
4. Peruuta: collapses panel without mutation
5. Idempotency: second extend into same range returns success, no duplicates
6. Validation error: invalid input shows inline Finnish error; panel stays open
7. Other parent's view: new entries appear via Realtime CDC; their `viewStart` unchanged

See full UAT checklist in the plan's Task 3 `<how-to-verify>` section.

## Self-Check: PASSED

- FOUND: src/components/schedule/extend-panel.tsx
- FOUND: src/components/schedule/dashboard-shell.tsx (modified)
- FOUND: commit 3967d75 (feat(06-02): create ExtendPanel client component)
- FOUND: commit 26cc4f1 (feat(06-02): mount ExtendPanel in DashboardShell)
