---
phase: 02-schedule-table-ui
verified: 2026-04-05T00:00:00Z
status: human_needed
score: 9/9 must-haves verified
re_verification: false
human_verification:
  - test: "Open the app in two browser windows signed in as different Google accounts, toggle a cell in window 1, observe window 2"
    expected: "The toggled cell updates in window 2 within a few seconds without any page refresh"
    why_human: "Cannot start a server or establish a Supabase WebSocket connection programmatically in this verification context; requires live Supabase Realtime replication enabled for schedule_entries"
  - test: "Edit a note in window 1 and click elsewhere to blur, observe window 2"
    expected: "The updated note text appears in window 2's notes input without refresh"
    why_human: "Same as above — requires live Supabase connection and two authenticated sessions"
  - test: "Load the dashboard and visually inspect today's row"
    expected: "Today's row is highlighted in yellow and is scrolled into view automatically on page load; 'Today' button is visible in bottom-right corner"
    why_human: "Auto-scroll and visual highlighting cannot be confirmed without a browser rendering the page"
  - test: "Verify week separators between Mon-Sun groups are visible"
    expected: "A faint divider row appears between each week (Sunday -> Monday boundary)"
    why_human: "Visual appearance of the separator row (bg-muted/50) requires browser rendering"
  - test: "Confirm Supabase Realtime replication is enabled for schedule_entries"
    expected: "ALTER PUBLICATION supabase_realtime ADD TABLE schedule_entries; has been run in Supabase SQL editor, or the table is toggled on under Database > Replication"
    why_human: "External Supabase dashboard configuration — cannot verify programmatically"
---

# Phase 2: Schedule Table UI — Verification Report

**Phase Goal:** Build the interactive schedule table UI with real-time sync — both parents can see and edit the same 12-week custody schedule, with changes reflected instantly without page refresh.
**Verified:** 2026-04-05
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

All five success criteria from ROADMAP.md are structurally satisfied by the codebase. The remaining items are behavioral/visual checks that require a running browser and live Supabase connection.

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | On first load the 12-week rolling table is pre-filled with the alternating-week pattern — no blank cells | VERIFIED | `getScheduleWindow` in `queries.ts` calls `generateDefaultEntries` when `entries.length === 0`, inserts 84 days x N children, then re-fetches |
| 2 | Each cell shows the assigned parent's color; children can be assigned to different parents on the same day | VERIFIED | `ScheduleCell` uses `colorMap[parentId][status]` (blue/rose, draft/published variants); cells are per-child per day — independent tracking |
| 3 | A parent can change any child's cell to father or mother and the change appears immediately on both parents' screens | VERIFIED (auto half) / HUMAN (realtime half) | Optimistic update wired in `handleToggle`; `toggleCell` Server Action persists; `RealtimeProvider` -> `handleRealtimeEntry` -> `setDays` chain is fully wired; live broadcast requires human test |
| 4 | A parent can edit the shared notes field for any day and the other parent sees it in real time | VERIFIED (auto half) / HUMAN (realtime half) | `NotesCell` saves on blur via `handleNoteSave` -> `saveNotes` Server Action; focus-guarded `useEffect` syncs incoming `value` prop changes; live broadcast requires human test |
| 5 | Draft cells are visually distinct from published cells so both parents can see what is not yet confirmed | VERIFIED | `colorMap` in `schedule-cell.tsx` uses `bg-blue-200`/`bg-rose-200` (faded) for draft and `bg-blue-500`/`bg-rose-500` (solid) for published |

