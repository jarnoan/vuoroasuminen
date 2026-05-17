---
phase: 13
slug: invite-access-gate
status: verified
threats_open: 0
asvs_level: 1
created: 2026-05-17
---

# Phase 13 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Public internet → /invite/[token] | Unauthenticated users can hit this route with arbitrary token values | invite token (URL-safe string) |
| Browser → /auth/callback | Cookie values arrive from client; invite_token must be validated server-side | invite_token cookie |
| Browser clipboard API | navigator.clipboard.writeText — sandboxed, no server trust boundary crossed | invite URL (non-sensitive) |
| Server Action → DB | generateInviteToken called from browser via Server Action RPC | invite token, user email |
| Cookie → auth/callback | invite_token value arrives from browser cookie; validated against DB before acting | invite_token cookie |
| Query param → auth/error | ?error= param from middleware redirect; only controls UI variant, no authorization | error type string |
| Browser → all protected routes | Every request passes through proxy(); JWT validated server-side | JWT, user email |
| Middleware → DB | family_config read uses service_role Drizzle (bypasses RLS — intentional, middleware has no user context) | family_config row |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-13-P01-01 | Spoofing | generateInviteToken | mitigate | `src/actions/invite.ts:22-28` — `supabase.auth.getUser()` called before token generation; unauthenticated callers return "Ei kirjautunut" | closed |
| T-13-P01-02 | Tampering | invite_tokens table | mitigate | `src/actions/invite.ts:33` — `crypto.randomBytes(32).toString("base64url")` — 256-bit entropy | closed |
| T-13-P01-03 | Repudiation | invite_tokens.used_at | accept | used_at stamped on redemption — audit trail preserved; token row not deleted | closed |
| T-13-P01-04 | Information Disclosure | /invite/[token] page | accept | Same error returned for expired and used tokens — no oracle about token existence | closed |
| T-13-P01-05 | Denial of Service | generateInviteToken delete-prior | accept | Only creator's own tokens deleted (createdBy = authenticated user's email); no cross-user deletion | closed |
| T-13-P01-06 | Elevation of Privilege | invite cookie | mitigate | `src/app/auth/callback/route.ts:86-94` — token re-validated with `isNull(usedAt)` + `gt(expiresAt, new Date())`; possession alone does not grant access | closed |
| T-13-P02-01 | Spoofing | generateInviteToken (StepComplete) | mitigate | Same `generateInviteToken` at `src/actions/invite.ts:22-28` — `getUser()` auth guard applies regardless of call site | closed |
| T-13-P02-02 | Information Disclosure | InviteSection origin construction | accept | Origin derived from Host header (server-controlled in production via Vercel); not user-supplied | closed |
| T-13-P02-03 | Tampering | Dashboard parent2 join detection | accept | service_role db connection; attacker cannot fake a user_google_tokens row without completing actual OAuth | closed |
| T-13-P02-04 | Denial of Service | Repeated regenerate clicks | accept | Button disabled during in-flight request; two-user app — rate-limiting disproportionate | closed |
| T-13-P03-01 | Tampering | invite_token cookie in auth/callback | mitigate | `src/app/auth/callback/route.ts:85-94` — `isNull` + `gt` Drizzle operators; forged/replayed tokens find no matching row | closed |
| T-13-P03-02 | Elevation of Privilege | family_config.parent2_email update | mitigate | `src/app/auth/callback/route.ts:96-108` — update gated inside `if (tokenRow)` block; only executes when valid (unused, non-expired) token found | closed |
| T-13-P03-03 | Repudiation | used_at / used_by stamp | mitigate | `src/app/auth/callback/route.ts:104-108` — `usedAt: new Date(), usedBy: userEmail` stamped; row not deleted | closed |
| T-13-P03-04 | Denial of Service | invite redemption try/catch | accept | try/catch ensures DB errors during redemption do not block sign-in; Parent B can still access the app | closed |
| T-13-P03-05 | Spoofing | ?error=unauthorized_email param | accept | Parameter only controls UI copy variant — no authorization decision made; session already invalidated by middleware before redirect | closed |
| T-13-P03-06 | Information Disclosure | cookie replay after use | mitigate | `src/app/auth/callback/route.ts:112-119` — `maxAge: 0` clears cookie after redemption; replay finds usedAt stamped → fails isNull check | closed |
| T-13-P04-01 | Spoofing | JWT validation in middleware | mitigate | `src/proxy.ts:18` — `supabase.auth.getUser()` (not `getSession()`); validates JWT against Supabase server — cannot be bypassed with crafted cookie | closed |
| T-13-P04-02 | Tampering | Module-scope Supabase client | mitigate | `src/proxy.ts:8-12` — client created inside `proxy()` body; no module-scope client; prevents warm-instance session leakage | closed |
| T-13-P04-03 | Elevation of Privilege | Unrecognized email access | mitigate | `src/proxy.ts:70-91` — three-tier check against parent1Email/parent2Email in DB; unrecognized email triggers signOut() + redirect to /auth/error?error=unauthorized_email | closed |
| T-13-P04-04 | Elevation of Privilege | /invite/* bypass | accept | Invite routes intentionally exempt so Parent B can reach invite page unauthenticated; token validated inside route (P01) and again in auth/callback (P03) | closed |
| T-13-P04-05 | Denial of Service | DB read on every request | accept | Two-user app; family_config is single-row; read latency ~2-5ms on Supabase; no caching needed | closed |
| T-13-P04-06 | Denial of Service | DB error allows through | accept | Transient DB errors allow request through rather than hard-locking; dashboard's own guard handles missing config | closed |
| T-13-P04-07 | Repudiation | Middleware sign-out | accept | No persistent log of middleware-triggered sign-outs; acceptable for two-user app | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Implementation Notes (security-positive deviations from plan)

Two implementation details exceed the plan's spec without introducing new attack surface:

1. **Transaction on token generation** — `generateInviteToken` wraps delete-prior + insert in `db.transaction()` (`src/actions/invite.ts:42-54`). Plan specified non-transactional sequential writes. Transaction prevents double-click race that could create two outstanding tokens, violating the one-token-per-creator invariant.

2. **signOut before cookie copy in proxy.ts** — `proxy.ts` calls `supabase.auth.signOut()` before constructing `errorRedirect`, then copies post-signOut cookies once. Plan's draft copied cookies before and after signOut. Implemented order ensures only cleared session cookies reach the browser.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-13-01 | T-13-P01-03 | used_at stamped on redemption — sufficient audit trail for a two-user app | jarno.antikainen@iki.fi | 2026-05-17 |
| AR-13-02 | T-13-P01-04 | Same error for expired/used tokens eliminates oracle; acceptable UX tradeoff | jarno.antikainen@iki.fi | 2026-05-17 |
| AR-13-03 | T-13-P01-05 | Only creator's own tokens deleted; two-user app — cross-user DoS not possible | jarno.antikainen@iki.fi | 2026-05-17 |
| AR-13-04 | T-13-P02-02 | Host header is server-controlled in production (Vercel); not user-injectable | jarno.antikainen@iki.fi | 2026-05-17 |
| AR-13-05 | T-13-P02-03 | Attacker cannot create user_google_tokens row without completing real Google OAuth | jarno.antikainen@iki.fi | 2026-05-17 |
| AR-13-06 | T-13-P02-04 | Button disabled during in-flight; two-user app makes rate-limiting disproportionate | jarno.antikainen@iki.fi | 2026-05-17 |
| AR-13-07 | T-13-P03-04 | Redemption failure should not block Parent B's sign-in; middleware (P04) provides further access control | jarno.antikainen@iki.fi | 2026-05-17 |
| AR-13-08 | T-13-P03-05 | ?error= controls UI copy only; session already invalidated before redirect; no auth consequence | jarno.antikainen@iki.fi | 2026-05-17 |
| AR-13-09 | T-13-P04-04 | /invite/* exempt intentionally; double validation in P01 route + P03 callback mitigates elevated risk | jarno.antikainen@iki.fi | 2026-05-17 |
| AR-13-10 | T-13-P04-05 | Single-row table read at ~2-5ms; caching adds complexity not justified at two-user scale | jarno.antikainen@iki.fi | 2026-05-17 |
| AR-13-11 | T-13-P04-06 | Hard-locking on transient DB error is worse than allowing through; dashboard guard handles config absence | jarno.antikainen@iki.fi | 2026-05-17 |
| AR-13-12 | T-13-P04-07 | Sign-out log overhead not justified for two-user app; Supabase session invalidation is sufficient | jarno.antikainen@iki.fi | 2026-05-17 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-17 | 23 | 23 | 0 | gsd-security-auditor (claude-sonnet-4-6) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-17
