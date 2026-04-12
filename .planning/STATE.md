---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: verifying
stopped_at: Completed 04-google-calendar-sync 04-01-PLAN.md
last_updated: "2026-04-08T18:59:38.216Z"
last_activity: 2026-04-08
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 8
  completed_plans: 8
  percent: 50
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-04)

**Core value:** Both parents always see the same up-to-date custody schedule, reflected in their Google Calendars, without manual coordination.
**Current focus:** Phase 04 — google-calendar-sync

## Current Position

Phase: 04
Plan: Not started
Status: Phase complete — ready for verification
Last activity: 2026-04-12 - Completed quick task 260412-fjd: fix child columns not showing after adding third child and renaming

Progress: [█████░░░░░] 50%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 01-foundation P01 | 7 | 2 tasks | 14 files |
| Phase 01-foundation P02 | 2 | 2 tasks | 10 files |
| Phase 02-schedule-table-ui P01 | 2 | 2 tasks | 6 files |
| Phase 02-schedule-table-ui P02 | 2 | 2 tasks | 5 files |
| Phase 02-schedule-table-ui P03 | 4 | 1 tasks | 5 files |
| Phase 02-schedule-table-ui P03 | 50 | 4 tasks | 6 files |
| Phase 03-draft-publish-statistics P01 | 3 | 2 tasks | 5 files |
| Phase 03-draft-publish-statistics P02 | 9 | 2 tasks | 6 files |
| Phase 04-google-calendar-sync P04-01 | 52 | 3 tasks | 7 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: 4 phases — Foundation → Schedule Table UI → Draft/Publish+Stats → GCal Sync
- Architecture: Auth.js v5 + Drizzle + Supabase Realtime + write-only GCal sync
- Schema: DATE columns (not TIMESTAMP), `status` enum (not boolean flags), `gcal_events` mirror table from day one
- [Phase 01-foundation]: AppConfig: parents array, children string[], startDate ISO, firstParent ParentId — non-secret structured config in src/config/app.ts
- [Phase 01-foundation]: status enum (draft/published) not boolean — extensible; gcal_events mirror table from day one for Phase 4 idempotency
- [Phase 01-foundation]: Export pgEnum from schema files or drizzle-kit generate silently omits CREATE TYPE
- [Phase 01-foundation]: Split Auth.js config: auth.config.ts (edge-safe, no adapter) + auth.ts (DrizzleAdapter, JWT strategy) — middleware uses auth.config only to avoid edge runtime crash
- [Phase 01-foundation]: JWT session strategy WITH DrizzleAdapter — JWT cookie for edge-compatible middleware; adapter persists OAuth tokens to accounts table for Phase 4 GCal sync
- [Phase 01-foundation]: prompt:consent + access_type:offline in Google provider — forces refresh_token re-issue on every sign-in (prevents Pitfall 2)
- [Phase 02-schedule-table-ui]: ScheduleDay.notes sourced from first child entry's notes column — shared notes per day approach
- [Phase 02-schedule-table-ui]: DB seeding happens lazily in getScheduleWindow when no entries exist for the window — avoids separate seed step
- [Phase 02-schedule-table-ui]: sonner Toaster mounted at root layout so it is available globally for client components
- [Phase 02-schedule-table-ui]: ScheduleCell renders null-entryId cells as a dash placeholder rather than disabled button — cleaner UI for seeding gaps
- [Phase 02-schedule-table-ui]: Week separator implemented as a separate colSpan tr row rather than a border on the Monday row to avoid border-collapse conflicts
- [Phase 02-schedule-table-ui]: Realtime wired via ref injection rather than context — avoids re-render cascade; ScheduleTable controls its own state
- [Phase 02-schedule-table-ui]: Plain createClient (not @supabase/ssr) for browser Realtime — correct when Supabase Auth is not in use
- [Phase 02-schedule-table-ui]: Sticky header requires bounded scroll container: h-[calc(100vh-8rem)] on overflow-y-auto wrapper
- [Phase 02-schedule-table-ui]: NotesCell syncs incoming value prop via useEffect with isFocusedRef guard — prevents overwriting active user input while accepting realtime updates
- [Phase 03-draft-publish-statistics]: shadcn/ui canary Dialog uses @base-ui/react/dialog (not Radix) — DialogTrigger uses render prop pattern instead of asChild
- [Phase 03-draft-publish-statistics]: Header children slot pattern: Server Component stays server-side, client PublishButton injected via children prop from Dashboard
- [Phase 03-draft-publish-statistics]: renderAbove render prop on ScheduleTable gives StatsPanel reactive access to days state without lifting state
- [Phase 03-draft-publish-statistics]: computeStats is a pure function — no DB calls, no side effects, fully testable
- [Phase 04-google-calendar-sync]: GCal sync is best-effort — failure does not roll back DB publish; token lookup joins users table on email; manual token exchange for fresh access_token; all-day event end.date is exclusive (addDays +1)

### Pending Todos

None yet.

### Blockers/Concerns

- Start Google OAuth app verification process during Phase 1 (3-5 business days; blocks real-user handoff)
- Supabase free tier pauses after 1 week inactivity — upgrade to Pro before sharing with real users

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260406-oca | Fix PublishButton disabled state after publishing | 2026-04-06 | d03f195 | [260406-oca-fix-publishbutton-disabled-state-after-p](.planning/quick/260406-oca-fix-publishbutton-disabled-state-after-p/) |
| 260406-ogw | Fix PublishButton re-enable after new drafts | 2026-04-06 | 5d2fc25 | [260406-ogw-fix-publishbutton-re-enable-after-new-dr](.planning/quick/260406-ogw-fix-publishbutton-re-enable-after-new-dr/) |
| 260407-r3q | Fix inline use server in header.tsx build error | 2026-04-07 | 1dcd532 | [260407-r3q-fix-inline-use-server-in-header-tsx-brok](.planning/quick/260407-r3q-fix-inline-use-server-in-header-tsx-brok/) |
| 260407-rbx | Fix publish button not becoming disabled after publish | 2026-04-07 | 948610b | [260407-rbx-publish-button-does-not-become-disabled-](.planning/quick/260407-rbx-publish-button-does-not-become-disabled-/) |
| 260407-rim | Fix publish button CDC overwrite re-enabling after publishing | 2026-04-07 | 663efae | [260407-rim-publish-button-still-does-not-become-dis](.planning/quick/260407-rim-publish-button-still-does-not-become-dis/) |
| 260412-fhd | fix missing key prop on fragment in ScheduleTable map | 2026-04-12 | ac9bf22 | [260412-fhd-fix-missing-key-prop-on-fragment-in-sche](.planning/quick/260412-fhd-fix-missing-key-prop-on-fragment-in-sche/) |
| 260412-fjd | fix child columns not showing after adding third child and renaming | 2026-04-12 | 7d397e7 | [260412-fjd-fix-child-columns-not-showing-after-addi](.planning/quick/260412-fjd-fix-child-columns-not-showing-after-addi/) |

## Session Continuity

Last session: 2026-04-08T18:55:35.589Z
Stopped at: Completed 04-google-calendar-sync 04-01-PLAN.md
Resume file: None
