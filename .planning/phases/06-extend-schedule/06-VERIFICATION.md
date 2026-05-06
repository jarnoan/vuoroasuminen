---
phase: 06-extend-schedule
verified: 2026-05-06T07:12:00Z
status: human_needed
score: 3/3 must-haves verified
overrides_applied: 0
human_verification:
  - test: "End-to-end UAT — seven scenarios (Test 1 through Test 7 in Task 3 of 06-02-PLAN.md)"
    expected: "All seven manual scenarios pass — trigger visible, week/date modes work, live preview updates, Vahvista navigates, Peruuta collapses, no duplicate rows, validation error displays inline"
    why_human: "SUMMARY documents UAT as approved 2026-05-06 by Jarno. Automated checks confirm the code is correct and fully wired; human sign-off on the interactive browser flow is already documented in the SUMMARY but cannot be verified programmatically by the verifier."
---

# Phase 6: Extend Schedule Verification Report

**Phase Goal:** Either parent can generate new weeks of schedule beyond the current end date, pre-filled with the alternating default pattern
**Verified:** 2026-05-06T07:12:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can click an "Add weeks" action and new entries appear in the schedule, pre-filled with the alternating-week default | VERIFIED | `+ Lisää viikkoja` button in ExtendPanel (extend-panel.tsx line 114); clicking calls `extendSchedule` which calls `generateDefaultEntries` and batch-inserts with `onConflictDoNothing`; DashboardShell mounts the panel below ScheduleWithRealtime |
| 2 | Before confirming, the UI displays the exact start and end dates of the range about to be added | VERIFIED | `previewLabel` derived via `useMemo` from `rangeStart`/`rangeEnd`; rendered in `<p aria-live="polite">{previewLabel}</p>` (extend-panel.tsx lines 47–52, 196–199); updates live on every state change |
| 3 | User can specify an explicit end date instead of a week count, and only entries up to that date are created | VERIFIED | Toggle link `tai valitse päättymispäivä →` switches mode to `"date"`; Popover + Calendar shown; `rangeEnd = endOfWeek(pickedEnd, { weekStartsOn: 1 })`; `extendSchedule` accepts `endDate` and validates it ≤ 730 days; DB insert uses computed rangeEnd |

