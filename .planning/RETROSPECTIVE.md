# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

---

## Milestone: v1.0 — MVP

**Shipped:** 2026-04-20
**Phases:** 4 | **Plans:** 9 | **Timeline:** 16 days (2026-04-04 → 2026-04-20)

### What Was Built

- Next.js 16 + TypeScript + Drizzle ORM + Supabase + Auth.js v5 full-stack foundation (8-table schema)
- Google OAuth sign-in with Calendar scope, JWT refresh rotation, edge-safe route protection
- Interactive 84-row schedule table: color-coded parent cells, click-to-toggle, optimistic UI, today-row auto-scroll
- Real-time cross-browser sync via Supabase Postgres Changes — no polling, no custom WebSocket server
- Shared notes per day with real-time sync and focus-guard to prevent overwriting active edits
- Publish flow with shadcn/ui Dialog confirmation; draft→published visual transition
- 4-metric custody balance statistics panel (days, solo days, child-free days/weekends) as a pure computation
- Google Calendar sync: idempotent all-day events, orphan cleanup on custody switch, rate-limit backoff, observability logs, failure toast
- 12 quick fixes across the milestone (PublishButton state bugs, token persistence, rate limiting, etc.)

### What Worked

- **Strict dependency ordering** — Foundation → Table UI → Publish → GCal meant each phase had a working app to build on; no integration surprises at the end
- **Pure computeStats function** — keeping statistics as a pure `ScheduleDay[] → Stats` transform made it trivial to test and reactive to live state
- **gcal_events mirror table from day one** — defining this in Phase 1 schema (before Phase 4) paid off immediately: idempotency was a constraint problem, not a logic problem
- **Best-effort sync pattern** — decoupling publish success from sync success prevented a whole class of failure-cascade issues with external APIs
- **Quick fix workflow** — 12 quick tasks completed without disrupting phase plans; bugs fixed same-session they were found

### What Was Inefficient

- **ROADMAP.md stale state** — Phases 1 and 3 went out-of-sync (showing "In Progress" when complete); Phase 4's plan list referenced Phase 3 plan names. Cosmetic but confusing — roadmap updates should happen at phase completion, not be left for audit.
- **PublishButton state** took 3 separate quick fixes (260406-oca, 260406-ogw, 260407-rbx, 260407-rim) before the CDC-overwrite root cause was identified. A clearer initial design for the enabled/disabled state machine would have prevented rework.
- **Token persistence discovered late** — the `invalid_grant` bug and the re-sign-in token persistence issue were both found during live testing. The refresh token flow should be smoke-tested earlier in development.
- **Human-only verification items left open** — live Supabase Realtime cross-browser sync and end-to-end GCal with real credentials remain unverified by automation. This is a known limitation of the environment, but a v1.1 E2E test suite would close the gap.

### Patterns Established

- **Split Auth.js config** (`auth.config.ts` edge-safe + `auth.ts` with DrizzleAdapter) — required pattern for Next.js 15 + Middleware; must be preserved in future auth changes
- **`prompt:consent + access_type:offline` on every Google sign-in** — forces refresh_token re-issue; prevents invalid_grant after long inactivity
- **Realtime via ref injection** — `ScheduleTable` owns its own state; realtime updates injected via ref rather than context to avoid re-render cascades
- **`[GCal sync]` prefix on all server logs** — grep-able structured logging pattern for external API calls
- **`renderAbove` render prop on table** — lets StatsPanel consume live `days` state from ScheduleTable without prop drilling or lifting state to a shared parent

### Key Lessons

1. **Design for the external API's failure mode first.** GCal sync needed best-effort isolation from day one — planning this in Phase 4 worked, but the gcal_events table decision in Phase 1 was key. External API shape should influence schema design early.
2. **Token lifecycle is a first-class concern.** OAuth tokens expire, rotate, and can become invalid through external events. Smoke-test the full token path (issue → use → refresh → re-issue on sign-in) before shipping to real users.
3. **Pure functions for computed state.** `computeStats` and `generateDefaultEntries` being pure made them easy to test, easy to reason about, and easy to wire to reactive state. Prefer pure transforms over stateful computations.
4. **Track roadmap status at phase completion, not at audit time.** Stale roadmap state is a friction tax on every future session — update it immediately when a phase completes.
5. **Quick fixes should be small and named.** The 12 quick tasks were well-contained. The pattern of giving each a short ID and description made it easy to trace what changed and why.

### Cost Observations

- Model: Claude Sonnet 4.6 throughout
- Sessions: ~16 across the milestone
- Notable: Phase 2 (schedule table UI) was the most complex phase — 3 plans, realtime integration, optimistic UI — but the groundwork from Phase 1 meant no surprises. Complexity was front-loaded correctly.

---

## Milestone: v1.1 — Schedule Window Control

**Shipped:** 2026-05-06
**Phases:** 3 (5–7) | **Plans:** 9 | **Timeline:** 16 days (2026-04-20 → 2026-05-06)

