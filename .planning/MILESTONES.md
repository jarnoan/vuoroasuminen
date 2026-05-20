# Milestones

## v1.4 Mobile-First Polish (Shipped: 2026-05-20)

**Phases completed:** 3 phases (14–16), 7 plans
**Files changed:** 13 source files (+417 / -130 lines) | Codebase: ~7,070 LOC TypeScript
**Timeline:** 3 days (2026-05-17 → 2026-05-20)

**Key accomplishments:**

- Silent background tab recovery — visibilitychange handler tears down and re-subscribes Realtime channel, re-fetches schedule via Server Action, and delivers fresh data with no toast or reload (RTLT-01)
- Mobile-responsive header — title and name hidden on narrow viewports, icon-only sign-out button, avatar fallback circle with first initial (MOB-04)
- Two-step touch clear guard — 1s long-press arms the × button, auto-disarms after 2s; desktop hover behavior unchanged (MOB-02)
- ViewToolbar and ClearPanel adapted for mobile — `@container` responsive Prev button (icon-only at narrow width), native `<input type="date">` on mobile, Calendar Popover on desktop (MOB-03, MOB-03a)
- StatsPanel grid redesign — HTML `<table>` with children as columns and per-child custody count; replaces flat flex layout (MOB-05)
- Full schedule table mobile reflow — sticky date column, hidden notes column on main row, second-row notes with PlusIcon affordance, StatsPanel moved to sibling position outside scroll container (MOB-01, MOB-01b)

---

## v1.0 MVP (Shipped: 2026-04-20)

**Phases completed:** 4 phases, 9 plans, 19 tasks

**Key accomplishments:**

- Next.js 16 + Drizzle schema bootstrapped — 8-table PostgreSQL schema (Auth.js + domain) with Tailwind v4, shadcn/ui, and all Phase 1 dependencies
- Auth.js v5 Google OAuth with Calendar scope, refresh token rotation, edge-safe middleware, and shell UI (sign-in page + header with avatar/sign-out)
- Drizzle-backed 12-week schedule data layer: types, alternating-week generator, upsert-on-empty seed, and two Server Actions with auth guards (DRFT-01)
- 84-row interactive schedule table with color-coded parent cells (blue/rose, draft/published), click-to-toggle with optimistic revert, inline notes editing, week separators, today highlighting, and TodayButton
- Supabase Realtime wired via postgres_changes on schedule_entries — DB row changes broadcast live to all connected clients, with sticky header and notes sync bugs fixed after human verification
- Publish button in Header with shadcn/ui Dialog confirmation; publishDraft Server Action bulk-marks all draft entries published within the 84-day window
- Custody balance statistics panel above the schedule table — days per child per parent, solo days, and child-free days/weekends, computed from both draft and published entries.

---

## v1.1 Schedule Window Control (Shipped: 2026-05-06)

**Phases completed:** 3 phases (5–7), 9 plans, 92 commits
**Files changed:** 90 files (+10,869 / -165 lines) | Codebase: ~3,879 LOC TypeScript
**Timeline:** 16 days (2026-04-20 → 2026-05-06)

**Key accomplishments:**

- Per-user view window control — ViewToolbar with date picker, "Show previous week" button, and Tänään shortcut; viewStart stored as URL param (VIEW-01–04)
- Schedule extension — ExtendPanel with week-count and explicit end-date modes, live Finnish date preview, Sunday snap, and auto-navigation to first new week after confirm (EXTEND-01–03)
- Single-cell clear via × hover button — parent_id widened to nullable; unassigned state first-class in schema and GCal sync (CLEAR-01)
- Bulk date-range clear — self-contained ClearPanel with two Finnish-locale date pickers, live day/child count preview, and clearRange Server Action (CLEAR-02)
- GCal sync hardened to handle null parent_id without crashing on publish

**Known deferred items at close: 20 (see STATE.md Deferred Items)**

---

## v1.2 Supabase Auth Migration (Shipped: 2026-05-15)

**Phases completed:** 3 phases (8–10), 16 plans, 50 commits  
**Files changed:** 37 files (+754 / -534 lines) | Codebase: ~4,079 LOC TypeScript  
**Timeline:** 6 days (2026-05-09 → 2026-05-15)

**Key accomplishments:**

- Supabase Google OAuth replaces Auth.js v5 — PKCE flow, cookie-based session, route protection via `getUser()`, sign-out, and error page for failed token capture (SAUTH-01..04)
- Google refresh token captured once in `/auth/callback` → `user_google_tokens` table; GCal sync uses `ownerEmail` per calendar so either parent can publish (SAUTH-05..07, GCAL-01..02)
- Row Level Security enabled on all 5 domain tables — 19 policies applied via `supabase/policies.sql`; anon requests return `[]`; `user_google_tokens` isolated per-user by JWT email claim (RLS-01..04)
- Realtime JWT race condition fixed — `RealtimeProvider` now awaits `getSession()` and calls `setAuth(access_token)` before subscribing so live updates use authenticated role (RLS-04)
- Auth.js fully removed — 4 DB tables dropped (FK order), 6 source files deleted, packages uninstalled + pruned, env vars renamed to `GOOGLE_CLIENT_*`; both parents re-signed-in under Supabase Auth, GCal publish round-trip confirmed (CLEAN-01..03)

**Known deferred items at close: 6 (see STATE.md Deferred Items)**

---

## v1.3 Deploy + Onboarding (Shipped: 2026-05-17)

**Phases completed:** 3 phases (11–13), 12 plans, 50 commits
**Files changed:** 128 files (+19,097 / -850 lines) | Codebase: ~6,784 LOC TypeScript
**Timeline:** 2 days (2026-05-15 → 2026-05-17)

**Key accomplishments:**

- App live on Vercel at vuoroasuminen.vercel.app — both parents verified signing in with Google on production; all 15 env vars configured; Google OAuth callback and Supabase redirect allowlist set for production domain (DPLY-01–03)
- Next.js 16 compliance — middleware.ts renamed to proxy.ts; build script exits 1 on missing required env vars (DPLY-04–05)
- DB-driven family config — familyConfig + inviteTokens schema; getAppConfig() reads from DB at runtime; all APP_PARENT* env vars removed from codebase and documentation (ONBR-04)
- 4-step Finnish onboarding wizard at /setup — parent names/emails, children list, Google Calendar IDs; saves to DB; shadcn primitives (Input, Label, RadioGroup, Select) (ONBR-03)
- Invite token system — first parent generates shareable URL from StepComplete and Dashboard; token stored in DB with expiry and single-use enforcement; /invite/[token] acceptance page (ONBR-05)
- Second parent OAuth flow — invite cookie set at /invite, consumed in /auth/callback, parent2Email written to familyConfig; unauthorized email variant on auth/error page (ONBR-06)
- Three-tier access gate in proxy.ts — auth → setup completeness → email membership; exempt routes: /, /auth/*, /invite/*, /setup; unauthorized emails signed out before redirect (ONBR-07)

**Known deferred items at close: 18 (see STATE.md Deferred Items)**

---
