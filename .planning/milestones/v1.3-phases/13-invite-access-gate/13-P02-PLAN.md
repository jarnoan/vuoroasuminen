---
phase: 13-invite-access-gate
plan: P02
type: execute
wave: 2
depends_on:
  - P01
files_modified:
  - src/app/setup/steps/step-complete.tsx
  - src/components/invite/invite-section.tsx
  - src/app/dashboard/page.tsx
autonomous: true
requirements:
  - ONBR-05

must_haves:
  truths:
    - "StepComplete step shows the generated invite URL with copy-to-clipboard button — no placeholder alert"
    - "Copy button shows Check icon for 2 seconds then reverts to Copy icon; no toast"
    - "Dashboard invite section shows the current invite link with status line and regenerate button"
    - "Dashboard invite section is hidden when Parent B has joined (user_google_tokens row for parent2_email exists)"
    - "Invite URL displayed is https://<origin>/invite/<token>"
  artifacts:
    - path: "src/app/setup/steps/step-complete.tsx"
      provides: "Updated StepComplete — fetches invite token and shows copy-to-clipboard URL"
    - path: "src/components/invite/invite-section.tsx"
      provides: "InviteSection Server Component — dashboard invite card with copy + regenerate"
    - path: "src/app/dashboard/page.tsx"
      provides: "Dashboard page — conditionally renders InviteSection when Parent B not yet joined"
  key_links:
    - from: "src/app/setup/steps/step-complete.tsx"
      to: "src/actions/invite.ts"
      via: "generateInviteToken() call on mount"
      pattern: "generateInviteToken"
    - from: "src/components/invite/invite-section.tsx"
      to: "src/actions/invite.ts"
      via: "getActiveInviteToken() + generateInviteToken() calls"
      pattern: "getActiveInviteToken|generateInviteToken"
    - from: "src/app/dashboard/page.tsx"
      to: "user_google_tokens table"
      via: "select for parent2_email to determine if Parent B joined"
      pattern: "parent2Email"
---

<objective>
Update the StepComplete wizard step and Dashboard to display invite links using the Server Action from P01.

Purpose: Parent A needs two entry points to get/share the invite link — immediately after setup completes (StepComplete), and from the dashboard for link regeneration. This plan wires both surfaces to the generateInviteToken and getActiveInviteToken actions.

Output:
- src/app/setup/steps/step-complete.tsx — replaced placeholder with real invite URL + copy button
- src/components/invite/invite-section.tsx — new component for dashboard invite card
- src/app/dashboard/page.tsx — adds Parent B join check and conditionally renders InviteSection
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
<!-- Key contracts for P02 executor. -->

From src/actions/invite.ts (created in P01):
```typescript
export async function generateInviteToken(): Promise<
  { success: true; token: string; expiresAt: Date } |
  { success: false; error: string }
>

export async function getActiveInviteToken(): Promise<
  { success: true; token: string; expiresAt: Date; status: "active" | "expired" | "used" } |
  { success: false; error: string }
>
```

From src/app/setup/setup-wizard.tsx (current StepComplete call site):
```typescript
// SetupWizard renders: {step === 4 && <StepComplete />}
// step-complete.tsx is a Client Component ("use client")
// The component currently shows a placeholder Alert about Phase 13 invite
```

From src/app/dashboard/page.tsx (current shape — read the file):
```typescript
// Server Component; imports db, userGoogleTokens, getAppConfig
// Already queries user_google_tokens for ownerEmail (GCal warning banner)
// Must also check if user_google_tokens row exists for config.parent2Email (Parent B join detection)
```

From src/db/schema/tokens.ts:
```typescript
export const userGoogleTokens = pgTable("user_google_tokens", {
  email: text("email").primaryKey(),
  refreshToken: text("refresh_token").notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
})
```

From src/config/app.ts:
```typescript
// config.parents[1].email = parent2Email
// Use this to check if Parent B has joined
```

UI-SPEC Surface 1 (StepComplete):
- Invite URL block layout: flex gap-2 — Input readOnly + Button with Copy icon
- Copy success state: Check icon, text-green-600, aria-label="Linkki kopioitu", reverts after 2s
- "Kutsu [vanhemman nimi] liittymään" — use parent2Name from config
- "Siirry aikatauluun" link — buttonVariants({ size: "lg" })
- No regenerate button on StepComplete (D-15)

