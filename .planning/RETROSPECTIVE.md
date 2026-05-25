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

## Milestone: v1.3 — Deploy + Onboarding

**Shipped:** 2026-05-17
**Phases:** 3 (11–13) | **Plans:** 12 | **Timeline:** 2 days (2026-05-15 → 2026-05-17)

### What Was Built

- App deployed to Vercel (vuoroasuminen.vercel.app) — 15 production env vars, Google OAuth callback configured, both parents verified on production domain
- Next.js 16 compliance (proxy.ts) and build-time env var validation (generate-app-config.js exits 1)
- familyConfig + inviteTokens DB tables replace all APP_PARENT* env vars; getAppConfig() reads at runtime
- 4-step Finnish onboarding wizard at /setup — parent names/emails, children list, calendar IDs, all validated inline
- Invite token system: first parent generates URL from StepComplete/Dashboard; token single-use with DB expiry enforcement
- Second parent OAuth flow: invite cookie set at /invite → consumed in auth/callback → parent2Email written to familyConfig
- Three-tier access gate in proxy.ts: auth → setup completeness → email membership; unauthorized emails signed out before redirect

### What Worked

- **Code review agent caught real bugs** — CR-01 (race condition in delete+insert) and CR-02 (Secure flag on cookie) were genuine security issues found before UAT. Running `/gsd-code-review` before human testing is worth the cost.
- **Security review surfaced actionable findings** — three WR findings (WR-01 rate limiting, WR-02 clipboard try/catch, WR-03 signOut order) were concrete improvements, not theoretical concerns.
- **Invite flow design was right first time** — cookie-based invite state (set at /invite, consumed in /auth/callback) required no rework. The design from P01 held through P03 without modification.
- **Worktree recovery tooling worked** — one SUMMARY.md was rescued from an abandoned worktree via `gsd-sdk query commit` before cleanup. The recovery path (`docs(recovery): rescue uncommitted SUMMARY.md`) is now proven.

### What Was Inefficient

- **REQUIREMENTS.md checkboxes not updated during Phase 13** — ONBR-05/06/07 were still `[ ]` at milestone close despite Phase 13 being fully complete. Required manual correction before archiving. Fourth occurrence of this pattern.
- **ROADMAP.md progress table stale** — Phase 13 showed "Not started / 0/4" at milestone close because the table was never updated during execution. STATE.md percent was also frozen at 67%.
- **18 open items at audit-open** — 15 were old quick tasks from v1.0/v1.1 with "missing" status (directories deleted but STATE.md not cleaned). Zero actual work needed, but triage took time.
- **2-day milestone felt rushed** — fast execution is good, but Phase 13 UAT was done with 5 scenarios on the same day as implementation. Human verification depth was shallower than v1.2.

### Patterns Established

- **Three-tier middleware gate** — auth → setup completeness → email membership in proxy.ts. Pattern is now documented and reusable for any new protected section.
- **Invite token cookie flow** — set at acceptance page, consumed in auth/callback, single-use enforced by DB transaction. Clean and auditable.
- **`vercel env add` for secrets** — interactive input keeps secrets out of shell history and CI logs. Established as the correct production secret-injection pattern.
- **Security review as pre-UAT gate** — running `/gsd-code-review` then `/gsd-secure-phase` before human testing caught two security issues in Phase 13. Worth running on every phase with auth/cookie/middleware changes.

### Key Lessons

1. **Update REQUIREMENTS.md checkboxes at plan completion, not milestone close.** This is the fourth milestone where stale checkboxes caused unnecessary triage. The cost is one edit per requirement; the benefit is clean milestone close.
2. **Update the ROADMAP.md progress table row at phase completion.** A stale "Not started" row at milestone close is confusing and requires manual correction.
3. **Clean up resolved quick task entries from STATE.md Deferred Items when they complete.** 15 "missing" entries at close were all resolved, but STATE.md was never updated. Zero-cost maintenance per task.
4. **Shallow UAT on same day as implementation is a risk.** Phase 13 UAT passed 5/5, but the test scenarios were written by the implementer. Independent verification (second parent actually trying the flow) should happen before milestone close for auth-critical phases.

