---
phase: 13-invite-access-gate
plan: P03
type: execute
wave: 2
depends_on:
  - P01
files_modified:
  - src/app/auth/callback/route.ts
  - src/app/auth/error/page.tsx
autonomous: true
requirements:
  - ONBR-06

must_haves:
  truths:
    - "When auth/callback receives an invite_token cookie, it validates the token, updates family_config.parent2_email to the actual sign-in email, marks token used, and redirects to /dashboard"
    - "A missing or invalid invite_token cookie causes auth/callback to proceed as normal sign-in (no error)"
    - "The auth/error page shows a Finnish unauthorized_email variant when ?error=unauthorized_email is in the query string"
    - "The unauthorized_email error page has no retry/sign-in button (session is already signed out)"
  artifacts:
    - path: "src/app/auth/callback/route.ts"
      provides: "Invite cookie consumption — validates token, updates parent2_email, marks used_at"
      contains: "invite_token"
    - path: "src/app/auth/error/page.tsx"
      provides: "Auth error page — existing retry variant + new unauthorized_email Finnish variant"
      contains: "unauthorized_email"
  key_links:
    - from: "src/app/auth/callback/route.ts"
      to: "invite_tokens DB table"
      via: "db update inviteTokens set used_at, used_by"
      pattern: "usedAt"
    - from: "src/app/auth/callback/route.ts"
      to: "family_config.parent2_email"
      via: "db update familyConfig set parent2Email = actualSignInEmail"
      pattern: "parent2Email"
    - from: "src/app/auth/error/page.tsx"
      to: "?error=unauthorized_email query param"
      via: "useSearchParams() or searchParams prop"
      pattern: "unauthorized_email"
---

<objective>
Implement invite token consumption in the auth callback and add the unauthorized-email error page variant.

Purpose: When Parent B completes the OAuth flow after visiting /invite/[token] (P01), auth/callback must validate the invite cookie, update parent2_email to Parent B's actual email, and mark the token as used. The unauthorized_email error page is the destination when middleware (P04) rejects an unrecognized user.

Output:
- src/app/auth/callback/route.ts — extended with invite token consumption after user_google_tokens upsert
- src/app/auth/error/page.tsx — extended with Finnish unauthorized_email variant
</objective>

<execution_context>
@/Users/jarno/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jarno/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/jarno/src/vuoroasuminen/.planning/PROJECT.md
@/Users/jarno/src/vuoroasuminen/.planning/phases/13-invite-access-gate/13-CONTEXT.md
@/Users/jarno/src/vuoroasuminen/.planning/phases/13-invite-access-gate/13-UI-SPEC.md
@/Users/jarno/src/vuoroasuminen/.planning/phases/13-invite-access-gate/13-P01-SUMMARY.md

<interfaces>
<!-- Key contracts for P03 executor. -->

Current src/app/auth/callback/route.ts structure (read the file — key insertion point):
- Line 56–71: upserts user_google_tokens row
- Line 71: console.log("[auth/callback] token row upserted for", userEmail)
- Line 73: return response  ← invite cookie consumption goes BETWEEN lines 71 and 73
- The route already has access to: userEmail (signed-in user), request (for cookies), response (for redirect)

From src/db/schema/domain.ts (tables to update):
```typescript
export const inviteTokens = pgTable("invite_tokens", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  createdBy: text("created_by").notNull(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  usedAt: timestamp("used_at", { mode: "date" }),
  usedBy: text("used_by"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
})

export const familyConfig = pgTable("family_config", {
  id: integer("id").primaryKey().default(1),
  parent2Email: text("parent2_email").notNull(),
  // ... other columns
})
```

From src/db/index.ts:
```typescript
export const db = createDb()  // service_role connection (DATABASE_URL)
```

From src/app/auth/error/page.tsx (current):
- "use client" component
- Shows Finnish calendar-scope error with retry button
- Layout: flex min-h-screen items-center justify-center
- div: text-center space-y-6 max-w-md px-6

UI-SPEC Surface 4 (unauthorized_email variant):
- h1 text-xl font-semibold — "Pääsy estetty"
- p text-muted-foreground — "Tämä tili ei kuulu tähän perheeseen."
- p text-sm text-muted-foreground — "Jos sinulla on kutsu, kirjaudu sillä Google-tilillä, jolla kutsu on luotu."
- NO sign-in/retry button (session is already signed out by middleware)
- Detection: ?error=unauthorized_email query param
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Consume invite cookie in auth/callback</name>
  <files>src/app/auth/callback/route.ts</files>
  <read_first>
    - src/app/auth/callback/route.ts — full current file (understand where to insert)
    - src/db/schema/domain.ts — inviteTokens and familyConfig table definitions
    - src/db/index.ts — db export
  </read_first>
  <action>
Extend src/app/auth/callback/route.ts to consume the invite_token cookie after the user_google_tokens upsert (after line 71, before `return response`).