UI-SPEC Surface 2 (Dashboard invite section):
- Card: bg-card rounded-lg border p-6, max-w-lg
- Heading: text-base font-semibold — "Kutsu toinen vanhempi"
- Status — active: "Linkki voimassa N tuntia", expired: text-destructive "Linkki vanhentunut — luo uusi", used: "Toinen vanhempi on liittynyt"
- Input readOnly + Copy button (same pattern as StepComplete)
- Regenerate: Button variant="outline" size="sm" with RefreshCw icon — "Luo uusi linkki"
- Loading state: Loader2 animate-spin, button disabled
- Error state: Alert variant="destructive" inline
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update StepComplete to show invite URL with copy button</name>
  <files>src/app/setup/steps/step-complete.tsx</files>
  <read_first>
    - src/app/setup/steps/step-complete.tsx — current file (see what to replace)
    - src/app/setup/setup-wizard.tsx — how StepComplete is called (no props currently)
    - src/config/app.ts — getAppConfig shape (need parent2Name and parent2Email for label)
    - src/actions/invite.ts — generateInviteToken signature
    - .planning/phases/13-invite-access-gate/13-UI-SPEC.md §Surface 1
  </read_first>
  <action>
Rewrite src/app/setup/steps/step-complete.tsx.

StepComplete needs to:
1. Call generateInviteToken on mount to get the invite URL
2. Display the URL in a read-only Input with a copy button
3. Show the parent2Name in the label (per UI-SPEC copywriting)

Because generateInviteToken is a Server Action and StepComplete must be a Client Component (it has copy-button state), use the "Client Component calls Server Action directly" pattern.

**New component:**

```typescript
"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Copy, Check, Loader2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { generateInviteToken } from "@/actions/invite"

interface StepCompleteProps {
  parent2Name: string
}

export function StepComplete({ parent2Name }: StepCompleteProps) {
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(true)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    generateInviteToken()
      .then((result) => {
        if (result.success) {
          setInviteUrl(`${window.location.origin}/invite/${result.token}`)
        } else {
          setGenerateError(result.error)
        }
      })
      .catch(() => {
        setGenerateError("Linkin luonti epäonnistui. Yritä uudelleen.")
      })
      .finally(() => setIsGenerating(false))
  }, [])

  async function handleCopy() {
    if (!inviteUrl) return
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6 text-center">
      <h1 className="text-3xl font-semibold">Asennus valmis!</h1>
      <p className="text-muted-foreground">Perhetiedot on tallennettu.</p>

      <div className="space-y-2 text-left">
        <p className="text-sm font-semibold">
          Kutsu {parent2Name} liittymään
        </p>

        {isGenerating && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Luodaan kutsulinkki...</span>
          </div>
        )}

        {generateError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{generateError}</AlertDescription>
          </Alert>
        )}

        {inviteUrl && (
          <>
            <div className="flex gap-2">
              <Input
                readOnly
                value={inviteUrl}
                className="text-sm font-mono"
                aria-label="Kutsuinkki"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                aria-label={copied ? "Linkki kopioitu" : "Kopioi linkki leikepöydälle"}
                className="shrink-0 min-h-[44px] min-w-[44px]"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Lähetä tämä linkki {parent2Name}:lle. Kun hän avaa sen ja kirjautuu
              Google-tilillään, hän pääsee aikatauluun.
            </p>
          </>
        )}
      </div>

      <Link href="/dashboard" className={cn(buttonVariants({ size: "lg" }))}>
        Siirry aikatauluun
      </Link>
    </div>
  )
}
```

**Update SetupWizard to pass parent2Name:**

Also update src/app/setup/setup-wizard.tsx — the `StepComplete` now requires `parent2Name` prop. Change the render in setup-wizard.tsx from:
```tsx
{step === 4 && <StepComplete />}
```
to:
```tsx
{step === 4 && <StepComplete parent2Name={familyData.parent2Name} />}
```

The `familyData.parent2Name` is already in the SetupWizard state.
  </action>
  <verify>
    <automated>cd /Users/jarno/src/vuoroasuminen && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <acceptance_criteria>
    - src/app/setup/steps/step-complete.tsx starts with "use client"
    - File imports `generateInviteToken` from "@/actions/invite"
    - File contains `parent2Name` in the props interface
    - File contains `navigator.clipboard.writeText(inviteUrl)`
    - File contains `setTimeout(() => setCopied(false), 2000)`
    - File contains `Check` and `Copy` icon imports from lucide-react
    - File contains `Kutsu ${parent2Name} liittymään` label text
    - File contains `Siirry aikatauluun` link
    - File does NOT contain the old placeholder Alert about "Toisen vanhemman kutsuminen on tulossa"
    - src/app/setup/setup-wizard.tsx contains `parent2Name={familyData.parent2Name}` passed to StepComplete
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>StepComplete fetches and displays invite URL on mount; copy button toggles to Check icon for 2s; parent2Name injected as prop from SetupWizard</done>
</task>