### Cost Observations

- Model: Claude Sonnet 4.6 throughout
- Sessions: ~4 across the milestone (2 days)
- Notable: Fastest milestone by wall-clock time (2 days). Code review + security review agents added ~30 min but caught real bugs — positive ROI. The proxy.ts three-tier gate reused the Phase 8 middleware patterns directly, cutting design time to near zero.

---

## Milestone: v1.4 — Mobile-First Polish

**Shipped:** 2026-05-20
**Phases:** 3 (14–16) | **Plans:** 7 | **Timeline:** 3 days (2026-05-17 → 2026-05-20)

### What Was Built

- Background tab recovery — visibilitychange handler tears down channel, re-fetches schedule via Server Action, re-subscribes with fresh JWT; silent delivery with no toast or reload (RTLT-01)
- Mobile-responsive header — title and name hidden at 360px, icon-only sign-out, avatar fallback circle
- Two-step touch clear guard — 1s long-press arms ×, auto-disarms after 2s; desktop hover behavior unchanged; no swipe-to-reveal (WCAG 2.5.1) (MOB-02)
- ViewToolbar: `@container` responsive Prev button (icon-only at narrow widths), native `<input type="date">` on mobile, Calendar Popover on desktop (MOB-03, MOB-03a)
- StatsPanel HTML `<table>` grid with children as columns and per-child custody/solo counts (MOB-05)
- Full schedule table mobile reflow — sticky date column, hidden notes on main row, second-row notes with PlusIcon affordance, StatsPanel moved outside scroll container (MOB-01, MOB-01b)

### What Worked

- **All v1.4 changes stayed rendering-layer only** — no schema changes, no new Server Actions, no data flow changes. The constraint was set in research and held throughout all three phases. Zero DB migrations.
- **Container queries for responsive Prev button** — `@container` avoided the hydration-flash risk of `useMediaQuery` in layout render paths. The pattern is clean and reusable.
- **Build order from research held** — realtime fix → header → clear guard → toolbar → stats → table reflow. Each phase delivered stable foundations for the next; no rework across phases.
- **Phase 14 "ugly but correct" approach validated** — the visibilitychange D-01–D-05 sequence (remove, refetch, setDays, setAuth, re-subscribe) was flagged as verbose in research but shipped without simplification. Code review later confirmed the cleanup guards and cancelled flag were all necessary.
- **Long-press UX decision was right** — shadcn AlertDialog was considered then rejected (extra tap on desktop); swipe-to-reveal was rejected (WCAG 2.5.1). Long-press with 2s auto-disarm satisfied both touch and accessibility requirements.

### What Was Inefficient

- **Phase 14 ROADMAP.md progress row never updated** — Phase 14 completed successfully (2/2 plans, VERIFICATION.md present) but the progress table showed "Not started / 0/2" at milestone close. Fifth occurrence of this pattern.
- **RTLT-01 traceability checkbox not updated** — the REQUIREMENTS.md traceability table showed RTLT-01 as "Pending" even after Phase 14 delivered and verified it. Required manual correction at milestone close.
- **Human UAT deferred to milestone close** — all three HUMAN-UAT.md files were in `partial` or `human_needed` state at close. The pattern of deferring human testing accumulates into a milestone-close bottleneck. Better: sign off each phase's UAT before starting the next.

### Patterns Established

- **`@container` for viewport-responsive components** — prefer container queries over `useMediaQuery` for any responsive behavior in components that appear in layout render paths. Avoids hydration flash.
- **Native `<input type="date">` on mobile** — zero JS overhead, uses OS picker, correct locale. Pattern for any date input in a mobile context.
- **Second-row notes via sibling `<tr>`** — for table rows that need to expand with extra content on mobile, a sibling `<tr>` with a `colspan` spanning the full table width is cleaner than absolute positioning.
- **StatsPanel as DOM sibling, not child of scroll container** — any panel that should be "below the table" on mobile must be outside the scroll container in the DOM, not just visually positioned.

### Key Lessons

