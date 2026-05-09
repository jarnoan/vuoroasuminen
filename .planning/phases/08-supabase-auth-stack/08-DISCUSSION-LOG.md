# Phase 8: Supabase Auth Stack - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-09
**Phase:** 08-supabase-auth-stack
**Areas discussed:** Calendar ownership model, Token failure page, Warning banner dismiss

---

## Calendar ownership model

| Option | Description | Selected |
|--------|-------------|----------|
| One shared owner | Both calendars use same ownerEmail. Only one parent must sign in for sync. | ✓ |
| Per-calendar owners | Each parent's calendar uses their own ownerEmail. Both must sign in. | |

**User's choice:** One shared owner

**Notes:** Whoever sets up the app puts their email as `ownerEmail` on both calendar entries (requires write access to both calendars). User also noted the current `father`/`mother` terminology should eventually be replaced with gender-neutral terms — deferred to a separate task.

---

## Token failure page

| Option | Description | Selected |
|--------|-------------|----------|
| Try again button | Error page with Finnish copy + "Kirjaudu sisään uudelleen" CTA button | ✓ |
| Error message only | Explains problem, no CTA, user navigates back manually | |

**User's choice:** Try again button, Finnish copy

**Notes:** Page in Finnish for UI consistency. Button re-triggers OAuth with `prompt:consent`.

---

## Warning banner dismiss

| Option | Description | Selected |
|--------|-------------|----------|
| Per-session dismiss | Reappears on every page load until owner's token exists. No storage. | ✓ |
| Persistent dismiss (localStorage) | Stays hidden until next sign-in. Risk: user forgets sync is broken. | |
| Non-dismissible | Always visible until token row exists. | |

**User's choice:** Per-session dismiss (reappears on reload)

**Notes:** Banner includes sign-in link CTA: "Kalenterin omistaja ei ole kirjautunut — kalenterisynkronointi ei toimi." + [Kirjaudu sisään]

---

## Claude's Discretion

- Supabase server/middleware client helper file locations
- `user_google_tokens` table schema details
- `buildGCalClient` refactor internals
- Route paths for callback and error pages
- `requireAuthorizedParent()` refactor to Supabase `getUser()`

## Deferred Ideas

- **Gender-neutral terminology**: replace `father`/`mother` in `ParentId` type and throughout the codebase with neutral terms (configurable or `parent1`/`parent2`) — separate refactor task