### What Was Built

- Per-user view window control: ViewToolbar with date picker, "Show previous week", Tänään button; viewStart as URL param
- Schedule extension: ExtendPanel with week-count and explicit end-date modes, live Finnish date preview, Sunday snap, auto-navigation to first new week
- Single-cell clear via × hover button; parent_id widened to nullable in schema + GCal sync
- Bulk date-range clear: self-contained ClearPanel with two Finnish-locale date pickers and live day/child count preview
- 15 quick tasks deferred to next milestone (Finnish date formats, deploy, security review findings, publish button edge cases)

### What Worked

- **Inline panel pattern** — establishing ExtendPanel as the template first, then ClearPanel as a clone, dramatically reduced Phase 7 complexity; "modeled exactly on ExtendPanel" in the plan paid off
- **URL param for view state** — zero write path, zero backend work, naturally per-user; the simplest possible solution turned out to be exactly right
- **Nullable parent_id from the start** — widening the schema in Plan 07-01 before any UI work meant Phase 7 never had to retrofit types; unassigned was first-class throughout
- **fi locale aliasing pattern** — `fi as fiFormat` (date-fns) + `fi as fiPicker` (react-day-picker) resolved the dual-locale confusion cleanly; established in Phase 6, reused in Phase 7

### What Was Inefficient

- **REQUIREMENTS.md traceability never updated** — all 9 requirements showed "Pending" at milestone close; only VIEW-01–04 were actually checked. Traceability should be updated at phase completion, not left for the milestone archive.
- **15 deferred quick tasks** — several were from Phase 4 era (publish button state) and carried forward unresolved. Quick tasks accumulate; a brief triage pass before milestone close would surface which ones block real-user handoff.
- **scheduleEndDate bug found in UAT** — Phase 6 passed all plan acceptance criteria but the wrong prop (view end vs DB max date) only surfaced when tested in browser. Earlier integration smoke-test would have caught it.
- **Human verification left open** — all three phases have `human_needed` verification gaps; the test environment limitations are known, but a clearer protocol for what counts as "verified" would reduce ambiguity at milestone close.

### Patterns Established

- **Inline expand/collapse panel** (not Dialog/modal) — established as the standard for contextual actions below the schedule table; ClearPanel and ExtendPanel both follow it
- **Self-contained action panel** — panels take minimal props, own their state, call Server Actions directly; no state lifting needed
- **queueMicrotask focus restoration** — keyboard accessibility pattern after panel collapse; copy this for any future collapsible panel
- **Finnish locale aliases** — `fi as fiFormat` for date-fns, `fi as fiPicker` for react-day-picker; required everywhere Finnish date pickers appear

### Key Lessons

1. **Clone successful patterns explicitly in plans.** Saying "model exactly on ExtendPanel" in the Phase 7 plan prevented reinvention and reduced execution time to 8 minutes for a complex component.
2. **Update traceability tables at phase completion.** Stale "Pending" status in REQUIREMENTS.md created unnecessary uncertainty at milestone close; 30 seconds per phase would have kept it accurate.
3. **UAT should include prop threading verification.** The scheduleEndDate bug was a prop-threading error (wrong source) not a logic error — easy to miss in unit tests, obvious in the browser. Add a "does the prop value look right?" check to UAT scripts.
4. **Quick task triage before milestone close.** 15 deferred tasks at close is too many to ignore. A 15-minute triage pass would identify which are pre-deploy blockers vs nice-to-haves.

### Cost Observations

- Model: Claude Sonnet 4.6 throughout
- Sessions: ~8 across the milestone
- Notable: Phase 7 executed significantly faster than Phases 5–6 because the inline panel pattern was already established. Pattern reuse is a real velocity multiplier.

---

## Milestone: v1.2 — Supabase Auth Migration

**Shipped:** 2026-05-15
**Phases:** 3 (8–10) | **Plans:** 16 | **Timeline:** 6 days (2026-05-09 → 2026-05-15)

### What Was Built

- Supabase Google OAuth (PKCE) replaces Auth.js v5 — cookie session, `getUser()` middleware, sign-out, error page for failed token capture
- `user_google_tokens` table — captures Google refresh token once in `/auth/callback`; `ownerEmail` per calendar so any parent can publish
- Dashboard warning banner when calendar owner's token row is absent
- `supabase/policies.sql` — 5 ENABLE RLS + 19 policies applied to live Supabase project; anon requests now return `[]`
- Realtime JWT race condition fixed — `RealtimeProvider` awaits `getSession()` + `setAuth()` before subscribing
- Auth.js fully removed — 4 DB tables dropped (FK order), 6 source files deleted, packages pruned, env vars renamed; both parents re-authenticated on new stack, GCal publish confirmed

### What Worked