**Add these imports at the top:**
```typescript
import { db } from "@/db"
import { inviteTokens, familyConfig } from "@/db/schema/domain"
import { eq, and, gt, isNull } from "drizzle-orm"
```

**After the existing user_google_tokens upsert block (after the log on line 71), insert:**

```typescript
// D-07 / D-09: Consume invite token if present in cookie
const inviteTokenValue = request.cookies.get("invite_token")?.value

if (inviteTokenValue) {
  console.log("[auth/callback] invite_token cookie present — attempting redemption")

  try {
    // Validate: token must exist, be unused, and not expired
    const [tokenRow] = await db
      .select()
      .from(inviteTokens)
      .where(
        and(
          eq(inviteTokens.token, inviteTokenValue),
          isNull(inviteTokens.usedAt),
          gt(inviteTokens.expiresAt, new Date()),
        ),
      )
      .limit(1)

    if (tokenRow) {
      // D-09: Update family_config.parent2_email to the actual sign-in email.
      // Parent B may use any Google account — the invite is the authorization.
      await db
        .update(familyConfig)
        .set({ parent2Email: userEmail, updatedAt: new Date() })
        .where(eq(familyConfig.id, 1))

      // D-08: Stamp used_at (do NOT delete — preserves audit trail)
      await db
        .update(inviteTokens)
        .set({ usedAt: new Date(), usedBy: userEmail })
        .where(eq(inviteTokens.id, tokenRow.id))

      console.log("[auth/callback] invite token redeemed by", userEmail)

      // Clear the invite_token cookie — it is now consumed
      response.cookies.set("invite_token", "", {
        maxAge: 0,
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "lax",
      })
    } else {
      // Token invalid/expired/used — log and continue as normal sign-in
      console.log("[auth/callback] invite_token invalid or already used — proceeding without redemption")
    }
  } catch (err) {
    // Redemption failure must not block sign-in — Parent B would be locked out
    console.error("[auth/callback] invite token redemption error:", err)
  }
}
```

**Critical order note:** This block runs AFTER the user_google_tokens upsert succeeds (line 71). If the upsert failed, the function already returned early. The invite consumption is best-effort — errors are caught and logged without blocking the sign-in redirect.

The existing `return response` at the end (redirect to /dashboard per D-10) is unchanged. Parent B lands on /dashboard after token redemption.

**familyConfig.updatedAt** — the familyConfig table has an `updatedAt` column; include it in the update set to keep the row accurate.
  </action>
  <verify>
    <automated>cd /Users/jarno/src/vuoroasuminen && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <acceptance_criteria>
    - src/app/auth/callback/route.ts imports `db` from "@/db"
    - File imports `inviteTokens, familyConfig` from "@/db/schema/domain"
    - File contains `invite_token` cookie read: `request.cookies.get("invite_token")`
    - File contains `isNull(inviteTokens.usedAt)` in the token validation query
    - File contains `gt(inviteTokens.expiresAt, new Date())` in the token validation query
    - File contains `parent2Email: userEmail` in the familyConfig update
    - File contains `usedAt: new Date()` in the inviteTokens update (D-08 audit stamp)
    - Invite consumption block is wrapped in try/catch (non-blocking on error)
    - File contains cookie-clear: `maxAge: 0` for invite_token after redemption
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>auth/callback validates invite cookie, updates parent2_email to actual sign-in email, stamps used_at, clears cookie; errors are caught and non-blocking; redirect to /dashboard unchanged</done>
</task>

<task type="auto">
  <name>Task 2: Add unauthorized_email variant to auth/error page</name>
  <files>src/app/auth/error/page.tsx</files>
  <read_first>
    - src/app/auth/error/page.tsx — current file (existing layout, retry button, Finnish copy)
    - .planning/phases/13-invite-access-gate/13-UI-SPEC.md §Surface 4
  </read_first>
  <action>
Extend src/app/auth/error/page.tsx to support the `?error=unauthorized_email` variant (D-11, D-12).

The current page is a "use client" component. Add `useSearchParams()` to detect the error variant.

**New file structure:**

```typescript
"use client"

import { createBrowserClient } from "@supabase/ssr"
import { Button } from "@/components/ui/button"
import { useSearchParams } from "next/navigation"

export default function AuthErrorPage() {
  const searchParams = useSearchParams()
  const errorType = searchParams.get("error")

  // D-12: Unauthorized email variant — shown when middleware detected a signed-in
  // user whose email does not match either parent in family_config.
  // No retry button — session is already signed out by middleware (P04).
  if (errorType === "unauthorized_email") {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-6 max-w-md px-6">
          <h1 className="text-xl font-semibold">Pääsy estetty</h1>
          <p className="text-muted-foreground">
            Tämä tili ei kuulu tähän perheeseen.
          </p>
          <p className="text-sm text-muted-foreground">
            Jos sinulla on kutsu, kirjaudu sillä Google-tilillä, jolla kutsu on
            luotu.
          </p>
        </div>
      </main>
    )
  }

  // Default variant: calendar-scope error (existing behavior — preserved unchanged)
  async function handleRetry() {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: [
          "openid",
          "https://www.googleapis.com/auth/userinfo.email",
          "https://www.googleapis.com/auth/userinfo.profile",
          "https://www.googleapis.com/auth/calendar",
        ].join(" "),
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    })
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-6 max-w-md px-6">
        <p className="text-muted-foreground">
          Tarvitsemme pääsyn kalenteriin. Kirjaudu sisään uudelleen ja myönnä
          tarvittavat oikeudet.
        </p>
        <Button size="lg" onClick={handleRetry}>
          Kirjaudu sisään uudelleen
        </Button>
      </div>
    </main>
  )
}
```

