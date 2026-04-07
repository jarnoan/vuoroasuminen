---
phase: quick
plan: 260407-rbx
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/schedule/publish-button.tsx
  - src/components/schedule/dashboard-shell.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "Publish button becomes disabled immediately after successful publish"
    - "Button re-enables when new draft cells appear (existing behavior preserved)"
  artifacts:
    - path: "src/components/schedule/publish-button.tsx"
      provides: "onPublished callback invocation after successful publish"
    - path: "src/components/schedule/dashboard-shell.tsx"
      provides: "Optimistic days state update flipping draft cells to published"
  key_links:
    - from: "src/components/schedule/publish-button.tsx"
      to: "src/components/schedule/dashboard-shell.tsx"
      via: "onPublished callback prop"
      pattern: "onPublished"
---

<objective>
Fix publish button not becoming disabled after publishing.

Purpose: After clicking Publish and confirming, the button stays enabled because the
component relies entirely on Supabase Realtime events to update cell statuses from
"draft" to "published". If realtime events are delayed or lost, the `days` prop never
updates and `draftCount` remains > 0. The fix adds an optimistic client-side update
that immediately marks all draft cells as published after the server action succeeds.

Output: PublishButton disables immediately on successful publish without depending on
realtime event delivery timing.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/components/schedule/publish-button.tsx
@src/components/schedule/dashboard-shell.tsx
@src/components/schedule/schedule-table.tsx
@src/components/schedule/schedule-with-realtime.tsx

Prior fixes for context:
- 260406-oca: Added hasPublished boolean (later removed)
- 260406-ogw: Lifted days state to DashboardShell, PublishButton derives draftCount from live days prop

Root cause: PublishButton derives draftCount from `days` prop. After publish, `days`
only updates via Supabase Realtime CDC events flowing through RealtimeProvider ->
ScheduleTable -> onDaysChange -> DashboardShell. If realtime is slow or events are
lost (common with bulk UPDATE on many rows), draftCount stays stale and button remains
enabled.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add optimistic publish callback to DashboardShell and PublishButton</name>
  <files>src/components/schedule/dashboard-shell.tsx, src/components/schedule/publish-button.tsx</files>
  <action>
In DashboardShell:
1. Create a callback function `handlePublished` that updates `days` state by mapping
   over all days and flipping every cell with `status: "draft"` to `status: "published"`.
   Use the functional form of setDays:
   ```
   const handlePublished = useCallback(() => {
     setDays(prev => prev.map(day => ({
       ...day,
       cells: day.cells.map(cell =>
         cell.status === "draft" ? { ...cell, status: "published" as const } : cell
       ),
     })))
   }, [])
   ```
2. Pass `onPublished={handlePublished}` as a new prop to PublishButton.
3. Import `useCallback` from React (add to existing import).

In PublishButton:
1. Add `onPublished?: () => void` to the `PublishButtonProps` interface.
2. Accept `onPublished` in the destructured props.
3. In `handlePublish`, after `result.success` is confirmed and before `setOpen(false)`,
   call `onPublished?.()`. This optimistically updates the parent days state so
   draftCount immediately drops to 0 and the button disables.
4. The existing draftCount derivation from `days` prop remains unchanged — the
   optimistic update flows through the same mechanism.

Do NOT reintroduce any `hasPublished` ratchet state. The fix keeps the existing
"derive from live days" pattern established in 260406-ogw but ensures the days
actually update immediately rather than waiting for realtime.
  </action>
  <verify>
    <automated>cd /Users/jarno/src/vuoroasuminen && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>
    - PublishButton accepts optional onPublished callback
    - DashboardShell passes handlePublished to PublishButton
    - After successful publishDraft(), days state is optimistically updated
    - draftCount drops to 0 immediately, button renders disabled
    - No TypeScript errors
  </done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passes with zero errors
- `npm run build` completes successfully
- Manual: click Publish, confirm — button should immediately become disabled
</verification>

<success_criteria>
Publish button becomes disabled immediately after successful publish without depending
on Supabase Realtime event delivery timing.
</success_criteria>

<output>
After completion, create `.planning/quick/260407-rbx-publish-button-does-not-become-disabled-/260407-rbx-SUMMARY.md`
</output>
