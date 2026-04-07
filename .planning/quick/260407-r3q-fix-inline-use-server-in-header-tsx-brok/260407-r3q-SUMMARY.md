---
phase: 260407-r3q
plan: "01"
subsystem: layout/auth
tags: [fix, server-actions, client-boundary, build]
dependency_graph:
  requires: []
  provides: [signOutAction, build-passing]
  affects: [header, dashboard-shell, dashboard-page]
tech_stack:
  added: []
  patterns: [dedicated-actions-file, header-as-prop-slot]
key_files:
  created:
    - src/actions/auth.ts
  modified:
    - src/components/layout/header.tsx
    - src/components/schedule/dashboard-shell.tsx
    - src/app/dashboard/page.tsx
decisions:
  - signOutAction extracted to src/actions/auth.ts with top-level use server directive
  - Header rendered server-side by dashboard/page.tsx and passed as React.ReactNode prop to DashboardShell
  - PublishButton moved to toolbar row below header inside DashboardShell to retain days state access
metrics:
  duration: "~5 minutes"
  completed: "2026-04-07"
  tasks: 2
  files: 4
---

# Phase 260407-r3q Plan 01: Fix Inline use server in header.tsx Summary

**One-liner:** Extracted signOutAction to a dedicated server actions file and restructured the DashboardShell/Header boundary to eliminate Client Component bundling of pg/auth server modules.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create src/actions/auth.ts with signOutAction | 0d9585f | src/actions/auth.ts |
| 2 | Update header.tsx to use imported signOutAction + fix client boundary | 1dcd532 | src/components/layout/header.tsx, src/components/schedule/dashboard-shell.tsx, src/app/dashboard/page.tsx |

## Decisions Made

1. **signOutAction in dedicated file**: Created `src/actions/auth.ts` with top-level `"use server"` directive following the same pattern as `src/actions/schedule.ts`. This makes the action callable across Server and Client Component boundaries.

2. **Header as prop slot**: `DashboardShell` (`"use client"`) no longer imports `Header` directly. Instead, `dashboard/page.tsx` (Server Component) renders `<Header />` server-side and passes it as `header: React.ReactNode` prop to `DashboardShell`. This keeps all DB-dependent server code out of the client bundle.

3. **PublishButton in toolbar**: Since `PublishButton` needs `days` state from `DashboardShell`, it remains inside `DashboardShell` rendered in a toolbar row below the header rather than inside the header itself.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed Client Component import boundary causing pg/dns/fs bundling errors**

- **Found during:** Task 2 verification (npm run build)
- **Issue:** `dashboard-shell.tsx` (`"use client"`) imported `Header` which imports `@/auth` which imports `src/db/index.ts` → `pg`. Node.js native modules (`dns`, `fs`, `stream`) were included in the client bundle, causing 6 Turbopack build errors.
- **Fix:** Removed `Header` import from `dashboard-shell.tsx`. Updated `dashboard/page.tsx` to render `<Header />` server-side and pass it as a `header` prop to `DashboardShell`. Moved `PublishButton` to a toolbar row inside `DashboardShell` below the header slot.
- **Files modified:** `src/components/schedule/dashboard-shell.tsx`, `src/app/dashboard/page.tsx`
- **Commit:** 1dcd532

## Known Stubs

None.

## Self-Check: PASSED

- src/actions/auth.ts: exists
- src/components/layout/header.tsx: no inline "use server"
- src/components/schedule/dashboard-shell.tsx: no Header import
- Build: compiled successfully (TypeScript passed, no bundling errors)
- Commits: 0d9585f, 1dcd532
