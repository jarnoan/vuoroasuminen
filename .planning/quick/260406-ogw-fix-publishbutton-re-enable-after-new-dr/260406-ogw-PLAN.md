---
phase: quick
plan: 260406-ogw
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/schedule/dashboard-shell.tsx
  - src/components/schedule/publish-button.tsx
  - src/components/schedule/schedule-with-realtime.tsx
  - src/components/schedule/schedule-table.tsx
  - src/app/dashboard/page.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "PublishButton is enabled after the user creates new draft entries (toggles a cell)"
    - "PublishButton becomes disabled immediately after a successful publish"
    - "PublishButton reflects live days state, not stale initial data"
  artifacts:
    - path: "src/components/schedule/dashboard-shell.tsx"
      provides: "Client shell holding shared days state, passes live days to PublishButton"
    - path: "src/components/schedule/publish-button.tsx"
      provides: "PublishButton driven by days prop, no hasPublished ratchet"
  key_links:
    - from: "src/components/schedule/schedule-table.tsx"
      to: "src/components/schedule/dashboard-shell.tsx"
      via: "onDaysChange callback prop"
      pattern: "onDaysChange\\?\\."
    - from: "src/components/schedule/dashboard-shell.tsx"
      to: "src/components/schedule/publish-button.tsx"
      via: "days prop (live state)"
      pattern: "days=\\{days\\}"
---

<objective>
Fix PublishButton failing to re-enable after new drafts are created.

Purpose: The current implementation stores `hasPublished` state that never resets, and derives
draft count from stale `initialData` (the server snapshot). When the user toggles cells to draft
after publishing, PublishButton remains disabled because it never sees the updated days.

Output: A `DashboardShell` client component lifts `days` state and passes it live to
PublishButton. PublishButton is simplified to receive `days: ScheduleDay[]` and derive
`draftCount` directly from that prop — no `hasPublished` ratchet needed.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md

Key types (from src/lib/schedule/types.ts — do not re-declare):
- `ScheduleDay` — one day row with `cells`, `date`, `notes`, etc.
- `DateWindow` — `{ days: ScheduleDay[], startDate, endDate }`
- `ParentId` — `"mother" | "father"`
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create DashboardShell and simplify PublishButton</name>
  <files>
    src/components/schedule/dashboard-shell.tsx
    src/components/schedule/publish-button.tsx
  </files>
  <action>
Create `src/components/schedule/dashboard-shell.tsx` as a "use client" component:

```tsx
"use client"

import { useState } from "react"
import Header from "@/components/layout/header"
import { PublishButton } from "./publish-button"
import { ScheduleWithRealtime } from "./schedule-with-realtime"
import type { DateWindow, ScheduleDay } from "@/lib/schedule/types"

interface DashboardShellProps {
  initialData: DateWindow
}

export function DashboardShell({ initialData }: DashboardShellProps) {
  const [days, setDays] = useState<ScheduleDay[]>(initialData.days)

  return (
    <div className="min-h-screen flex flex-col">
      <Header>
        <PublishButton days={days} />
      </Header>
      <main className="flex-1 p-4">
        <ScheduleWithRealtime initialData={initialData} onDaysChange={setDays} />
      </main>
    </div>
  )
}
```

Then rewrite `src/components/schedule/publish-button.tsx`:
- Change prop from `initialData: DateWindow` to `days: ScheduleDay[]`
- Remove `hasPublished` state entirely
- Derive `draftCount` directly from `days` prop (no ratchet, no override):
  `const draftCells = days.flatMap(day => day.cells.filter(cell => cell.status === "draft"))`
- Derive `draftDays`, `firstDraftDate`, `lastDraftDate` from the `days` prop the same way
- Keep `open`, `publishing` local state
- Keep `handlePublish` logic unchanged (toast, setOpen) — remove `setHasPublished`
- The button is naturally disabled/enabled based on live `draftCount` from parent
- Add import: `import type { ScheduleDay } from "@/lib/schedule/types"`
- Remove import of `DateWindow` (no longer needed)
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&amp;1 | grep -E "dashboard-shell|publish-button" || echo "No TS errors in these files"</automated>
  </verify>
  <done>
    DashboardShell exists with useState holding days, passes days to PublishButton.
    PublishButton accepts `days: ScheduleDay[]`, derives draftCount from prop, no hasPublished state.
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire onDaysChange through ScheduleWithRealtime and ScheduleTable</name>
  <files>
    src/components/schedule/schedule-with-realtime.tsx
    src/components/schedule/schedule-table.tsx
    src/app/dashboard/page.tsx
  </files>
  <action>
Update `src/components/schedule/schedule-with-realtime.tsx`:
- Add optional prop `onDaysChange?: (days: ScheduleDay[]) => void`
- Import `ScheduleDay` from `@/lib/schedule/types`
- Pass `onDaysChange` into `ScheduleTable`:
  `&lt;ScheduleTable ... onDaysChange={onDaysChange} /&gt;`

Update `src/components/schedule/schedule-table.tsx`:
- Add optional prop `onDaysChange?: (days: ScheduleDay[]) => void` to `ScheduleTableProps`
- Add a `useEffect` that calls `onDaysChange(days)` whenever `days` changes:
  ```ts
  useEffect(() => {
    onDaysChange?.(days)
  }, [days, onDaysChange])
  ```
  Place this effect after the existing effects (after the auto-scroll effect). This fires after
  every state update: optimistic toggle, realtime update, and initial mount — so DashboardShell
  always has the current days.

Update `src/app/dashboard/page.tsx`:
- Remove `PublishButton` import
- Replace the returned JSX with `&lt;DashboardShell initialData={schedule} /&gt;`
- Import `DashboardShell` from `@/components/schedule/dashboard-shell`
- Keep `getScheduleWindow` import and the `schedule` variable — DashboardShell still needs it
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&amp;1 | head -30</automated>
  </verify>
  <done>
    TypeScript reports no errors. Dashboard page renders DashboardShell. ScheduleTable calls
    onDaysChange on every days state update. PublishButton re-enables when new drafts exist.
  </done>
</task>

</tasks>

<verification>
After both tasks, manually verify the fix works end-to-end:
1. Load /dashboard — PublishButton state matches actual draft count
2. Click Publish → confirm → PublishButton becomes disabled
3. Toggle any cell → PublishButton becomes enabled again
4. Run `npx tsc --noEmit` — zero errors
</verification>

<success_criteria>
- `npx tsc --noEmit` exits 0
- DashboardShell is the single source of truth for `days` state
- PublishButton has no `hasPublished` ratchet state
- Toggling a cell after publish re-enables PublishButton
</success_criteria>

<output>
After completion, create `.planning/quick/260406-ogw-fix-publishbutton-re-enable-after-new-dr/260406-ogw-SUMMARY.md`
</output>