<task type="auto">
  <name>Task 2: Dashboard invite section + Parent B join detection</name>
  <files>
    src/components/invite/invite-section.tsx
    src/app/dashboard/page.tsx
  </files>
  <read_first>
    - src/app/dashboard/page.tsx — current file structure, imports, existing queries
    - src/db/schema/tokens.ts — userGoogleTokens table
    - src/config/app.ts — getAppConfig (config.parents[1].email = parent2Email)
    - src/actions/invite.ts — getActiveInviteToken and generateInviteToken signatures
    - .planning/phases/13-invite-access-gate/13-UI-SPEC.md §Surface 2
  </read_first>
  <action>
**Part A — Create src/components/invite/invite-section.tsx**

This is a Client Component (needs useState for copy and regenerate loading states). It receives the initial token state as props from the Server Component that calls getActiveInviteToken.

```typescript
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Copy, Check, RefreshCw, Loader2, AlertCircle } from "lucide-react"
import { generateInviteToken } from "@/actions/invite"

interface InviteSectionProps {
  initialToken: string
  initialExpiresAt: Date
  initialStatus: "active" | "expired" | "used"
  origin: string  // passed from server: process.env.NEXT_PUBLIC_APP_URL || headers().get("host")
}

export function InviteSection({
  initialToken,
  initialExpiresAt,
  initialStatus,
  origin,
}: InviteSectionProps) {
  const [token, setToken] = useState(initialToken)
  const [expiresAt, setExpiresAt] = useState(initialExpiresAt)
  const [status, setStatus] = useState(initialStatus)
  const [copied, setCopied] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [regenError, setRegenError] = useState<string | null>(null)

  const inviteUrl = token ? `${origin}/invite/${token}` : ""

  // Status label rendering
  function renderStatus() {
    if (status === "used") {
      return <p className="text-sm text-muted-foreground">Toinen vanhempi on liittynyt</p>
    }
    if (status === "expired") {
      return <p className="text-sm text-destructive">Linkki vanhentunut — luo uusi</p>
    }
    // active — show hours remaining
    const hoursLeft = Math.max(
      0,
      Math.floor((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60)),
    )
    return (
      <p className="text-sm text-muted-foreground">
        Linkki voimassa {hoursLeft} tuntia
      </p>
    )
  }

  async function handleCopy() {
    if (!inviteUrl) return
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleRegenerate() {
    setIsRegenerating(true)
    setRegenError(null)
    try {
      const result = await generateInviteToken()
      if (result.success) {
        setToken(result.token)
        setExpiresAt(result.expiresAt)
        setStatus("active")
      } else {
        setRegenError(result.error)
      }
    } catch {
      setRegenError("Linkin luonti epäonnistui. Yritä uudelleen.")
    } finally {
      setIsRegenerating(false)
    }
  }

  const isLinkActive = status === "active" && !!token

  return (
    <div className="bg-card rounded-lg border p-6 max-w-lg space-y-4">
      <h2 className="text-base font-semibold">Kutsu toinen vanhempi</h2>

      {renderStatus()}

      <div className="flex gap-2">
        <Input
          readOnly
          value={inviteUrl}
          disabled={!isLinkActive}
          className="text-sm font-mono"
          aria-label="Kutsuinkki"
        />
        <Button
          variant="outline"
          size="icon"
          onClick={handleCopy}
          disabled={!isLinkActive}
          aria-label={copied ? "Linkki kopioitu" : "Kopioi linkki leikepöydälle"}
          className="shrink-0 min-h-[44px] min-w-[44px]"
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={handleRegenerate}
        disabled={isRegenerating}
      >
        {isRegenerating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        Luo uusi linkki
      </Button>

      {regenError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{regenError}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
```

**Part B — Update src/app/dashboard/page.tsx**

Add three things:
1. Import InviteSection and getActiveInviteToken
2. Query: check if `user_google_tokens` row exists for `config.parents[1].email` (parent2Email) — this is separate from the existing ownerEmail check
3. Conditionally render InviteSection above DashboardShell when Parent B has not joined

Modify the existing Promise.all to add the parent2 token check:

```typescript
import { InviteSection } from "@/components/invite/invite-section"
import { getActiveInviteToken } from "@/actions/invite"
import { headers } from "next/headers"

// In the component body, after config is loaded:
const parent2Email = config.parents[1].email

const [schedule, scheduleEndDate, tokenRow, parent2TokenRow, activeInvite] =
  await Promise.all([
    getScheduleWindow(validatedStart),
    getScheduleEndDate(),
    db
      .select({ email: userGoogleTokens.email })
      .from(userGoogleTokens)
      .where(eq(userGoogleTokens.email, ownerEmail))
      .limit(1)
      .then((rows) => rows[0]),
    // D-03: check if Parent B has signed in at least once
    db
      .select({ email: userGoogleTokens.email })
      .from(userGoogleTokens)
      .where(eq(userGoogleTokens.email, parent2Email))
      .limit(1)
      .then((rows) => rows[0]),
    // Fetch current invite token state for the invite section
    getActiveInviteToken(),
  ])

const showOwnerWarning = !tokenRow
const parentBJoined = !!parent2TokenRow

// Origin for building invite URL:
const headersList = await headers()
const host = headersList.get("host") ?? "localhost:3000"
const protocol = host.startsWith("localhost") ? "http" : "https"
const origin = `${protocol}://${host}`
```

Then in the JSX, before `<DashboardShell ...>`:

```tsx
{!parentBJoined && activeInvite.success && (
  <InviteSection
    initialToken={activeInvite.token}
    initialExpiresAt={activeInvite.expiresAt}
    initialStatus={activeInvite.status}
    origin={origin}
  />
)}
```

Place the InviteSection inside the existing page layout wrapper, above DashboardShell. If DashboardShell is the sole child of a wrapper div, wrap both in a fragment or add an outer container div.

The return structure should be:
```tsx
return (
  <>
    {!parentBJoined && activeInvite.success && (
      <InviteSection ... />
    )}
    <DashboardShell ... />
  </>
)
```
  </action>
  <verify>
    <automated>cd /Users/jarno/src/vuoroasuminen && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <acceptance_criteria>
    - src/components/invite/invite-section.tsx exists and starts with "use client"
    - File contains `export function InviteSection(`
    - File contains `generateInviteToken` import from "@/actions/invite"
    - File contains `Kutsu toinen vanhempi` heading text
    - File contains `Luo uusi linkki` button text
    - File contains `Linkki voimassa` in status rendering
    - File contains `Linkki vanhentunut` in status rendering
    - File contains `Toinen vanhempi on liittynyt` in status rendering
    - src/app/dashboard/page.tsx imports `InviteSection` from "@/components/invite/invite-section"
    - src/app/dashboard/page.tsx imports `getActiveInviteToken` from "@/actions/invite"
    - src/app/dashboard/page.tsx queries userGoogleTokens for `parent2Email`
    - src/app/dashboard/page.tsx contains `parentBJoined`
    - src/app/dashboard/page.tsx conditionally renders `InviteSection` when `!parentBJoined`
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>Dashboard invite section renders when Parent B has not joined; shows link status; copy button works; regenerate calls Server Action; section absent when Parent B has joined</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser clipboard API | navigator.clipboard.writeText — sandboxed, no server trust boundary crossed |
| Server Action → DB | generateInviteToken called from browser via Server Action RPC |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-13-P02-01 | Spoofing | generateInviteToken (called from StepComplete) | mitigate | Server Action verifies auth via getUser() before generating — unauthenticated callers rejected |
| T-13-P02-02 | Information Disclosure | InviteSection origin construction | accept | Origin derived from Host header (server-controlled in production via Vercel); not user-supplied |
| T-13-P02-03 | Tampering | Dashboard parent2 join detection | accept | Query uses service_role db connection; attacker cannot fake a user_google_tokens row without completing actual OAuth |
| T-13-P02-04 | Denial of Service | Repeated regenerate clicks | accept | Two-user app; rate-limiting is disproportionate; button disabled during in-flight request |
</threat_model>

<verification>
After both tasks complete:

1. `npx tsc --noEmit` — zero TypeScript errors
2. Navigate to `/setup` → complete wizard → arrive at StepComplete → invite URL appears in read-only Input
3. Click copy button → Check icon appears for 2s → reverts to Copy icon
4. Navigate to `/dashboard` when Parent B has not joined → invite section visible above schedule
5. Inspect dashboard DOM: `div.bg-card` containing "Kutsu toinen vanhempi" heading present
6. Sign in as Parent B → return to dashboard as Parent A → invite section gone from DOM
</verification>

<success_criteria>
- StepComplete shows real invite URL (not placeholder text) after wizard completes
- Copy button toggles to Check for 2s with no toast
- Dashboard invite section visible when Parent B has not joined; absent once Parent B has joined
- Regenerate button generates new token and updates the section without page reload
- TypeScript compiles clean
</success_criteria>

<output>
After completion, create .planning/phases/13-invite-access-gate/13-P02-SUMMARY.md
</output>
