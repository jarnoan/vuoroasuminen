# Project Research Summary

**Project:** Vuoroasuminen — co-parenting custody scheduling web app
**Domain:** Real-time collaborative scheduling with Google Calendar integration
**Researched:** 2026-04-04
**Confidence:** HIGH

## Executive Summary

Vuoroasuminen is a two-user real-time collaborative scheduling app for co-parents managing shared custody. Experts build this type of product on a Next.js 15 + Supabase stack: the App Router handles the full-stack React surface, Supabase Realtime delivers sub-200ms cell updates between the two parents via Postgres change-data-capture (eliminating a custom WebSocket server), and Auth.js v5 handles Google OAuth while persisting the refresh tokens that the Google Calendar sync requires. The architecture is deliberately simple — exactly two principals, one schedule per family, a single Postgres table as the source of truth — and should stay that way.

The recommended approach is to build in strict dependency order: auth and DB schema first (everything depends on tokens and table structure), then a read-only schedule grid, then cell mutations with real-time sync, then the draft/publish workflow, and finally Google Calendar sync as the last layer. This order is critical because the Google Calendar integration has the most external dependencies (OAuth scope, token storage, API quota management) and should fail independently of the core scheduling product. Every feature in the MVP depends on the one before it in this chain.

The primary risks are OAuth-related: Google only returns a refresh token on first consent, testing-mode tokens expire in 7 days, and the Calendar scope requires OAuth app verification before real users can use the app. These are not implementation problems — they are Google policy constraints that must be handled as infrastructure before Calendar sync code is written. Secondary risks are in the sync layer itself: duplicate events from non-idempotent retries, orphaned events from untracked deletions, and API rate limits during bulk publishes. All are preventable with a correct data model (store event IDs per parent per day from day one, use `DATE` columns not timestamps).

## Key Findings

### Recommended Stack

The full stack is well-defined and each piece is the canonical 2026 choice for its role. Next.js 15 (App Router + Server Actions) eliminates a separate API server. Drizzle ORM provides type-safe Postgres queries with a schema that flows directly to TypeScript types. Supabase provides both managed Postgres and the Realtime pub/sub layer needed for two-parent sync, making it the right single-vendor choice over Neon + Ably or Neon + custom WebSockets. Auth.js v5 is the only Auth library with an official Drizzle adapter that correctly stores Google refresh tokens — the token persistence behavior is load-bearing for the Calendar integration. See `.planning/research/STACK.md` for full version compatibility matrix.

**Core technologies:**
- **Next.js 15 (App Router):** Full-stack React framework — API routes, Server Actions, RSC for initial load, Client Components for real-time UI
- **Supabase (Postgres + Realtime):** Managed database and WebSocket pub/sub in one platform — `postgres_changes` subscription replaces custom WebSocket server
- **Auth.js v5 + `@auth/drizzle-adapter`:** Google OAuth with refresh token persistence to `accounts` table — required for server-side Calendar API calls
- **Drizzle ORM 0.41+:** Type-safe SQL queries; schema types flow end-to-end; pairs directly with Supabase Postgres
- **`googleapis` 171.x:** Official Google Calendar API client; handles OAuth2 token management server-side
- **Tailwind CSS v4 + shadcn/ui (canary):** Utility-first styling with accessible, composable primitives (Table, Dialog, Popover needed for the schedule grid)
- **`next-safe-action` + `zod`:** Typed Server Actions with built-in Zod validation and optimistic update support — reduces cell-edit mutation boilerplate

**Critical version constraints:**
- `next-auth@beta` (v5 only) — v4 is incompatible with Next.js 15 App Router
- `npx shadcn@canary` — stable shadcn tracks Tailwind v3; canary is required for v4
- Node 20+ — needed for `crypto.randomUUID()` without polyfill

### Expected Features

The feature landscape is well-researched against live competitor products (OurFamilyWizard, Custody X Change, AppClose). See `.planning/research/FEATURES.md` for full dependency graph and competitor analysis.

**Must have (table stakes — v1 launch):**
- Google OAuth login — identity foundation; all other features depend on it
- Schedule table UI (12-week window, rows=days, columns=children + notes) — the core product
- Alternating-week default pre-fill — removes blank-slate barrier on first setup
- Real-time collaborative editing (last-write-wins, cell-level) — both parents must see identical live data
- Draft mode with explicit publish step — prevents accidental calendar writes; batch intent
- Google Calendar sync (one calendar per parent, one event per child per day) — primary value delivery; the reason this app exists
- Statistics panel (days per parent per child, solo days, child-free weekends) — validates fairness; parents need this to trust the plan
- Shared notes column — per-day, shared, single column