1. **Update REQUIREMENTS.md checkboxes and ROADMAP.md progress table at plan completion.** Fifth milestone where stale state at close required manual triage. The fix is one edit per requirement/phase; the cost of deferring is repeated confusion at close.
2. **Sign off human UAT per phase, not at milestone close.** Three HUMAN-UAT.md files in deferred state at close created a bottleneck. UAT should be signed off before starting the next phase — it surfaces bugs while the implementation is still fresh.
3. **Rendering-layer-only constraints are highly effective.** Stating "no schema changes, no new Server Actions" in research eliminated entire categories of rework and kept each phase scoped and fast.

### Cost Observations

- Model: Claude Sonnet 4.6 throughout
- Sessions: ~5 across the milestone (3 days)
- Notable: 3-day milestone, rendering-layer only. Phase 14 (realtime) was the most technically subtle — the visibilitychange recovery sequence required careful ordering. Phases 15–16 were pattern-driven CSS/component work with predictable execution.

---

## Milestone: v1.5 — UI Refinements

**Shipped:** 2026-05-25
**Phases:** 3 | **Plans:** 8 | **Timeline:** 5 days (2026-05-20 → 2026-05-25)

### What Was Built

- "Viikko N" ISO week label row above every Monday in ScheduleTable — `getISOWeek` from date-fns, renders for every week including the first (UI-01)
- Desktop full-page scroll — removed `sm:overflow-y-auto` inner scroll container; sticky `<thead>` preserved; `scrollIntoView({block:"start"})` + `scroll-mt-10` for today row (UI-02)
- Mobile long-press Tyhjennä — `isHolding`-driven 1s CSS fade → `navigator.vibrate(100)` → full-cell red "Tyhjennä" armed render; `@media(hover:none/hover)` Tailwind variants split touch vs. pointer; desktop hover × unchanged (UI-04)
- Mobile note affordance: PlusIcon → Pencil; note row visually merged with day row via `pt-0 pb-1 pl-8` + `max-sm:[&>td]:border-b-0` on day rows that have notes (UI-03, UI-05)
- StatsPanel column alignment via `table-layout:fixed`, `<colgroup>`, `min-w-[72px] sm:min-w-[90px]` on child columns, `px-3` on label columns, wrapper `p-3` → `py-3` (UI-06)

### What Worked

- **All six requirements delivered in three phases with zero scope creep.** The research-phase decision to constrain v1.5 to rendering-layer only (same as v1.4) held throughout. No schema changes, no new Server Actions.
- **Phase 18 worktree isolation caught a pre-existing conflict.** The `@media(hover)` approach was discovered to be superior to `max-sm:` for touch/pointer split — this fix was caught during execution (D-04 in context), not in planning.
- **Human verification gated on real operator interaction** — Phase 17 (SC-1..SC-4) and Phase 18 (SC-1..SC-5) both had explicit human-verify checkpoints. SC-2 (vibration) noted as "pending real-device confirmation" in 17-03, but the visual fade and armed snap were verified in DevTools.
- **`table-layout:fixed` with colgroup** was the right call for StatsPanel — CSS grid with `subgrid` would have required cross-browser polyfills; the HTML table approach was both semantically correct and immediately browser-compatible.

### What Was Inefficient

- **Phase 18 ROADMAP.md checkbox stale at milestone close.** 18-03-SUMMARY.md was approved on 2026-05-22 but plan 18-03 was still marked `[ ]` in ROADMAP.md at milestone open. Sixth occurrence of update-at-phase-completion failure.
- **REQUIREMENTS.md traceability checkboxes for UI-03/04/05 still unchecked.** Required manual correction at milestone close — same pattern as v1.4 RTLT-01 issue.
- **19-VERIFICATION.md `human_needed` open at close.** A targeted 360px mobile re-check was flagged by the code review (WR-01) and left to the operator. Operator confirmed pass, but the open status added a step to milestone close.
- **Accomplishment extraction from SUMMARY.md files failed.** The `gsd-sdk query milestone.complete` tool extracted meta-labels ("One-liner:", "APPROVED") instead of content. Required manual rewrite of MILESTONES.md entry.

### Patterns Established