**Note:** `useSearchParams()` requires Suspense boundary in Next.js App Router. If the build complains about missing Suspense boundary, wrap the page export in a Suspense fallback. The standard pattern is to split into a default export with Suspense wrapping the actual content component:

```typescript
import { Suspense } from "react"

function AuthErrorContent() {
  const searchParams = useSearchParams()
  // ... all the logic
}

export default function AuthErrorPage() {
  return (
    <Suspense>
      <AuthErrorContent />
    </Suspense>
  )
}
```

Apply this Suspense wrapping if Next.js requires it (it will show a build warning if not done).
  </action>
  <verify>
    <automated>cd /Users/jarno/src/vuoroasuminen && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <acceptance_criteria>
    - src/app/auth/error/page.tsx imports `useSearchParams` from "next/navigation"
    - File contains `searchParams.get("error")`
    - File contains `errorType === "unauthorized_email"` conditional
    - File contains `Pääsy estetty` heading (unauthorized_email variant)
    - File contains `Tämä tili ei kuulu tähän perheeseen.` (D-12 Finnish message)
    - File contains `Jos sinulla on kutsu` secondary text
    - The unauthorized_email variant does NOT contain a Button with onClick (no retry)
    - The existing retry button (handleRetry / "Kirjaudu sisään uudelleen") is still present for the default variant
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>auth/error page shows Finnish "Pääsy estetty" variant for ?error=unauthorized_email with no retry button; existing calendar-scope error with retry button preserved</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Cookie → auth/callback | invite_token value arrives from browser cookie; must be validated against DB before acting |
| Query param → auth/error | ?error= param from middleware redirect; only controls UI variant, no authorization |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-13-P03-01 | Tampering | invite_token cookie in auth/callback | mitigate | Server validates token against DB with isNull(usedAt) + gt(expiresAt) — forged/replayed tokens fail validation and are silently ignored |
| T-13-P03-02 | Elevation of Privilege | family_config.parent2_email update | mitigate | Update only executes when a valid (unused, non-expired) token is found; token must have been created by an authenticated parent (createdBy set in generateInviteToken) |
| T-13-P03-03 | Repudiation | used_at / used_by stamp | mitigate | D-08: audit stamp preserved; token row not deleted — redemption event is permanently recorded with timestamp and user email |
| T-13-P03-04 | Denial of Service | invite redemption try/catch | accept | try/catch ensures DB errors during redemption do NOT block sign-in; Parent B can still access the app if redemption fails (middleware P04 handles further access control) |
| T-13-P03-05 | Spoofing | ?error=unauthorized_email param | accept | Parameter only controls UI copy variant — no authorization decision made in auth/error page; session is already invalidated by middleware before redirect |
| T-13-P03-06 | Information Disclosure | cookie replay after use | mitigate | Cookie cleared (maxAge=0) immediately after redemption; subsequent use of the same cookie value finds usedAt stamped → fails isNull check → no second redemption |
</threat_model>

<verification>
After both tasks complete:

1. `npx tsc --noEmit` — zero TypeScript errors
2. Sign-in flow WITHOUT invite cookie: auth/callback proceeds normally to /dashboard — no error
3. Sign-in flow WITH valid invite_token cookie: family_config.parent2_email updated in DB to actual sign-in email; invite_tokens.used_at stamped; redirect to /dashboard
4. Sign-in flow WITH expired/used invite_token cookie: callback logs "invalid or already used" and continues to /dashboard without DB updates
5. Visit `/auth/error?error=unauthorized_email` — shows "Pääsy estetty" with no sign-in button
6. Visit `/auth/error` (no query param) — shows existing Finnish calendar-scope error with retry button
</verification>

<success_criteria>
- Invite cookie consumed in auth/callback: parent2_email updated, token marked used, cookie cleared
- Invite validation is non-blocking — errors caught and logged, sign-in not interrupted
- auth/error shows correct Finnish variant for unauthorized_email (no retry button)
- auth/error shows existing retry variant for calendar-scope errors (retry button preserved)
- TypeScript compiles clean
</success_criteria>

<output>
After completion, create .planning/phases/13-invite-access-gate/13-P03-SUMMARY.md
</output>
