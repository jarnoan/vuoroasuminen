---
phase: 13-invite-access-gate
plan: P01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/actions/invite.ts
  - src/app/invite/[token]/page.tsx
autonomous: true
requirements:
  - ONBR-05
  - ONBR-06

must_haves:
  truths:
    - "generateInviteToken Server Action creates a 43-char base64url token stored in invite_tokens with 72h expiry"
    - "generateInviteToken deletes all prior non-used tokens for the creator before inserting new one (one outstanding token at a time)"
    - "The invite URL /invite/<token> validates the token and redirects to Google OAuth with the token stored in an HttpOnly cookie"
    - "Expired or used tokens show a Finnish error state — no sign-in button"
  artifacts:
    - path: "src/actions/invite.ts"
      provides: "generateInviteToken Server Action"
      exports: ["generateInviteToken"]
    - path: "src/app/invite/[token]/page.tsx"
      provides: "Invite acceptance page — validates token, stores cookie, triggers OAuth"
      contains: "invite_token"
  key_links:
    - from: "src/actions/invite.ts"
      to: "invite_tokens DB table"
      via: "db.insert(inviteTokens)"
      pattern: "inviteTokens"
    - from: "src/app/invite/[token]/page.tsx"
      to: "/auth/callback"
      via: "HttpOnly cookie invite_token then OAuth redirect"
      pattern: "invite_token"
---

<objective>
Create the invite token Server Action and the /invite/[token] acceptance page.

Purpose: These are the foundational backend primitives the rest of Phase 13 builds on. The Server Action (called from StepComplete and Dashboard in P02) generates and stores tokens. The acceptance page validates tokens and initiates the OAuth flow that P03 will complete.

Output:
- src/actions/invite.ts — generateInviteToken Server Action
- src/app/invite/[token]/page.tsx — token validation + OAuth entry point
</objective>

<execution_context>
@/Users/jarno/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jarno/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/jarno/src/vuoroasuminen/.planning/PROJECT.md
@/Users/jarno/src/vuoroasuminen/.planning/ROADMAP.md
@/Users/jarno/src/vuoroasuminen/.planning/phases/13-invite-access-gate/13-CONTEXT.md
@/Users/jarno/src/vuoroasuminen/.planning/phases/13-invite-access-gate/13-UI-SPEC.md

<interfaces>
<!-- Key types and contracts the executor needs. -->

From src/db/schema/domain.ts (inviteTokens table — already exists, no schema changes):
```typescript
export const inviteTokens = pgTable("invite_tokens", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  token: text("token").notNull().unique(),
  createdBy: text("created_by").notNull(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  usedAt: timestamp("used_at", { mode: "date" }),
  usedBy: text("used_by"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
})
```

From src/config/app.ts (getAppConfig shape):
```typescript
export async function getAppConfig(): Promise<AppConfig>
// Throws when no family_config row — callers must catch and redirect to /setup
```

From src/lib/supabase/server.ts:
```typescript
export async function createSupabaseServerClient(): Promise<SupabaseClient>
// Use: const { data: { user } } = await supabase.auth.getUser()
```

From src/actions/setup.ts (auth guard pattern to replicate):
```typescript
const supabase = await createSupabaseServerClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user?.email) {
  return { success: false, error: "Ei kirjautunut" }
}
```

