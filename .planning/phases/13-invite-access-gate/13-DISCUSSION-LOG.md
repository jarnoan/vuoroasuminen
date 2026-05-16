# Phase 13: Invite + Access Gate - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-17
**Phase:** 13-invite-access-gate
**Areas discussed:** Invite UI entry point, Middleware gate scope, Invite regeneration, Parent B landing experience

---

## Invite UI Entry Point

| Option | Description | Selected |
|--------|-------------|----------|
| Wizard setup-complete step only | Phase 12 StepComplete gets copy-to-clipboard invite URL. No dashboard UI. | |
| Dashboard section only | New card in dashboard. Parent A can come back any time. Nothing in wizard. | |
| Both — wizard step + dashboard | Show in wizard on completion, also persistent section in dashboard. | ✓ |

**User's choice:** Both — wizard step + dashboard "until parent b signs up"
**Notes:** Dashboard invite section disappears once Parent B has joined (hide when `user_google_tokens` row exists for `parent2_email`). Wizard setup-complete step shows the link initially; dashboard is the regeneration entry point.

---

## Middleware Gate Scope

### Unrecognised email (sub-question)

| Option | Description | Selected |
|--------|-------------|----------|
| Show error page | /auth/error with Finnish message + sign out session | ✓ |
| Redirect to home silently | Back to /. No explanation. | |

**User's clarification:** Initially asked about "unrecognised email" — user clarified that via invite link, Parent B may use ANY Google account (not just the one Parent A entered). `/auth/callback` should update `family_config.parent2_email` to the actual sign-in email. "Unrecognised email" scenario only applies to direct sign-ins (no invite cookie) where email matches neither parent.

### Route coverage

| Option | Description | Selected |
|--------|-------------|----------|
| All app routes except /setup, /auth/*, /invite/* | Full middleware gate | ✓ |
| Dashboard only | Only /dashboard opts in | |

---

## Invite Regeneration

| Option | Description | Selected |
|--------|-------------|----------|
| Dashboard invite section only | Shows status (active/expired/used) + Generate new link button | ✓ |
| Both wizard setup-complete and dashboard | Both locations have regenerate button | |

**Notes:** Wizard setup-complete shows initial link only. Regeneration is dashboard-only to keep wizard simple.

### Post-join dashboard state

| Option | Description | Selected |
|--------|-------------|----------|
| Hidden entirely once Parent B matched | Section disappears | ✓ |
| Show "Parent B has joined" confirmation, then hide | Brief success state | |

---

## Parent B Landing Experience

| Option | Description | Selected |
|--------|-------------|----------|
| Straight to /dashboard | Token marked used, redirect to dashboard | ✓ |
| Welcome screen first, then dashboard | Brief welcome page before dashboard | |

---

## Claude's Discretion

- Exact Finnish copy for invite section and error page
- Whether dashboard invite section is separate Server Component or inline
- shadcn/ui component choice for copy-to-clipboard

## Deferred Ideas

- Parent B calendar ID picker during invite acceptance
- Welcome screen for Parent B
- Edit family config post-onboarding
- Parent A notification when Parent B joins
