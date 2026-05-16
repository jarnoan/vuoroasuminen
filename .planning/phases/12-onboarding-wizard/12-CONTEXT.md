# Phase 12: Onboarding Wizard - Context

**Gathered:** 2026-05-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 12 delivers: a DB-driven family config table replacing `src/config/app.ts` env vars, plus a wizard UI at `/setup` for Parent A to configure parent names, emails, children, and Google Calendar IDs. The wizard is the first-run experience for both existing and new users.

**In scope:**
- `family_config` Drizzle table + migration
- `/setup` wizard route (multi-step: family data → calendar IDs → review + confirm → setup complete)
- `getAppConfig()` async function replacing synchronous `config` import
- Dashboard-level redirect to `/setup` when no `family_config` row exists
- `calendarList.list()` Server Action powering the calendar picker in the wizard
- Remove `scripts/generate-app-config.js` and its env var dependencies

**Out of scope (Phase 13):**
- Invite link generation + display
- Invite acceptance flow for Parent B
- Parent B's calendar ID collection
- Full middleware gate (ONBR-07)

</domain>

<decisions>
## Implementation Decisions

### Wizard Scope and Flow
- **D-01:** Wizard ends at "Setup complete!" screen with a hand-off note pointing to Phase 13 for inviting the second parent. No invite token generation in Phase 12.
- **D-02:** Wizard route: `/setup`. Multi-step flow: (1) family data — parent names, emails, children, start date, first parent week; (2) calendar IDs for both parents; (3) review + confirm; (4) setup complete.
- **D-03:** Parent A enters BOTH calendar IDs during the wizard. Parent A owns both Google Calendars and shares them with Parent B directly in Google Calendar (outside the app). No `parent2_calendar_id` deferral to Phase 13 — both columns are populated in Phase 12.
- **D-04:** `family_config.parent2_calendar_id` is NOT nullable — the wizard requires it before saving.

### Calendar Picker
- **D-05:** Include a `calendarList.list()` Server Action that returns Parent A's calendar names + IDs. Render as a dropdown (shadcn/ui Combobox or Select). Selecting a calendar auto-fills the ID field.
- **D-06:** Manual paste remains available as fallback (toggle or always-visible read-only text input showing the selected ID). Inline step-by-step instructions for manual discovery also shown (collapsible).

### ownerEmail Mapping
- **D-07:** `ownerEmail` is **not** a separate column in `family_config`. It is derived at read time: `ownerEmail = parent1_email` for both parent entries. `getAppConfig()` sets `ownerEmail: row.parent1Email` on both parents when reconstructing the `AppConfig` shape. This preserves Phase 8 D-01 (single calendar owner) without a new DB field.

### Existing User Migration
- **D-08:** No seed script. Both existing parents start fresh and go through the wizard to populate the DB. Existing env var data is not migrated. The production Vercel env vars for parent/children config (PARENT_FATHER_*, APP_CHILDREN, etc.) are removed after Phase 12 is deployed and wizard is confirmed working.
- **D-09:** `scripts/generate-app-config.js` is **deleted entirely** in Phase 12. The `prebuild` npm script that calls it is also removed. `src/config/app.ts` becomes a DB-backed async module.

### Routing: Dashboard-Level Redirect
- **D-10:** When `getAppConfig()` throws (no `family_config` row), the dashboard page (`src/app/dashboard/page.tsx`) redirects to `/setup`. This is a Server Component `redirect()` call, not a middleware change. Phase 13 adds the full middleware gate covering all routes (ONBR-07).
- **D-11:** `/setup` is accessible to any authenticated user. No additional auth beyond Supabase session check (same pattern as dashboard).

### DB Schema
- **D-12:** Use the schema from `ONBOARDING-STACK.md`: single-row `family_config` table with `CHECK (id = 1)` constraint added via raw SQL after `drizzle-kit push`. Schema file: `src/db/schema/domain.ts` (append to existing file).
- **D-13:** `invite_tokens` table is created in Phase 12 (to avoid a breaking schema change in Phase 13). But no application logic uses it in Phase 12.
- **D-14:** RLS policies for `family_config` and `invite_tokens` added per `ONBOARDING-STACK.md` §RLS additions.

### Config Read Path
- **D-15:** `src/config/app.ts` is rewritten to export `getAppConfig(): Promise<AppConfig>`. The `AppConfig` interface shape is preserved unchanged. All existing call sites (gcal/sync.ts, schedule/queries.ts, schedule/generate-default.ts, app/dashboard/page.tsx) are updated to `await getAppConfig()`.
- **D-16:** `generate-default.ts` refactored to accept config as a parameter (not read module-scope singleton) — matches the pattern recommended in `ONBOARDING-STACK.md`.

