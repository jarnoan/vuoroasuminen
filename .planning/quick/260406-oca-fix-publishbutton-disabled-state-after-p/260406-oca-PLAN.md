---
phase: quick
plan: 260406-oca
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/schedule/publish-button.tsx
  - .planning/phases/03-draft-publish-statistics/03-HUMAN-UAT.md
autonomous: true
requirements: []
must_haves:
  truths:
    - "PublishButton is disabled immediately after a successful publish without a page reload"
    - "UAT test #3 is recorded as failed then resolved in 03-HUMAN-UAT.md"
  artifacts:
    - path: "src/components/schedule/publish-button.tsx"
      provides: "hasPublished local state overrides draftCount to 0 after success"
  key_links:
    - from: "handlePublish success branch"
      to: "hasPublished state"
      via: "setHasPublished(true)"
      pattern: "setHasPublished"
---

<objective>
Fix PublishButton so it disables itself immediately after a successful publish call, instead of waiting for a page reload.

Purpose: After publishDraft() succeeds the button remains enabled because draftCount is derived from the stale initialData prop. The fix adds a hasPublished boolean that overrides draftCount to 0 on the client side right after success.
Output: Updated publish-button.tsx and updated UAT notes.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add hasPublished override to PublishButton</name>
  <files>src/components/schedule/publish-button.tsx</files>
  <action>
    Add a `const [hasPublished, setHasPublished] = useState(false)` state variable.

    Derive the effective count used for the disabled check with:
    `const effectiveDraftCount = hasPublished ? 0 : draftCount`

    In handlePublish, inside the `if (result.success)` branch, call `setHasPublished(true)` before `setOpen(false)`.

    Replace the disabled guard `if (draftCount === 0)` with `if (effectiveDraftCount === 0)`.

    Do NOT change any other logic, styling, or imports. The dialog description still shows `draftCount` (the original value from initialData) — that is intentional and correct since the dialog is shown before publishing.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep publish-button || echo "No TS errors in publish-button"</automated>
  </verify>
  <done>After publishDraft() returns success, hasPublished is true, effectiveDraftCount is 0, and the component renders the disabled Button variant immediately without a page reload.</done>
</task>

<task type="auto">
  <name>Task 2: Update UAT test #3 result</name>
  <files>.planning/phases/03-draft-publish-statistics/03-HUMAN-UAT.md</files>
  <action>
    Update test #3 in 03-HUMAN-UAT.md:

    Change:
    ```
    result: [pending]
    ```
    to:
    ```
    result: failed — button stayed enabled after publish; fixed in quick task 260406-oca. resolved.
    ```

    Update the Summary counts:
    - passed: 0 → leave as-is (overall UAT is still partial — tests 1 and 2 remain pending)
    - pending: 3 → 2
    - issues: 0 → 0 (was caught and resolved in the same quick task, not a lingering open issue)

    Update the frontmatter `updated` timestamp to the current date (2026-04-06T18:00:00Z is fine as an approximation).
  </action>
  <verify>
    <automated>grep "resolved" .planning/phases/03-draft-publish-statistics/03-HUMAN-UAT.md</automated>
  </verify>
  <done>03-HUMAN-UAT.md test #3 result field contains both the failure note and the resolution note, and pending count is 2.</done>
</task>

</tasks>

<verification>
- TypeScript compilation passes for the modified component (`npx tsc --noEmit`)
- UAT file contains "resolved" in test #3
</verification>

<success_criteria>
- PublishButton renders disabled immediately after a successful publishDraft() call (no reload needed)
- `hasPublished` state is set to true in the success branch of handlePublish
- effectiveDraftCount is used for the disabled guard instead of draftCount directly
- 03-HUMAN-UAT.md test #3 documents the failure and resolution
</success_criteria>

<output>
After completion, create `.planning/quick/260406-oca-fix-publishbutton-disabled-state-after-p/260406-oca-SUMMARY.md`
</output>