**Should have (competitive differentiators):**
- Per-child independent assignments on the same day — competitors treat all children as a unit; this app's table model enables split custody days
- 12-week rolling window vs. month-at-a-time — matches how custody is actually planned
- Child-free weekend statistics — meaningfully different from what competitors show

**Defer to v1.x (post-launch):**
- Schedule change history / audit log — add when parents request accountability
- Mobile-optimized layout improvements — add when usage data shows mobile is primary
- Improved onboarding flow — add when first-run experience becomes a conversion problem

**Defer to v2+ (post-PMF):**
- iCal / Outlook export — adds complexity before Google-only is validated
- Third-party view-only access (grandparents, au pairs) — adds auth model complexity
- Per-period statistics breakdown (month, school term) — 12-week totals sufficient for v1

**Do not build (anti-features):**
- Court-proof messaging, expense tracking, notification/reminder infrastructure, recurring exception templates, bidirectional calendar sync, in-app messaging — all are scope balloons that compete with dedicated tools or create legal/compliance complexity with no payoff for cooperative co-parents.

### Architecture Approach

The architecture follows a write-only sync pattern with a single Postgres source of truth. The React UI optimistically updates on cell edits and subscribes to Supabase Realtime for incoming changes from the other parent. Server Actions handle mutations (cell edits, publish). A GCal sync worker runs after publish to diff the DB state against Google Calendar and apply the minimal set of upsert/delete operations using deterministic event IDs. Google Calendar is treated as a display layer, not a second source of truth — this eliminates bidirectional sync complexity entirely. See `.planning/research/ARCHITECTURE.md` for data flow diagrams, data model schema, and code patterns.

**Major components:**
1. **React UI (Client Components):** Schedule grid, draft/publish controls, stats panel; Supabase Realtime subscription for live cell updates; optimistic updates via `next-safe-action`
2. **Next.js Server Actions / Route Handlers:** Cell edit mutations (UPSERT with `ON CONFLICT`), publish action (status transition + GCal sync trigger), stats computation
3. **Auth.js v5 + Drizzle adapter:** Google OAuth flow; stores `access_token`, `refresh_token`, `expires_at` in `accounts` table; token refresh handled in `lib/gcal/tokens.ts`
4. **GCal sync worker (`lib/gcal/sync.ts`):** Computes diff between DB state and `gcal_events` mirror; calls `googleapis` for creates/updates/deletes; handles token refresh; tracks per-event sync status
5. **Supabase Postgres:** `schedule_entries` (day × child × parent × status), `gcal_events` (event ID mirror per parent per day), `schedules`, `schedule_members`, `children`, Auth.js `accounts`

**Key architecture decisions:**
- `schedule_entries.status` is a `'draft' | 'published'` enum, not boolean flags — this prevents invalid state combinations and allows per-row status
- `schedule_entries.date` is a `DATE` column, not `TIMESTAMP` — custody days are calendar dates, not points in time; avoids UTC/local timezone misalignment in Google Calendar
- `gcal_events` stores one row per `(user_id, child_id, date)` with the Google Calendar event ID — enables idempotent upsert and orphan cleanup
- Deterministic event IDs (`vuoro_{userId}_{childId}_{date}`) tagged on `extendedProperties.private` — allows reconciliation without a full Calendar list scan

### Critical Pitfalls

Full analysis with recovery strategies in `.planning/research/PITFALLS.md`.

1. **Refresh token not stored on re-login** — Google only returns a refresh token on first consent or forced `prompt=consent`. Store the token immediately to DB; never overwrite with null; implement "Reconnect Calendar" UI that forces re-consent. Must be correct before Calendar sync code is written.

2. **OAuth testing-mode tokens expire in 7 days** — If the Google Cloud project's OAuth consent screen is in Testing status, all tokens expire weekly. Move to Production publishing status before handing the app to real users; budget 3-5 business days for Google's verification process. Start this process at least one week before the planned user handoff.

