---
phase: 12-onboarding-wizard
plan: "03"
subsystem: client-component-prop-threading
tags:
  - refactor
  - client-side
  - props
  - data-minimization

dependency_graph:
  requires:
    - getAppConfig() async function (Plan 01)
    - Dashboard server page with await getAppConfig() (Plan 02)
  provides:
    - No client component imports config from @/config/app
    - Props chain: dashboard/page.tsx → DashboardShell → ScheduleWithRealtime → ScheduleTable → ScheduleCell
    - StatsPanel receives parents via renderAbove callback
    - ClearPanel receives childCount directly from DashboardShell
  affects:
    - src/app/dashboard/page.tsx (builds parentsForUI + passes new props)
    - src/components/schedule/dashboard-shell.tsx (widens props interface)
    - src/components/schedule/schedule-with-realtime.tsx (forwards parents)
    - src/components/schedule/schedule-table.tsx (forwards parents to ScheduleCell)
    - src/components/schedule/schedule-cell.tsx (consumes parents prop)
    - src/components/schedule/stats-panel.tsx (consumes parents prop)
    - src/components/schedule/clear-panel.tsx (consumes childCount prop)

tech_stack:
  added: []
  patterns:
    - "Data minimization: dashboard page maps config.parents to {id, name} only — email/calendarId/ownerEmail never reach client bundle"
    - "ParentId imported from @/lib/schedule/types (re-export of @/config/app) — consistent with existing schedule component conventions"
    - "childCount added to useMemo dep array in ClearPanel (correctness)"

key_files:
  created: []
  modified:
    - src/app/dashboard/page.tsx
    - src/components/schedule/dashboard-shell.tsx
    - src/components/schedule/schedule-with-realtime.tsx
    - src/components/schedule/schedule-table.tsx
    - src/components/schedule/schedule-cell.tsx
    - src/components/schedule/stats-panel.tsx
    - src/components/schedule/clear-panel.tsx

decisions:
  - "ParentId imported from @/lib/schedule/types (not directly from @/config/app) — consistent with existing schedule component import style"
  - "parentsForUI mapped to {id, name} only in dashboard/page.tsx — data minimization per T-12-19 (V8.3.1)"
  - "childCount added to ClearPanel useMemo dep array — correctness fix discovered during implementation"

metrics:
  duration: "8 minutes"
  completed_date: "2026-05-16"
  tasks_completed: 2
  files_changed: 7
---

# Phase 12 Plan 03: Client Component Prop Threading Summary

**One-liner:** Eliminated all 3 remaining `import config from "@/config/app"` client component references by threading `parents` (id+name only) and `childCount` as React props from the dashboard server page down through the full component tree.

## What Was Built

### Prop Chain

The data flow after Plan 03:

```
src/app/dashboard/page.tsx  (Server Component)
  └─ parentsForUI = config.parents.map(p => ({ id: p.id, name: p.name }))
  └─ <DashboardShell parents={parentsForUI} childCount={config.children.length} ...>

src/components/schedule/dashboard-shell.tsx  (Client Component — new props: parents, childCount)
  └─ <ScheduleWithRealtime parents={parents} ...>
  └─ <ClearPanel childCount={childCount} />

src/components/schedule/schedule-with-realtime.tsx  (Client Component — new prop: parents)
  └─ renderAbove={(days) => <StatsPanel days={days} parents={parents} />}
  └─ <ScheduleTable parents={parents} ...>

src/components/schedule/schedule-table.tsx  (Client Component — new prop: parents)
  └─ <ScheduleCell parents={parents} ...>   (every render site)

src/components/schedule/schedule-cell.tsx  (Client Component — new prop: parents)
  └─ parents.find((p) => p.id === parentId)?.name ?? parentId

src/components/schedule/stats-panel.tsx  (Client Component — new prop: parents)
  └─ computeStats(days, parents)
  └─ parents.find((p) => p.id === id)?.name ?? id

src/components/schedule/clear-panel.tsx  (Client Component — new prop: childCount)
  └─ useMemo: `Tyhjennetään: ${days} päivää (${childCount} lasta)`, [pickedStart, pickedEnd, childCount]
```

### Data Minimization (T-12-19 / ASVS V8.3.1)

The dashboard server page narrows the full `AppConfig` parent shape before crossing the server/client boundary:

```typescript
// Only id + name cross into the client bundle
const parentsForUI = config.parents.map((p) => ({ id: p.id, name: p.name }))
```

`email`, `calendarId`, and `ownerEmail` never appear in `schedule-cell.tsx`, `stats-panel.tsx`, or `clear-panel.tsx`. Verified: `grep -E "email|calendarId|ownerEmail" <leaf files>` returns 0 matches.

### TypeScript Status

`npx tsc --noEmit` produces 0 errors in all 7 Plan 03 modified files.

Remaining TS errors in the repo are all pre-existing and out of Plan 03 scope:
- `src/db/reset.ts` + `src/db/seed.ts` — dev utilities still using legacy default import (not in Phase 12 scope)
- `src/app/setup/steps/step-complete.tsx` — Plan 04 wizard UI (different wave)
- `src/components/ui/command.tsx` — missing `cmdk` type declarations (pre-existing)
- `src/actions/setup.ts` + `src/actions/setup.test.ts` — Zod API version mismatch (Plan 01 scope)

### Vitest

All 47 tests pass: `npx vitest run` → Tests 47 passed (47), 6 test files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing correctness] Added `childCount` to ClearPanel useMemo dep array**
- **Found during:** Task 2 implementation
- **Issue:** The original `config.children.length` was a stable module-scope value so the dep array omission was harmless. After converting to a prop, `childCount` can change between renders — omitting it from the dep array would cause stale closure bugs.
- **Fix:** Added `childCount` to the useMemo dependency array: `[pickedStart, pickedEnd, childCount]`
- **Files modified:** `src/components/schedule/clear-panel.tsx`
- **Commit:** d9c4fe0

## Known Stubs

None — all prop wiring uses real data flowing from the DB-backed `getAppConfig()` call in the dashboard server page. The display will only render correctly once a `family_config` row exists (Plan 04 wizard creates it).

## Threat Flags

No new network endpoints, auth paths, or schema changes. T-12-19 (Information Disclosure) actively mitigated: `parentsForUI` is built with only `id` and `name`, confirmed by `grep` returning 0 matches for `email|calendarId|ownerEmail` in the three leaf components.

## What's Next

- **Plan 04** (Wave 3, parallel): Wizard UI at `/setup` — the 4-step form that writes the `family_config` row
- **Plan 05** (Wave 4): Smoke test — once a `family_config` row exists, confirm dashboard renders parent names, stats panel shows correct names, clear panel shows correct child count

## Self-Check: PASSED

All 7 modified files present on disk and type-clean (within plan scope). Task commits verified:
- 36d9977 — Task 1: DashboardShell props widened + containers threaded
- d9c4fe0 — Task 2: config imports removed from leaf components
