import { db } from "@/db"
import { inviteTokens } from "@/db/schema/domain"
import { eq } from "drizzle-orm"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { InviteSignInButton } from "./invite-sign-in-button"

/**
 * /invite/[token] — Invite acceptance page.
 *
 * Server Component: validates the token server-side and renders the
 * appropriate surface (valid vs. invalid/expired/used).
 *
 * UI-SPEC Surface 3:
 * - Valid: "Liity vuoroasumissuunnitelmaan" + sign-in button
 * - Invalid/expired/used: Finnish error alert, no sign-in button
 */
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