3. **Duplicate calendar events from non-idempotent retries** — `events.insert` (POST) is not idempotent; retrying a failed call creates a second event. Store the returned event ID in `gcal_events` immediately; use `events.patch` for existing rows, `events.insert` only for null IDs. Tag events with `extendedProperties.private` containing your internal custody-day ID.

4. **Orphaned events on custody reassignment** — When a day flips from parent A to parent B, the old event on parent A's calendar is never deleted unless the sync worker explicitly checks both event ID columns. Store `gcal_event_id` separately per parent per day; reconcile both calendars on every publish.

5. **DATE vs TIMESTAMP timezone misalignment** — Using `TIMESTAMP` and deriving dates via `.toISOString()` causes calendar events to appear on the wrong day for parents in different timezones. Custody days must be stored as `DATE` (plain calendar date); passed directly to Google Calendar `start.date`/`end.date` as `YYYY-MM-DD` strings. Fix the schema type; never patch the sync logic.

6. **Bulk publish hitting Google Calendar API rate limits** — Publishing 12 weeks × 2 children × 2 parents = up to 336 API calls at once. Serialize writes with delay; track per-event sync status (`gcal_synced_at`) so partial syncs resume rather than restart; implement exponential backoff on 429.

7. **Stale data after WebSocket reconnect** — Supabase Realtime auto-reconnects at the socket level but does not replay missed events. Always re-fetch the full schedule window on reconnect; show a visible connection status indicator.

## Implications for Roadmap

Based on the architecture's natural dependency order and the pitfall-to-phase mapping from research, a 5-phase structure is recommended.

### Phase 1: Foundation — Auth, Schema, and Project Setup

**Rationale:** Everything downstream depends on authenticated users and a stable DB schema. The two hardest pitfalls to fix retroactively (wrong column types for dates, missing token storage) must be correct here. The OAuth verification process should be started at the end of this phase (it runs in parallel with development).

**Delivers:** Working Google OAuth login, fully typed Postgres schema matching the architecture's data model, project scaffolding with all dependencies installed and configured, Drizzle migrations in place.

**Addresses:** Google OAuth login (P1 feature)

**Avoids:**
- Pitfall 1 (refresh token not stored) — implement `access_type=offline`, `prompt=consent`, null-guard in Auth.js config
- Pitfall 6 (DATE vs TIMESTAMP) — schema must use `DATE` type for `schedule_entries.date` from the start
- Pitfall 9 (boolean flags) — schema must use `status TEXT` enum, not `is_draft`/`is_published`

**Research flag:** Standard patterns. Auth.js v5 + Drizzle adapter is well-documented; no deeper research phase needed.

---

### Phase 2: Schedule Table UI (Read-Only)

**Rationale:** Rendering the grid from static data validates the data model and component structure before any write logic is added. Architecture research explicitly calls this out as step 2 in build order. Building this before mutations ensures the UI and types are stable when the write path is introduced.

**Delivers:** Responsive 12-week rolling schedule grid (rows=days, columns=children + notes column), color-coded by parent, alternating-week default pre-fill logic, statistics panel (read from DB).

**Addresses:**
- Schedule table UI (P1)
- Alternating-week pre-fill (P1)
- Statistics panel (P1)
- Shared notes column (P1)
- Color-coding by parent (table stakes)
- Mobile-usable interface (table stakes)

**Avoids:** Pitfall 5 (recomputing stats on every keystroke) — stats computed server-side on page load, not on cell changes.

**Research flag:** Standard patterns. Next.js RSC + shadcn/ui Table is well-documented. Alternating-week calculation is custom logic but straightforward with `date-fns`.

---

### Phase 3: Real-Time Collaborative Editing (Draft Mode)

**Rationale:** Adds the write path and live sync simultaneously — they are tightly coupled (writes trigger realtime events). `next-safe-action` with optimistic updates and Supabase Realtime subscription complete the core collaborative loop. Draft status means edits are visible to both parents but not yet pushed to Google Calendar.

**Delivers:** Cell edit mutations (UPSERT with last-write-wins), Supabase Realtime subscription for live cross-parent updates, optimistic UI updates, `updated_by`/`updated_at` display, visual cell flash on remote overwrite, connection status indicator, reconnect re-fetch.

**Addresses:**
- Real-time collaborative editing (P1)
- Draft mode (P1, first half — draft state functional)
- Per-child custody tracking (P1, fully enabled by table model)
- Change request/approval workflow (foundation)