**Score:** 3/3 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/actions/schedule.ts` | `extendSchedule` async function exported | VERIFIED | Line 96: `export async function extendSchedule`; all existing actions (toggleCell, saveNotes, publishSchedule, syncCalendars) unchanged |
| `src/components/schedule/extend-panel.tsx` | ExtendPanel client component, `"use client"`, exports `ExtendPanel` | VERIFIED | Line 1: `"use client"`; line 20: `export function ExtendPanel`; 232 lines of substantive component code |
| `src/components/schedule/dashboard-shell.tsx` | Mounts `<ExtendPanel scheduleEndDate={...} />` below ScheduleWithRealtime | VERIFIED | Line 7: import; line 42: `<ExtendPanel scheduleEndDate={scheduleEndDate} />`; mounts after `<ScheduleWithRealtime>` inside `<main>` |
| `src/actions/schedule.test.ts` | 8 test cases covering auth, validation, and insertion | VERIFIED | 11 tests (plan called for 8; 3 split into sub-cases); all 22 tests across 2 test files pass via `npx vitest run` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `schedule.ts::extendSchedule` | `generate-default.ts::generateDefaultEntries` | direct import + call | WIRED | Line 9: import; line 150: `generateDefaultEntries(rangeStart, rangeEnd, config.children)` |
| `schedule.ts::extendSchedule` | `domain.ts::scheduleEntries` | `db.insert(scheduleEntries).values(...).onConflictDoNothing()` | WIRED | Line 160: `.onConflictDoNothing()` confirmed |
| `schedule.ts::extendSchedule` | `requireAuthorizedParent` | first line of function body | WIRED | Line 104: `await requireAuthorizedParent()` — first call in body |
| `extend-panel.tsx` | `schedule.ts::extendSchedule` | `import { extendSchedule } from '@/actions/schedule'` | WIRED | Line 12: import; line 84: `await extendSchedule(input)` |
| `extend-panel.tsx` | `next/navigation router.replace` | `router.replace(pathname + '?' + params.toString())` | WIRED | Line 58: `router.replace(pathname + "?" + params.toString())` inside `navigateTo` callback |
| `dashboard-shell.tsx` | `extend-panel.tsx` | import + render below ScheduleWithRealtime | WIRED | Line 7: import; line 42: render after line 41 ScheduleWithRealtime |
| `extend-panel.tsx` | `ui/popover.tsx` + `ui/calendar.tsx` | Popover/PopoverTrigger/PopoverContent + Calendar with fi locale | WIRED | Lines 10–11: imports; lines 160–180: usage in date mode |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `extend-panel.tsx` | `scheduleEndDate` prop | `page.tsx` → `getScheduleEndDate()` (DB `MAX(day)` query) | Yes — `queries.ts` line 96: `db.select({ maxDay: max(scheduleEntries.day) }).from(scheduleEntries)` with fallback `?? schedule.endDate` | FLOWING |
| `extend-panel.tsx` | `rangeStart`/`rangeEnd`/`previewLabel` | Derived via `useMemo` from `scheduleEndDate` + `weeks`/`pickedEnd` state | Yes — pure date arithmetic, no hardcoded values | FLOWING |

**Note on `scheduleEndDate` prop deviation from plan:** Plan 02 specified `<ExtendPanel scheduleEndDate={initialData.endDate} />` (view-window end). The actual implementation uses a dedicated `scheduleEndDate` prop threaded from `page.tsx` via `getScheduleEndDate()` (DB MAX query), with fallback `scheduleEndDate ?? schedule.endDate`. The SUMMARY documents this as a UAT bug fix — using view-window end caused extend to start from the wrong date when the schedule extended beyond the current view window. The deviation improves correctness and fully satisfies EXTEND-01 and EXTEND-03.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles cleanly | `npx tsc --noEmit` | Exit 0, no output | PASS |
| All unit tests pass | `npx vitest run src/actions/schedule.test.ts` | 22/22 tests passing across 2 files | PASS |
| `extendSchedule` exported | `grep "export async function extendSchedule" src/actions/schedule.ts` | 1 match at line 96 | PASS |
| Auth guard present in `extendSchedule` | `grep "await requireAuthorizedParent()" src/actions/schedule.ts` | 5 matches (4 existing + extendSchedule) | PASS |
| `onConflictDoNothing` in `extendSchedule` | `grep "onConflictDoNothing" src/actions/schedule.ts` | 1 match at line 160 | PASS |
| Weeks validation bounds | `grep "weeks < 1 \|\| weeks > 52" src/actions/schedule.ts` | 1 match at line 128 | PASS |
| 730-day cap | `grep "daysDelta > 730" src/actions/schedule.ts` | 1 match at line 122 | PASS |
| ExtendPanel wired in DashboardShell | `grep "ExtendPanel" src/components/schedule/dashboard-shell.tsx` | Import line 7 + render line 42 | PASS |
| Vahvista disabled while pending | `grep "disabled={isPending" extend-panel.tsx` | 3 matches (input, Vahvista, Peruuta) | PASS |
| Live preview via useMemo | `grep "useMemo" extend-panel.tsx` | 3 useMemo hooks: rangeStart, rangeEnd, previewLabel — updates on every state change | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| EXTEND-01 | 06-01, 06-02 | User can extend the schedule forward by N weeks (default 12); new entries pre-filled with alternating-week default pattern | SATISFIED | `extendSchedule` accepts `weeks` (default 12, validated 1–52); calls `generateDefaultEntries`; UI trigger in `ExtendPanel` with number input pre-filled 12 |
| EXTEND-02 | 06-02 | Before confirming, the UI shows the start and end dates of the range being added | SATISFIED | `previewLabel` via `useMemo` renders `Ajanjakso: ma {d.M.} – su {d.M.yyyy}` with live updates on input change; `aria-live="polite"` |
| EXTEND-03 | 06-01, 06-02 | User can specify an explicit end date instead of adding a fixed number of weeks | SATISFIED | Mode toggle to `"date"` shows Popover+Calendar; `extendSchedule` accepts `endDate`; date snapped to Sunday via `endOfWeek({weekStartsOn:1})` |

### Anti-Patterns Found

No anti-patterns detected. Scan of `src/actions/schedule.ts`, `src/components/schedule/extend-panel.tsx`, `src/components/schedule/dashboard-shell.tsx` found no TODO/FIXME/placeholder comments, no empty `return null`/`return {}` in rendering paths, and no hardcoded empty data flowing to the UI.

### Human Verification Required

#### 1. End-to-End UAT — Extend Schedule Browser Flow

**Test:** Run `npm run dev`, sign in as an authorized parent, then execute all seven UAT scenarios from Task 3 of 06-02-PLAN.md:
1. `+ Lisää viikkoja` button visible below schedule table (NOT inside table, NOT modal)
2. Week-count mode: panel expands inline, number pre-filled 12, live date preview updates on change, Vahvista shows `Lisätään...`, navigates to new week on success
3. Date-picker mode: Finnish calendar, Sunday snap, preview updates live, back-toggle restores week mode
4. Peruuta: panel collapses without mutation or navigation
5. Idempotency: re-extend same range produces no duplicate rows (verify via Supabase Table Editor)
6. Validation error: inline red error message below buttons, panel stays open
7. Other parent real-time view: second parent does NOT get navigated when first parent extends

**Expected:** All seven scenarios behave exactly as described. No console errors. Panel container uses `border rounded-lg p-3 bg-muted/30 text-sm`. All Finnish copy strings match the Copywriting Contract verbatim.

**Why human:** Interactive browser behavior, visual rendering, real-time CDC behavior across two sessions, and DB row count inspection cannot be verified programmatically. SUMMARY documents UAT as approved by Jarno 2026-05-06; this item exists because the verifier cannot independently confirm browser-level correctness.

### Gaps Summary

No gaps blocking goal achievement. All three roadmap success criteria are satisfied by substantive, fully-wired implementation. TypeScript compiles cleanly, 22 unit tests pass, and data flows from a real DB MAX query through to the UI. The only open item is the human UAT item already recorded as approved in the SUMMARY — which elevates status to `human_needed` rather than `passed` because the verifier cannot independently confirm interactive behavior.

---

_Verified: 2026-05-06T07:12:00Z_
_Verifier: Claude (gsd-verifier)_
