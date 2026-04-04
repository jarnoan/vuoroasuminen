# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-04
**Phase:** 01-foundation
**Areas discussed:** Config model for parents & children, Post-auth landing page, Refresh token strategy timing, Deployment target

---

## Config model for parents & children

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid: env for secrets, config file for structure | `config/app.ts` holds parent names, children, start date, firstParent; `.env.local` holds secrets | ✓ |
| Pure .env.local (flat env vars) | Everything in environment variables — flat structure, awkward for lists | |
| Config file only (no split) | All non-secret config in `config/app.ts`, including calendar IDs and emails | |

**User's choice:** Hybrid approach
**Notes:** Follow-up question on where calendar IDs and emails go — user chose `.env.local` (private) rather than version-controlled config file

### Calendar IDs and parent emails placement

| Option | Description | Selected |
|--------|-------------|----------|
| config/app.ts — version-controlled | Calendar IDs and emails are not true secrets; simpler | |
| .env.local — keep them private | Private alongside OAuth secret; thinner config split | ✓ |

**User's choice:** `.env.local` — keep them private

---

## Post-auth landing page

| Option | Description | Selected |
|--------|-------------|----------|
| Nav shell with placeholders | Real app layout with header chrome + placeholder body | ✓ |
| Minimal 'you're signed in' stub | Just user name + sign-out button, no app chrome | |
| Full app skeleton | Header + sidebar + empty schedule grid structure | |

**User's choice:** Nav shell with placeholders

### Nav shell contents

| Option | Description | Selected |
|--------|-------------|----------|
| Header only: logo + user avatar + sign-out | Minimal chrome, leaves layout freedom for Phase 2 | ✓ |
| Header + nav tabs for future sections | Defines information architecture early but locks structure | |

**User's choice:** Header only

---

## Refresh token strategy timing

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 1: capture token, defer rotation to Phase 4 | Store refresh_token now, implement jwt callback in Phase 4 | |
| Phase 1: implement full rotation now | Auth.js jwt callback with token refresh logic in Phase 1 | ✓ |
| You decide | Leave to planner's discretion | |

**User's choice:** Implement full rotation in Phase 1

---

## Deployment target

| Option | Description | Selected |
|--------|-------------|----------|
| Local dev only — Vercel in Phase 2 or later | Focus Phase 1 on local `next dev` | ✓ |
| Vercel deployment in Phase 1 | Set up Vercel project + preview URL in Phase 1 | |

**User's choice:** Local dev only for Phase 1
