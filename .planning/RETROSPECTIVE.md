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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Quick Fixes | Key Change |
|-----------|--------|-------|-------------|------------|
| v1.0 | 4 | 9 | 12 | First milestone; established all patterns |

### Cumulative Quality

| Milestone | LOC (TS) | Requirements | Human-Verified |
|-----------|----------|--------------|----------------|
| v1.0 | 2,272 | 25/25 | Partial (live env needed) |

### Top Lessons (Verified Across Milestones)

1. External API failure isolation should be designed before the integration phase, not during it.
2. Token lifecycle (OAuth refresh, re-issue on sign-in) must be smoke-tested before real-user handoff.
3. Pure functions for computed state pay dividends immediately in testability and reactivity.
