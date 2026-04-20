# Milestones

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