**Avoids:**
- Pitfall 7 (stale data after reconnect) — re-fetch on reconnect, connection status indicator
- Pitfall 8 (silent last-write-wins overwrite) — `updated_by` column, cell flash on remote update
- Anti-pattern: polling (use Supabase Realtime, not polling)

**Research flag:** Standard patterns. Supabase `postgres_changes` subscription pattern is fully documented with Next.js examples. `next-safe-action` `useOptimisticAction` is well-documented.

---

### Phase 4: Publish Flow and Statistics

**Rationale:** The publish action (draft → published status transition) is a prerequisite for Calendar sync. It is built here without Calendar sync so the state machine is validated before external API dependencies are introduced. Statistics finalized here since they operate on published state.

**Delivers:** Publish action (bulk status transition with confirmation dialog showing scope), `draft | published` visual distinction in the UI, finalized statistics computation (days per parent, child-free weekends), publish confirmation with summary ("Publishing 14 changes across 2 children for Apr 15 – Jul 15").

**Addresses:**
- Draft mode → approve → publish flow (P1, complete)
- Statistics panel (P1, complete)
- Both parents see identical data (confirmed via real-time + consistent publish state)

**Avoids:**
- Pitfall 9 (boolean flags) — validated: single `status` enum, correct state transitions enforced in API
- UX pitfall: ambiguous publish button — confirmation dialog shows scope before committing

**Research flag:** Standard patterns. State machine is simple (draft → published only at MVP). No external dependencies in this phase.

---

### Phase 5: Google Calendar Sync

**Rationale:** Built last because it has the most external dependencies (Google API, OAuth token management, rate limits, quota) and fails independently of the core scheduling product. By this point, the schema is correct (DATE columns, event ID storage columns), the publish flow is working, and OAuth tokens are being persisted. All prerequisites for correct Calendar sync are in place.

**Delivers:** GCal sync worker (`lib/gcal/sync.ts`) — creates, updates, and deletes all-day events per child per parent calendar on publish; deterministic event IDs with `extendedProperties.private` tagging; idempotent upsert via `gcal_events` mirror table; serialized API calls with exponential backoff on rate limits; per-event sync status tracking; orphan cleanup (deletes stale events when custody days flip); refresh token rotation in `lib/gcal/tokens.ts`; "Google Calendar disconnected" banner on 401/403; sync progress indicator for large publishes.

**Addresses:**
- Google Calendar sync (P1, the primary value delivery mechanism)
- Per-child independent calendar events (not "Kids at Dad" combined events)

**Avoids:**
- Pitfall 1 (refresh token not stored) — final verification: confirm token present in DB, null-guard on overwrite
- Pitfall 2 (7-day Testing mode expiry) — OAuth consent screen must be in Production before user handoff
- Pitfall 3 (OAuth scope verification) — `calendar.events.owned` scope (not full `calendar`); verification started in Phase 1
- Pitfall 4 (duplicate events from retries) — idempotent upsert via stored event IDs; check before insert
- Pitfall 5 (orphaned events) — reconcile both parent calendars on every publish
- Pitfall 6 (UTC/local date mismatch) — final verification: DATE columns, `YYYY-MM-DD` passed directly to Calendar API
- Pitfall 10 (rate limits on bulk publish) — serialized writes, per-event tracking, exponential backoff
- Anti-pattern: bidirectional sync — write-only; app → GCal only; documented in UI

**Research flag:** Needs careful implementation. The GCal sync worker involves the most non-obvious behavior (token refresh flow, idempotent event IDs, orphan cleanup, rate limit handling). Consider using `/gsd:research-phase` if implementation stalls on any of these sub-problems. Official Google Calendar API docs are thorough but the interaction with Auth.js token storage is a less-documented integration point.

---

### Phase Ordering Rationale

