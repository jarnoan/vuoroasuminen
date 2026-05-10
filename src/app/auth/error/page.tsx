"use client"

import { createBrowserClient } from "@supabase/ssr"
import { Button } from "@/components/ui/button"

export default function AuthErrorPage() {
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