**Score:** 9/9 truths verified (5/5 success criteria; all automated checks pass; 2 human tests needed for live realtime behavior)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/schedule/types.ts` | Shared types (ScheduleDay, ScheduleCell, DateWindow, ParentId) | VERIFIED | Exports all 4 types; 28 lines of substance |
| `src/lib/schedule/generate-default.ts` | Alternating-week pattern generator | VERIFIED | Exports `generateDefaultEntries` and `getWindowBounds`; uses `differenceInCalendarWeeks` with `weekStartsOn: 1` |
| `src/lib/schedule/queries.ts` | Data fetching with upsert-on-empty | VERIFIED | Exports `getScheduleWindow`; seeds DB when `entries.length === 0`; returns `DateWindow` |
| `src/actions/schedule.ts` | Server Actions for cell toggle and notes save | VERIFIED | `"use server"` at top; exports `toggleCell` and `saveNotes`; both guard with `auth()` |
| `src/components/schedule/schedule-table.tsx` | Main table client component with optimistic state | VERIFIED | `"use client"`; `useState(initialData.days)`; imports `toggleCell`/`saveNotes`; `realtimeRef` prop; sticky header; `data-date`/`data-today` attributes; week separators |
| `src/components/schedule/schedule-cell.tsx` | Clickable color-coded cell | VERIFIED | `"use client"`; `colorMap` with all 4 states; `onToggle` called with opposite parentId |
| `src/components/schedule/notes-cell.tsx` | Inline editable notes with blur-save | VERIFIED | `"use client"`; focus-guarded `useEffect` for realtime sync; `onBlur` saves when changed; `placeholder="Add note..."` |
| `src/components/schedule/today-button.tsx` | Fixed scroll-to-today button | VERIFIED | `"use client"`; `fixed bottom-6 right-6`; `scrollIntoView` on `data-date` element |
| `src/lib/supabase/client.ts` | Browser-side Supabase client | VERIFIED | Singleton pattern; uses `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `src/components/schedule/realtime-provider.tsx` | Supabase Realtime subscription component | VERIFIED | `"use client"`; subscribes to `postgres_changes` on `schedule_entries`; `removeChannel` cleanup; snake_case to camelCase mapping |
| `src/components/schedule/schedule-with-realtime.tsx` | Realtime + table wrapper | VERIFIED | `"use client"`; wraps `ScheduleTable` in `RealtimeProvider` via `realtimeRef` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `generate-default.ts` | `config/app.ts` | imports AppConfig for startDate, firstParent, children | WIRED | `import config from "@/config/app"` present; uses `config.startDate`, `config.firstParent`, `config.children` |
| `actions/schedule.ts` | `db/schema/domain.ts` | Drizzle update on scheduleEntries | WIRED | `import { scheduleEntries } from "@/db/schema/domain"`; `db.update(scheduleEntries)` in both actions |
| `queries.ts` | `generate-default.ts` | calls generateDefaultEntries when no rows exist | WIRED | `import { generateDefaultEntries, getWindowBounds } from "./generate-default"`; called inside `if (entries.length === 0)` branch |
| `schedule-table.tsx` | `actions/schedule.ts` | calls toggleCell and saveNotes | WIRED | `import { toggleCell, saveNotes } from "@/actions/schedule"`; both called in handlers |
| `schedule-cell.tsx` | `lib/schedule/types.ts` | uses ScheduleCell type for props | WIRED | `import type { ParentId } from "@/lib/schedule/types"` |
| `dashboard/page.tsx` | `schedule-table.tsx` (via schedule-with-realtime) | passes DateWindow as prop | WIRED | Imports `ScheduleWithRealtime`; passes `initialData={schedule}` |
| `realtime-provider.tsx` | `lib/supabase/client.ts` | creates Supabase client and subscribes | WIRED | `import { createBrowserClient }`; `supabase.channel("schedule-changes").on("postgres_changes", ...)` |
| `realtime-provider.tsx` | `schedule-table.tsx` | provides callback to update days state via realtimeRef | WIRED | `ScheduleWithRealtime` creates `realtimeRef`, passes to both `RealtimeProvider.onEntryChange` and `ScheduleTable.realtimeRef`; `handleRealtimeEntry` assigned to `realtimeRef.current` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `schedule-table.tsx` | `days` (state) | `initialData.days` from Server Component prop | Yes — `getScheduleWindow` queries DB (`db.select().from(scheduleEntries)`) and seeds if empty | FLOWING |
| `schedule-cell.tsx` | `parentId`, `status` | `cell.parentId`, `cell.status` from `days` state | Yes — flows from DB entries via `queries.ts` | FLOWING |
| `notes-cell.tsx` | `localValue` | `value` prop from `day.notes` (DB entry's `notes` column) | Yes — `firstEntry?.notes ?? ""` from DB query | FLOWING |
| `realtime-provider.tsx` | Supabase CDC payload | Supabase Postgres Changes on `schedule_entries` | Yes — real DB change events (requires Realtime publication enabled) | FLOWING (requires Supabase config — see human verification) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles without errors | `npx tsc --noEmit` | No output (exit 0) | PASS |
| toggleCell sets status="draft" | Grep `status: "draft"` in schedule.ts | Line 14: `.set({ parentId: newParentId, status: "draft" })` | PASS |
| queries.ts seeds when entries.length === 0 | Grep `entries.length === 0` | Line 26 confirms branch | PASS |
| All 5 plan commits documented in SUMMARY exist in git log | `git log --oneline` | a89b524, 5c1348e, 089f1a7, 6012009, f62f6e0, 0cd1735, 502e4d3 all present | PASS |
| Live realtime cross-browser sync | Requires running server + Supabase | Cannot run headlessly | SKIP (human needed) |

Step 7b: Behavioral spot-checks run on statically verifiable behaviors. Live server/browser tests routed to human verification.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SETP-02 | 02-01 | System pre-fills 12-week window with alternating-week pattern on first load | SATISFIED | `getScheduleWindow` seeds via `generateDefaultEntries` when `entries.length === 0` |
| SCHED-01 | 02-01, 02-02 | User sees a table with rows=days (rolling 12-week), columns=one per child + notes | SATISFIED | `schedule-table.tsx` renders 84-row `<table>` with `<thead>` showing child names and Notes column |
| SCHED-02 | 02-02 | Each cell shows which parent the child is with (color-coded) | SATISFIED | `colorMap` in `schedule-cell.tsx` maps `father/mother` x `draft/published` to Tailwind classes |
| SCHED-03 | 02-01 | User can change a cell value (father/mother) for any child on any day | SATISFIED | `handleToggle` -> `toggleCell` Server Action -> `db.update(scheduleEntries)` |
| SCHED-04 | 02-01, 02-02 | Each child's location tracked independently | SATISFIED | Each `ScheduleCell` has its own `entryId`; `toggleCell` updates by `entryId` |
| SCHED-05 | 02-01 | User can edit shared notes for any day | SATISFIED | `handleNoteSave` -> `saveNotes` Server Action -> `db.update(scheduleEntries).set({ notes })` |
| SCHED-06 | 02-02, 02-03 | Changes in draft state visible immediately to both parents in real time | SATISFIED (wiring verified; live test = human) | `RealtimeProvider` subscribes to `postgres_changes` on `schedule_entries`; `handleRealtimeEntry` updates state |
| DRFT-01 | 02-01 | All edits create or modify draft entries | SATISFIED | `toggleCell` sets `status: "draft"`; `getScheduleWindow` seeds with `status: "draft" as const` |
| DRFT-03 | 02-02 | UI clearly distinguishes draft cells from published cells | SATISFIED | `colorMap` uses faded colors (`bg-blue-200`, `bg-rose-200`) for draft vs solid (`bg-blue-500`, `bg-rose-500`) for published |

All 9 requirements mapped to this phase are satisfied. No orphaned requirements found.

### Anti-Patterns Found

No TODO/FIXME/placeholder comments found across all phase files. No empty implementations. No hardcoded empty arrays passed as props. No console.log-only handlers.

The one notable pattern worth flagging:

| File | Note | Severity | Impact |
|------|------|----------|--------|
| `src/lib/supabase/client.ts` | Module-level singleton (`let client`) is not `"use client"` — safe for browser-only use, but file has no directive | Info | No impact — file is only imported by `realtime-provider.tsx` which is `"use client"` |

### Human Verification Required

#### 1. Real-Time Cell Sync Between Parents

**Test:** Open the app in two browser windows or devices, signed in as different Google accounts. Toggle any cell in window 1.
**Expected:** The cell updates in window 2 within a few seconds without any page refresh.
**Why human:** Requires a live Supabase Realtime WebSocket connection. Also requires that Supabase Realtime replication is enabled for `schedule_entries` — run `ALTER PUBLICATION supabase_realtime ADD TABLE schedule_entries;` in the Supabase SQL editor if not already done.

#### 2. Real-Time Notes Sync Between Parents

**Test:** In window 1, click a notes field, type something, then click elsewhere to blur. Observe window 2.
**Expected:** The note text appears in window 2's notes field for that day within a few seconds.
**Why human:** Same Supabase Realtime dependency as above.

#### 3. Today Row Highlighting and Auto-Scroll

**Test:** Load the dashboard and observe the initial scroll position and today's row.
**Expected:** The page loads with today's row scrolled into the center of the viewport and highlighted in yellow. The "Today" button appears in the bottom-right corner.
**Why human:** `scrollIntoView` and CSS visual effects require browser rendering; cannot be confirmed by static analysis.

#### 4. Week Separators Visual Appearance

**Test:** Scroll through the schedule table and look for visual breaks between weeks.
**Expected:** A faint divider row (lighter background) appears at each Monday boundary (after every Sunday row).
**Why human:** Visual appearance of `bg-muted/50` separator rows requires browser rendering.

#### 5. Supabase Realtime Configuration

**Test:** Check Supabase Dashboard > Database > Replication or run `SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'schedule_entries';` in the SQL editor.
**Expected:** `schedule_entries` is listed as part of the `supabase_realtime` publication.
**Why human:** External Supabase dashboard configuration cannot be verified from the codebase.

### Gaps Summary

No gaps. All 9 must-have artifacts exist, are substantive (not stubs), are wired to their data sources, and data flows from the database through to the rendered components. TypeScript compiles with zero errors. All 7 documented commits are present in git history.

The only items routed to human verification are:
1. Live Supabase Realtime behavior (requires running server + live WebSocket)
2. Browser-rendered visual behaviors (scroll position, color appearance, week separators)
3. Supabase external configuration (Realtime publication for `schedule_entries`)

These are not gaps in the implementation — the wiring is complete and correct. They are verification steps that require a browser and live external service.

---

_Verified: 2026-04-05_
_Verifier: Claude (gsd-verifier)_
