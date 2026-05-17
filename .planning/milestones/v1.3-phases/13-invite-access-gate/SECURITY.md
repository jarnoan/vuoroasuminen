---
phase: 13-invite-access-gate
auditor: gsd-security-auditor
asvs_level: 1
completed: 2026-05-17
result: SECURED
threats_total: 14
threats_closed: 14
threats_open: 0
---

# Security Audit — Phase 13: Invite Access Gate

## Result: SECURED

**Threats Closed:** 14/14
**ASVS Level:** 1
**Open threats:** 0

---

## Threat Verification (disposition: mitigate)

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-13-P01-01 | Spoofing | mitigate | CLOSED | `src/actions/invite.ts:22-28` — `supabase.auth.getUser()` called; returns `{ success: false, error: "Ei kirjautunut" }` when `!user?.email` |
| T-13-P01-02 | Tampering | mitigate | CLOSED | `src/actions/invite.ts:33` — `crypto.randomBytes(32).toString("base64url")` produces 256-bit entropy token |
| T-13-P01-06 | Elevation of Privilege | mitigate | CLOSED | `src/app/auth/callback/route.ts:86-94` — token re-validated against DB with `isNull(inviteTokens.usedAt)` + `gt(inviteTokens.expiresAt, new Date())` before any write |
| T-13-P02-01 | Spoofing | mitigate | CLOSED | `src/actions/invite.ts:22-28` — same `getUser()` auth guard; `generateInviteToken` called from StepComplete inherits the server-side check |
| T-13-P03-01 | Tampering | mitigate | CLOSED | `src/app/auth/callback/route.ts:85-94` — `isNull(inviteTokens.usedAt)` and `gt(inviteTokens.expiresAt, new Date())` in the Drizzle `where` clause; forged/replayed tokens return no row |
| T-13-P03-02 | Elevation of Privilege | mitigate | CLOSED | `src/app/auth/callback/route.ts:96-108` — `family_config.parent2_email` update inside `if (tokenRow)` block; only executes when valid token found |
| T-13-P03-03 | Repudiation | mitigate | CLOSED | `src/app/auth/callback/route.ts:104-108` — `usedAt: new Date(), usedBy: userEmail` stamped on token row; row not deleted |
| T-13-P03-06 | Information Disclosure | mitigate | CLOSED | `src/app/auth/callback/route.ts:112-119` — `response.cookies.set("invite_token", "", { maxAge: 0 })` immediately after redemption; subsequent replay finds `usedAt` stamped, fails `isNull` check |
| T-13-P04-01 | Spoofing | mitigate | CLOSED | `src/proxy.ts:18` — `supabase.auth.getUser()` used (not `getSession()`); D-09 comment present at line 14 |
| T-13-P04-02 | Tampering | mitigate | CLOSED | `src/proxy.ts:8-12` — `response` and `supabase` client both created inside `proxy()` function body; no module-scope client; D-10 comment present at line 9 |
| T-13-P04-03 | Elevation of Privilege | mitigate | CLOSED | `src/proxy.ts:70-91` — `isRecognized` check against `configRow.parent1Email` and `configRow.parent2Email`; unrecognized email triggers `supabase.auth.signOut()` + redirect to `/auth/error?error=unauthorized_email` |

## Accepted Risk Log (disposition: accept)

| Threat ID | Category | Rationale |
|-----------|----------|-----------|
| T-13-P01-03 | Repudiation | `usedAt` stamped on redemption — audit trail preserved; token row not deleted (mitigate evidence at T-13-P03-03) |
| T-13-P01-04 | Information Disclosure | Page returns same error for expired and used tokens — no oracle as to whether token ever existed (`src/app/invite/[token]/page.tsx:36-51`) |
| T-13-P01-05 | Denial of Service | Delete-prior scoped to `createdBy = authenticated user's email`; no cross-user deletion possible (`src/actions/invite.ts:43-48`) |
| T-13-P02-02 | Information Disclosure | Origin built from server-controlled `Host` header (`src/app/dashboard/page.tsx`); not user-supplied |
| T-13-P02-03 | Tampering | `user_google_tokens` row requires completed OAuth; cannot be faked without actual Google sign-in |
| T-13-P02-04 | Denial of Service | Button disabled during in-flight request; two-user app; rate-limiting disproportionate |
| T-13-P03-04 | Denial of Service | `try/catch` at `src/app/auth/callback/route.ts:82-127` ensures redemption errors do not block sign-in |
| T-13-P03-05 | Spoofing | `?error=` param controls only UI copy; no auth decision in `src/app/auth/error/page.tsx` |
| T-13-P04-04 | Elevation of Privilege | `/invite/*` exempt by design; token validated inside route handler (P01) and callback (P03) |
| T-13-P04-05 | Denial of Service | Two-user app; single-row table; ~2-5ms read latency; caching not needed |
| T-13-P04-06 | Denial of Service | DB error allows through (`src/proxy.ts:57-61`); dashboard guard handles missing config; transient errors must not hard-lock |
| T-13-P04-07 | Repudiation | No sign-out log; acceptable for two-user app scope |

## Unregistered Threat Flags

None — no unregistered flags present in SUMMARY.md `## Threat Flags` sections for P01–P04.

## Notes

**signOut ordering fix (proxy.ts):** The implemented code calls `supabase.auth.signOut()` before constructing `errorRedirect`, then copies post-signOut cookies onto the redirect response. This is a correctness improvement over the plan's draft (which copied cookies before and after signOut). The result is equivalent security: session-clearing headers reach the browser on the redirect.

**Transaction added to generateInviteToken (invite.ts):** The implementation wraps the delete-prior + insert in a `db.transaction()` to prevent a race condition on double-click. This is a security improvement over the plan's non-transactional draft. No new threat surface introduced.