- **`@media(hover:none/hover)` for touch vs. pointer split** — correct for any behavior that should apply to all touch devices (including large tablets), not just narrow viewports. `max-sm:` would miss iPad-class touch screens.
- **Separate `isHolding` and `isArmed` states** — `isHolding` drives the CSS transition class (removed on cancel for instant snap-back); `isArmed` controls the UI render. Combining them would cause reverse animation on release.
- **`navigator.vibrate` feature-detected via `typeof`** — covers SSR and browsers without Vibration API; no try/catch needed.
- **`table-layout:fixed` required for column alignment with `min-w` classes** — browser ignores declared widths under auto layout; fixed layout is the switch that makes `<colgroup>` and `min-w` meaningful.

### Key Lessons

1. **Update REQUIREMENTS.md checkboxes and ROADMAP.md progress table at plan completion.** Sixth milestone. The pattern is fully established but the habit is not. Consider adding a post-plan checklist step.
2. **Verification gaps opened by code review should be resolved before phase close, not deferred.** WR-01 in Phase 19 was flagged in the review, left for the operator, and surfaced again at milestone close. If the code review identifies a visual concern, the human-verify plan should explicitly address it.
3. **Rendering-layer-only constraint (second milestone)** — zero DB migrations, fast execution, predictable scope. Confirmed as a go-to pattern for UI polish milestones.

### Cost Observations

- Model: Claude Sonnet 4.6 throughout
- Sessions: ~6 across the milestone (5 days)
- Notable: Small milestone — 3 source files changed (+74 net LOC). Phase 18 was the most complex (three interacting interaction states); Phase 19 was a single CSS fix with human verification.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Quick Fixes | Key Change |
|-----------|--------|-------|-------------|------------|
| v1.0 | 4 | 9 | 12 | First milestone; established all patterns |
| v1.1 | 3 | 9 | 15 deferred | Pattern reuse (inline panels) as velocity driver |
| v1.2 | 3 | 16 | 0 new | GATE pattern enforced sequential verification; auth stack replaced cleanly |
| v1.3 | 3 | 12 | 0 new | Fastest milestone (2 days); code review caught real security bugs pre-UAT |
| v1.4 | 3 | 7 | 0 new | Rendering-layer constraint kept all 3 phases scoped and zero-migration |
| v1.5 | 3 | 8 | 0 new | Second rendering-layer-only milestone; 3 source files, +74 net LOC |

### Cumulative Quality

| Milestone | LOC (TS) | Requirements | Human-Verified |
|-----------|----------|--------------|----------------|
| v1.0 | 2,272 | 25/25 | Partial (live env needed) |
| v1.1 | 3,879 | 9/9 | Partial (live env needed) |
| v1.2 | 4,079 | 16/16 | Partial (RLS-03 impersonation deferred; human GCal approved) |
| v1.3 | 6,784 | 10/10 | Partial (VERIFICATION.md human_needed; UAT 5/5 passed same-day) |
| v1.4 | 7,070 | 8/8 | Passed (all UAT scenarios signed off at milestone close) |
| v1.5 | 7,144 | 6/6 | Passed (Phase 17 + 18 operator-verified; Phase 19 operator confirmed at close) |

### Top Lessons (Verified Across Milestones)

1. External API failure isolation should be designed before the integration phase, not during it.
2. Token lifecycle (OAuth refresh, re-issue on sign-in) must be smoke-tested before real-user handoff.
3. Pure functions for computed state pay dividends immediately in testability and reactivity.
4. Explicit pattern cloning in plans ("model exactly on X") cuts execution time — proven in v1.1 Phase 7.
5. Update traceability and roadmap status at phase completion, not at milestone close.
6. Code review + security review before UAT catches real bugs — positive ROI even on small phases (v1.3: 2 security bugs found pre-UAT).
7. Rendering-layer-only constraints eliminate whole categories of risk and rework — state it explicitly in research and hold it throughout execution (v1.4 + v1.5: zero DB migrations across 6 phases).
8. Update REQUIREMENTS.md checkboxes and ROADMAP.md progress table at plan completion — recurring stale-state debt at every milestone close (six milestones, same pattern).
