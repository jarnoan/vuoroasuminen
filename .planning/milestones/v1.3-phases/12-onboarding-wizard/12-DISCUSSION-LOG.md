# Phase 12: Onboarding Wizard - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-16
**Phase:** 12-onboarding-wizard
**Areas discussed:** Wizard scope boundary, ownerEmail after migration, Calendar picker, Existing user migration

---

## Wizard Scope Boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Config saved + hand-off link to Phase 13 | Wizard ends with "Setup complete!" and pointer to Phase 13 for invite. Clean phase separation. | ✓ |
| Config saved + invite link displayed | Wizard includes invite token generation and copy-link. Crosses into ONBR-05 territory. | |
| Config saved only — no invite mention | Wizard stops at DB write. No invite UI at all. | |

**User's choice:** Config saved + hand-off link to Phase 13
**Notes:** Clean boundary. Phase 13 owns invite link entirely.

---

## Parent B's Calendar ID (follow-up on wizard scope)

| Option | Description | Selected |
|--------|-------------|----------|
| Defer to Phase 13 | family_config.parent2_calendar_id nullable; Parent B enters their own during invite acceptance. | |
| Collect in Phase 12 wizard (parent A owns both) | Parent A enters both calendar IDs. Parent A owns both GCal calendars, shares with Parent B in GCal. | ✓ |

**User's choice:** Parent A owns both calendars and shares them with Parent B in Google Calendar. Both IDs collected in Phase 12 wizard.
**Notes:** This matches the existing app behavior (ownerEmail = jarnoan@gmail.com on both entries). No nullable column needed.

---

## ownerEmail After Migration

| Option | Description | Selected |
|--------|-------------|----------|
| Implicit: ownerEmail = parent1_email always | No separate DB column. getAppConfig() derives ownerEmail from parent1_email at read time. | ✓ |
| Explicit: add owner_email column | Separate DB column. More flexible but redundant for single-owner model. | |
| Per-calendar: each parent owns their own | ownerEmail = each parent's email. Requires Parent B to sign in for GCal sync. | |

**User's choice:** Implicit — ownerEmail = parent1_email, derived at read time.

---

## Calendar Picker (calendarList.list)

| Option | Description | Selected |
|--------|-------------|----------|
| Include picker (Recommended) | calendarList.list() Server Action populates dropdown. Selecting auto-fills ID. Manual paste fallback. | ✓ |
| Manual paste only | Inline instructions. Simpler but higher friction. | |

**User's choice:** Include picker.

---

## Existing User Migration

| Option | Description | Selected |
|--------|-------------|----------|
| Seed DB from env vars — skip wizard for existing users | family_config seeded before deploy. Both parents continue without wizard. | |
| Start fresh — existing users test the wizard | No seed script. Both parents go through wizard. Existing env var data discarded. | ✓ |
| Manual seed only | Developer inserts row via psql/Supabase dashboard. | |

**User's choice:** Start fresh. No seed script. Both parents test the wizard. Existing data discarded.
**Notes:** This means production Vercel env vars for parent/children config removed after Phase 12 wizard is confirmed working.

---

## Routing (follow-up on migration)

| Option | Description | Selected |
|--------|-------------|----------|
| Dashboard-level redirect in Phase 12 | Dashboard calls getAppConfig(); on error redirect to /setup. No middleware changes. | ✓ |
| Include basic middleware gate in Phase 12 | Add ONBR-07 check to middleware now (ahead of Phase 13 scope). | |
| No redirect — manual navigation to /setup | Both parents navigate to /setup URL directly for testing only. | |

**User's choice:** Dashboard-level redirect.

---

## Additional Decisions (free text)

- `generate-app-config.js`: **Remove entirely** — delete script and prebuild npm script entry.
- Route name: `/setup` (not `/onboarding`).

---

## Claude's Discretion

- Exact shadcn/ui component for calendar picker (Combobox vs Select)
- Whether to use next-safe-action or plain Server Action for wizard form
- Step progress indicator design
- Finnish copy for wizard labels and setup complete screen
- Live vs format-only calendar ID validation

## Deferred Ideas

- Invite link generation → Phase 13 (ONBR-05)
- Parent B invite acceptance → Phase 13 (ONBR-06)
- Full middleware gate → Phase 13 (ONBR-07)
- Regenerate expired invite link → future milestone
- Edit family config post-onboarding → future milestone