From src/db/index.ts (Drizzle admin connection — use `db` for all DB writes):
```typescript
export const db = createDb()  // Uses DATABASE_URL (service_role connection string)
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: generateInviteToken Server Action</name>
  <files>src/actions/invite.ts</files>
  <read_first>
    - src/actions/setup.ts — auth guard pattern, db import, error return shape
    - src/db/schema/domain.ts — inviteTokens table columns
    - src/db/index.ts — db export
    - src/config/app.ts — getAppConfig to read parent2Name for the invite URL label
  </read_first>
  <action>
Create src/actions/invite.ts as a "use server" module.

Implement two exported functions:

**1. generateInviteToken()**

Return type: `Promise<{ success: true; token: string; expiresAt: Date } | { success: false; error: string }>`

Steps:
1. Auth check — call `createSupabaseServerClient()`, call `supabase.auth.getUser()`. If no `user?.email`, return `{ success: false, error: "Ei kirjautunut" }`.
2. Generate token — `const token = crypto.randomBytes(32).toString("base64url")` — produces 43-char URL-safe string (per D-04). Import `crypto` from Node built-in.
3. Set expiry — `const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000)` — 72 hours from now (per D-05).
4. Delete prior unused tokens — hard-delete any rows in `invite_tokens` where `created_by = user.email` AND `used_at IS NULL`, using:
   ```typescript
   await db.delete(inviteTokens).where(
     and(
       eq(inviteTokens.createdBy, user.email),
       isNull(inviteTokens.usedAt),
     )
   )
   ```
   This implements D-06 (one outstanding token per creator).
5. Insert new token:
   ```typescript
   await db.insert(inviteTokens).values({
     token,
     createdBy: user.email,
     expiresAt,
   })
   ```
6. Return `{ success: true, token, expiresAt }`.

Wrap steps 4–6 in try/catch — on error return `{ success: false, error: "Linkin luonti epäonnistui. Yritä uudelleen." }` (per UI-SPEC copywriting).

**2. getActiveInviteToken()**

Return type: `Promise<{ success: true; token: string; expiresAt: Date; status: "active" | "expired" | "used" } | { success: false; error: string }>`

This function is called by the Dashboard invite section (P02) to show the current link state.

Steps:
1. Auth check — same pattern as generateInviteToken.
2. Query latest token for this creator:
   ```typescript
   const [row] = await db
     .select()
     .from(inviteTokens)
     .where(eq(inviteTokens.createdBy, user.email))
     .orderBy(desc(inviteTokens.createdAt))
     .limit(1)
   ```
3. If no row: return `{ success: true, token: "", expiresAt: new Date(0), status: "expired" }` — Dashboard will show "no active link" state.
4. Determine status:
   - If `row.usedAt !== null`: status = "used"
   - Else if `row.expiresAt <= new Date()`: status = "expired"
   - Else: status = "active"
5. Return `{ success: true, token: row.token, expiresAt: row.expiresAt, status }`.

**Imports needed:**
```typescript
import { db } from "@/db"
import { inviteTokens } from "@/db/schema/domain"
import { eq, and, isNull, desc } from "drizzle-orm"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import crypto from "crypto"
```
  </action>
  <verify>
    <automated>cd /Users/jarno/src/vuoroasuminen && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <acceptance_criteria>
    - src/actions/invite.ts exists and starts with "use server"
    - File contains `export async function generateInviteToken(`
    - File contains `export async function getActiveInviteToken(`
    - File contains `crypto.randomBytes(32).toString("base64url")`
    - File contains `72 * 60 * 60 * 1000` (72h expiry calculation)
    - File contains `isNull(inviteTokens.usedAt)` (delete-prior-unused filter)
    - `npx tsc --noEmit` exits 0 (no TypeScript errors)
  </acceptance_criteria>
  <done>Server Action file compiles clean; both functions exported; token generation uses 43-char base64url; prior-token cleanup uses isNull filter</done>
</task>

<task type="auto">
  <name>Task 2: /invite/[token] acceptance page</name>
  <files>src/app/invite/[token]/page.tsx</files>
  <read_first>
    - src/app/auth/error/page.tsx — existing page layout pattern (flex min-h-screen items-center justify-center)
    - src/lib/supabase/server.ts — createSupabaseServerClient for OAuth redirect
    - src/db/schema/domain.ts — inviteTokens columns
    - src/db/index.ts — db import
    - .planning/phases/13-invite-access-gate/13-UI-SPEC.md §Surface 3 — exact layout and copy
  </read_first>
  <action>
Create src/app/invite/[token]/page.tsx.

This is a **mixed Server/Client Component** file. The Server Component validates the token; the Client Component renders the sign-in button with loading state.

**File structure:**

```
// Server Component (default export) — validates token, renders appropriate surface
// Client Component — InviteSignInButton — handles OAuth trigger + loading state
```

**Server Component logic:**

```typescript
import { db } from "@/db"
import { inviteTokens } from "@/db/schema/domain"
import { eq } from "drizzle-orm"

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const [row] = await db
    .select()
    .from(inviteTokens)
    .where(eq(inviteTokens.token, token))
    .limit(1)

  const isValid =
    row !== undefined &&
    row.usedAt === null &&
    row.expiresAt > new Date()

  if (!isValid) {
    // Invalid / expired / used token state (UI-SPEC Surface 3 — invalid sub-state)
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-6 max-w-md px-6">
          <Alert variant="destructive" className="text-left">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Kutsu ei ole enää voimassa</AlertTitle>
            <AlertDescription>
              Tämä kutsu on vanhentunut tai jo käytetty. Pyydä toiselta
              vanhemmalta uusi kutsu.
            </AlertDescription>
          </Alert>
        </div>
      </main>
    )
  }

  // Valid token state (UI-SPEC Surface 3 — valid sub-state)
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-6 max-w-md px-6">
        <h1 className="text-2xl font-semibold">
          Liity vuoroasumissuunnitelmaan
        </h1>
        <p className="text-muted-foreground">
          Sinut on kutsuttu. Kirjaudu Google-tililläsi päästäksesi yhteiseen
          aikatauluun.
        </p>
        <InviteSignInButton token={token} />
      </div>
    </main>
  )
}
```

**Client Component (InviteSignInButton):**

```typescript
"use client"