- **GATE pattern between phases** — Phase 8 GATE (08-08) and Phase 9 GATE (09-04) enforced sequential verification before each phase unlocked. GCal sync was confirmed working before RLS was enabled; RLS was verified before Auth.js was removed. No regressions across the transition.
- **Human checkpoint plans** — blocking plans that require human action (08-08, 09-04) were first-class in the roadmap and clearly scoped. The agent creates the template, the human runs the scenario, the agent records the outcome — clean division of labor.
- **service_role bypass by design** — server-side code (Server Actions, GCal sync) uses admin Drizzle throughout; RLS only applies to browser/Realtime clients. This decision (D-07/D-10) was locked early and never revisited, simplifying every subsequent plan.
- **`npm prune` post-install hygiene** — `npm uninstall` removed packages from package.json but left node_modules on disk. Catching this in verification (Phase 10 gap) and fixing it with `npm prune` before milestone close kept the artifact clean.

### What Was Inefficient

- **Phase 9 SUMMARY.md not created in original session** — Phase 9 UAT was completed (all results committed to `09-VERIFICATION.md`) but `09-04-SUMMARY.md` was never written. The next session had to reconstruct the plan completion status, re-run the milestone close flow from scratch, and fix ROADMAP.md/STATE.md manually. **SUMMARY.md must be committed before leaving a session.**
- **STATE.md deferred items table never updated** — 13 quick tasks had been completed (with `{slug}-SUMMARY.md` on disk) but STATE.md still showed them as "missing". The audit tool flagged all 15 at milestone close, requiring triage. Update the deferred items table when quick tasks complete, not at milestone close.
- **REQUIREMENTS.md traceability not updated during Phase 9** — RLS-01..04 remained "Pending" at milestone close; had to be manually checked before archiving. Third time this pattern has appeared — traceability must be updated at phase completion.
- **RLS-03 impersonation test incomplete** — Supabase Dashboard "Impersonate user" requires Pro plan. The policy DDL is correct (confirmed via pg_policies) but the end-to-end cross-read test was not performed. Document plan-level environment requirements (Dashboard features, paid tiers) before the human-action plan runs.

### Patterns Established

- **GATE plan as phase terminator** — a blocking `autonomous: false` plan at the end of each phase enforces human sign-off before the next phase starts. Proved its value in v1.2 (caught three bugs during Phase 8 GATE, one during Phase 9 GATE).
- **`withRLS` wrapper for transaction-local auth context** — `set_config(..., TRUE)` (not FALSE) for transaction-local scope; FALSE persists to connection and leaks auth context across requests.
- **`gsd-sdk query commit` for planning artifacts** — only commit named planning files, not the entire working tree; prevents accidental staging of secrets or transient files.
- **vitest glob exclusion for `.claude/`** — abandoned parallel-agent worktrees in `.claude/` can contain stale test files that fail with deleted imports. Add `exclude: ["**/.{git,claude}/**"]` to vitest.config.ts when using parallel execution.

### Key Lessons

1. **Write SUMMARY.md before ending any session that completes a plan.** Without it, the plan shows as incomplete in the next session and requires manual reconstruction of state.
2. **Update deferred items and traceability at phase completion, not milestone close.** This is the third milestone where stale tracking tables caused unnecessary triage work.
3. **Document plan-level environment prerequisites.** "Requires Supabase Pro plan" is a blocking dependency that should appear in the plan's `<context>` before the human runs it.
4. **`npm prune` after `npm uninstall`.** `npm uninstall` updates package.json and lockfile but does not remove directories from node_modules. The verification step must check disk, not just package.json.

### Cost Observations

- Model: Claude Sonnet 4.6 throughout
- Sessions: ~6 across the milestone (6 days)
- Notable: 6 days for a complete auth stack migration + RLS enablement + package removal, with zero regressions on GCal sync. The GATE pattern was the key risk mitigation — each dangerous transition had a human-verified checkpoint.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Quick Fixes | Key Change |
|-----------|--------|-------|-------------|------------|
| v1.0 | 4 | 9 | 12 | First milestone; established all patterns |
| v1.1 | 3 | 9 | 15 deferred | Pattern reuse (inline panels) as velocity driver |
| v1.2 | 3 | 16 | 0 new | GATE pattern enforced sequential verification; auth stack replaced cleanly |

### Cumulative Quality

| Milestone | LOC (TS) | Requirements | Human-Verified |
|-----------|----------|--------------|----------------|
| v1.0 | 2,272 | 25/25 | Partial (live env needed) |
| v1.1 | 3,879 | 9/9 | Partial (live env needed) |
| v1.2 | 4,079 | 16/16 | Partial (RLS-03 impersonation deferred; human GCal approved) |

### Top Lessons (Verified Across Milestones)

1. External API failure isolation should be designed before the integration phase, not during it.
2. Token lifecycle (OAuth refresh, re-issue on sign-in) must be smoke-tested before real-user handoff.
3. Pure functions for computed state pay dividends immediately in testability and reactivity.
4. Explicit pattern cloning in plans ("model exactly on X") cuts execution time — proven in v1.1 Phase 7.
5. Update traceability and roadmap status at phase completion, not at milestone close.
