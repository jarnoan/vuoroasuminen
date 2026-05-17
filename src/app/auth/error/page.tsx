"use client"

import { Suspense } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { Button } from "@/components/ui/button"
import { useSearchParams } from "next/navigation"

function AuthErrorContent() {
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

export default function AuthErrorPage() {
  return (
    <Suspense>
      <AuthErrorContent />
    </Suspense>
  )
}