### Claude's Discretion
- Exact shadcn/ui component choice for calendar picker (Combobox vs Select)
- Whether to use `next-safe-action` for the wizard form submission or a plain Server Action
- Step progress indicator design (e.g., "Step 2 of 4")
- Precise Finnish copy for wizard labels and setup complete screen (consistent with existing UI language)
- Whether calendar ID validation does a live `calendarList.get` check or format-only validation

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research (Phase 12 specific)
- `.planning/research/ONBOARDING-FEATURES.md` — Wizard steps, fields, UX decisions, invite flow states, completion criteria, table stakes vs nice-to-have. Authoritative for wizard UX.
- `.planning/research/ONBOARDING-STACK.md` — DB schema (family_config, invite_tokens), Drizzle schema code, RLS policies, migration path, call site impact table. Authoritative for technical implementation.

### Requirements
- `.planning/REQUIREMENTS.md` §Onboarding — ONBR-03, ONBR-04 definitions
- `.planning/ROADMAP.md` §Phase 12 — goal, success criteria, UI hint: yes

### Existing implementation (read before touching)
- `src/config/app.ts` — current auto-generated synchronous config; will be replaced with async DB reader
- `scripts/generate-app-config.js` — will be deleted; understand what it does before removing
- `src/lib/gcal/sync.ts` — imports config; needs `await getAppConfig()`
- `src/lib/schedule/queries.ts` — imports config; needs `await getAppConfig()`
- `src/lib/schedule/generate-default.ts` — reads module-scope config singleton; refactor to accept config parameter
- `src/app/dashboard/page.tsx` — imports config; needs `await getAppConfig()` + redirect-on-missing logic
- `src/db/schema/domain.ts` — add familyConfig and inviteTokens tables here
- `src/app/auth/error/page.tsx` — existing error page pattern (Finnish copy, consistent style)

### Prior phase decisions
- `.planning/phases/08-supabase-auth-stack/08-CONTEXT.md` §D-01 — ownerEmail model (single calendar owner = setup parent)
- `.planning/phases/08-supabase-auth-stack/08-CONTEXT.md` §D-11 — GCal sync uses service_role Drizzle connection

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/button.tsx` — Button component (use for wizard CTA)
- `src/components/ui/calendar.tsx` — Date picker component (use for start date field in Step 1)
- `src/components/ui/dialog.tsx` — Dialog component (potentially useful for review step)
- `src/components/ui/alert.tsx` — Alert component (use for validation errors)
- `src/components/ui/popover.tsx` — Popover (base for Combobox/picker if needed)
- `src/components/sign-in-button.tsx` — Existing sign-in button pattern (reference for auth-gated pages)

### Established Patterns
- Finnish UI language — all user-facing copy in Finnish, consistent with existing pages
- Supabase admin Drizzle connection (`service_role` key) for all server-side writes — Phase 8 D-11
- Server Components with `redirect()` for auth routing — dashboard and auth pages already use this
- `next-safe-action` + `zod` for Server Actions with validation — already installed and used

### Integration Points
- `src/app/dashboard/page.tsx` — add `getAppConfig()` call + redirect to `/setup` on missing config
- `src/db/schema/domain.ts` — append `familyConfig` and `inviteTokens` table definitions
- `src/db/index.ts` — verify schema exports include new tables
- Google Calendar API via `user_google_tokens` — `calendarList.list()` uses the same token infrastructure as `buildGCalClient()`

</code_context>

<specifics>
## Specific Ideas

- **Calendar picker:** Parent A sees their own calendars by name (e.g., "Emma's school calendar") and selects. The raw calendar ID is shown in a read-only field below so they can verify. Both "Your calendar" and "Other parent's calendar" can be picked from the same list since Parent A owns both.
- **Route:** `/setup` (not `/onboarding`)
- **ownerEmail derivation:** `getAppConfig()` always sets `ownerEmail: row.parent1Email` on both parent entries — no wizard field, no DB column.
- **`generate-app-config.js` removal:** Delete file, remove `prebuild` npm script entry. All env vars it required (PARENT_FATHER_*, APP_CHILDREN, etc.) removed from Vercel after wizard is confirmed working.

</specifics>

<deferred>
## Deferred Ideas

- Invite link generation and display — Phase 13 (ONBR-05)
- Parent B's invite acceptance flow — Phase 13 (ONBR-06)
- Full middleware gate for all routes — Phase 13 (ONBR-07)
- Regenerate expired invite link — future milestone
- Edit family config post-onboarding (rename children, change calendar IDs) — future milestone
- Parent A notification when Parent B joins — future milestone
- Parent B's calendarList.list() picker during invite acceptance — Phase 13 nice-to-have

</deferred>

---

*Phase: 12-onboarding-wizard*
*Context gathered: 2026-05-16*