- **Auth before everything:** Auth.js token storage behavior (pitfalls 1, 2, 3) must be correct before Calendar sync code exists. Fixing it retroactively requires user re-authorization.
- **Schema before mutations:** DATE columns, status enum, and gcal_events columns must be in the initial schema. Changing column types post-migration with live data is high-risk.
- **Read before write:** Validates the data model and component structure before adding mutation complexity.
- **Real-time before publish:** The publish action is a superset of the edit flow; real-time sync must work correctly on individual cell writes before it works on a bulk status transition.
- **GCal sync last:** Isolates the highest-external-dependency work; the core scheduling product is usable and testable throughout phases 1–4 without Google API access.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 5 (Google Calendar Sync):** The token refresh ↔ Auth.js integration is a less-documented interaction; the rate-limit backoff strategy may need specific Google Calendar quota numbers; idempotent event ID scheme needs testing against the Calendar API behavior.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Auth + Schema):** Auth.js v5 + Drizzle adapter is fully documented with official examples.
- **Phase 2 (Schedule Table):** RSC + shadcn/ui Table is standard; alternating-week logic is custom but trivial.
- **Phase 3 (Real-Time):** Supabase `postgres_changes` + `next-safe-action` optimistic updates are well-documented.
- **Phase 4 (Publish Flow):** Simple state machine; no external dependencies.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies verified against official docs and current ecosystem guides; version compatibility matrix confirmed |
| Features | HIGH | Corroborated against multiple live competitor products (OFW, AppClose, Custody X Change) and user reviews; feature gaps confirmed by direct comparison |
| Architecture | MEDIUM-HIGH | Real-time and GCal patterns well-established with official examples; specific scheduling data model is novel but composed of known primitives (UPSERT, state enum, event ID mirror) |
| Pitfalls | HIGH | OAuth/Calendar API behavior verified against official Google documentation; real-time reconnect patterns from multiple corroborating sources |

**Overall confidence:** HIGH

### Gaps to Address

- **OAuth app verification timeline:** The Google verification process for sensitive Calendar scopes takes 3-5 business days but may be longer. Start it immediately in Phase 1; do not treat it as a deployment detail. Verify the exact scope required (`calendar.events.owned` vs `calendar`) against the actual operations the sync worker performs.
- **Supabase free tier limitations for real users:** Supabase free tier pauses after 1 week of inactivity. Upgrade to Supabase Pro ($25/mo) before sharing with real users — document this in the deployment checklist.
- **Notes data model ambiguity:** The architecture notes that shared notes per day could live on the first child's `schedule_entries` row or in a separate `daily_notes` table. The `daily_notes (schedule_id, date, note)` table approach is recommended (avoids null duplication) but should be confirmed during Phase 2 schema work.
- **GCal sync worker timeout at MVP scale:** For a 12-week publish with multiple children, synchronous execution in an API route may approach Vercel's function timeout. This is acceptable at MVP but should be monitored; the architecture identifies this as the first scaling bottleneck.

## Sources

### Primary (HIGH confidence)
- Auth.js official docs — Google provider, Drizzle adapter, Refresh Token Rotation: https://authjs.dev/
- Supabase official docs — Realtime with Next.js, Postgres Changes, Realtime Limits: https://supabase.com/docs/
- Google Calendar API official docs — Sync, Push Notifications, Create Events, Extended Properties, Quota Management, OAuth Scopes: https://developers.google.com/workspace/calendar/api/
- Google OAuth 2.0 official docs — Web Server Applications, Sensitive Scope Verification: https://developers.google.com/identity/protocols/oauth2/
- npmjs.com — `googleapis` 171.4.0: https://www.npmjs.com/package/googleapis
- shadcn/ui docs — Tailwind v4 support: https://ui.shadcn.com/docs/tailwind-v4

### Secondary (MEDIUM confidence)
- SoftwareMill — Modern Full Stack Application Architecture using Next.js 15: https://softwaremill.com/modern-full-stack-application-architecture-using-next-js-15/
- PkgPulse — Next.js Developer Ecosystem Guide 2026: https://www.pkgpulse.com/blog/nextjs-developer-ecosystem-guide-2026
- Bytebase — Neon vs. Supabase (2025): https://www.bytebase.com/blog/neon-vs-supabase/
- Ably — WebSocket Architecture Best Practices: https://ably.com/topic/websocket-architecture-best-practices
- CalendHub — Calendar Webhook Integration Developer Guide 2025: https://calendhub.com/blog/calendar-webhook-integration-developer-guide-2025/
- Competitor feature analysis: OurFamilyWizard, Custody X Change, AppClose (direct product research)

### Tertiary (LOW confidence)
- Google OAuth Testing Mode 7-day expiry (community corroboration, multiple sources): https://forums.homeseer.com/forum/...
- Nango Blog — invalid_grant token patterns: https://nango.dev/blog/google-oauth-invalid-grant-token-has-been-expired-or-revoked

---
*Research completed: 2026-04-04*
*Ready for roadmap: yes*