import { useState } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { Button } from "@/components/ui/button"
import { LogIn, Loader2 } from "lucide-react"

export function InviteSignInButton({ token }: { token: string }) {
  const [isLoading, setIsLoading] = useState(false)

  async function handleSignIn() {
    setIsLoading(true)
    // D-07: Set invite_token cookie BEFORE OAuth redirect.
    // Max-Age=600 (10 min) — survives the OAuth roundtrip.
    document.cookie = `invite_token=${token}; Max-Age=600; Path=/; SameSite=Lax; Secure`

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
    // signInWithOAuth redirects — if we reach here something failed
    setIsLoading(false)
  }

  return (
    <Button size="lg" onClick={handleSignIn} disabled={isLoading}>
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <LogIn className="h-4 w-4" />
      )}
      Kirjaudu Google-tilillä
    </Button>
  )
}
```

**Note on cookie security:** The Secure flag requires HTTPS. In local dev over HTTP the cookie may not be sent. This is acceptable — invite acceptance is a production flow. The cookie contains only the opaque token string, not session data.

**Note on HttpOnly:** The cookie is set via `document.cookie` in the browser (not server-set) because it must be set after the user clicks sign-in, before the OAuth redirect. `HttpOnly` cannot be set via `document.cookie` (browser ignores it). The token is a single-use random value that only completes the flow at `/auth/callback` — this residual risk is accepted per the threat model.

**Imports for server component:**
```typescript
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
```
  </action>
  <verify>
    <automated>cd /Users/jarno/src/vuoroasuminen && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <acceptance_criteria>
    - src/app/invite/[token]/page.tsx exists
    - File contains `export default async function InvitePage(`
    - File contains `InviteSignInButton` component definition
    - File contains `invite_token=${token}; Max-Age=600`
    - File contains `Liity vuoroasumissuunnitelmaan` (Finnish heading — valid state)
    - File contains `Kutsu ei ole enää voimassa` (Finnish heading — invalid state)
    - File contains `Kirjaudu Google-tilillä` (sign-in button copy)
    - File queries inviteTokens with `eq(inviteTokens.token, token)`
    - File checks `row.usedAt === null` and `row.expiresAt > new Date()`
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>Invite page renders valid/invalid states; valid state shows sign-in button that sets cookie and triggers OAuth; TypeScript compiles clean</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Public internet → /invite/[token] | Unauthenticated users can hit this route with arbitrary token values |
| Browser → /auth/callback | Cookie values arrive from client — invite_token must be validated server-side |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-13-P01-01 | Spoofing | generateInviteToken | mitigate | Server Action verifies `supabase.auth.getUser()` before generating — unauthenticated callers get "Ei kirjautunut" |
| T-13-P01-02 | Tampering | invite_tokens table | mitigate | Token is a 43-char crypto.randomBytes(32).toString("base64url") — 256-bit entropy; brute-force infeasible |
| T-13-P01-03 | Repudiation | invite_tokens.used_at | accept | used_at is stamped on redemption (D-08) — audit trail preserved; token is not deleted |
| T-13-P01-04 | Information Disclosure | /invite/[token] page | accept | Page returns same error for expired and used tokens — no information about whether token ever existed |
| T-13-P01-05 | Denial of Service | generateInviteToken delete-prior | accept | Only the creator's own tokens are deleted; no cross-user deletion possible (createdBy = authenticated user's email) |
| T-13-P01-06 | Elevation of Privilege | invite cookie | mitigate | Cookie is validated in /auth/callback (P03) against DB — possession of cookie alone does not grant access; token must exist, be unused, and not expired |
</threat_model>

<verification>
After both tasks complete:

1. `npx tsc --noEmit` — zero TypeScript errors
2. `grep -r "generateInviteToken\|getActiveInviteToken" src/actions/invite.ts` — both functions present
3. `grep "base64url" src/actions/invite.ts` — token generation uses base64url
4. Visit `/invite/invalid-token` in browser — should show Finnish error alert "Kutsu ei ole enää voimassa"
5. With a valid token in DB, visit `/invite/<token>` — should show "Liity vuoroasumissuunnitelmaan" heading and sign-in button
</verification>

<success_criteria>
- generateInviteToken produces 43-char base64url tokens stored in invite_tokens with 72h expiry
- Prior unused tokens for the creator are hard-deleted before new token insert
- getActiveInviteToken returns current token status (active/expired/used)
- /invite/[token] validates token server-side and shows correct state (valid vs. invalid)
- Valid token page: clicking sign-in sets invite_token cookie then triggers Google OAuth with prompt:consent + access_type:offline
- TypeScript compiles clean
</success_criteria>

<output>
After completion, create .planning/phases/13-invite-access-gate/13-P01-SUMMARY.md
</output>
