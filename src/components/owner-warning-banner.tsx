"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { createBrowserClient } from "@supabase/ssr"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

export function OwnerWarningBanner() {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  async function handleSignIn() {
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
    <div className="px-4 pt-4">
      <Alert className="flex items-start justify-between gap-4">
        <AlertDescription className="flex-1">
          Kalenterin omistaja ei ole kirjautunut — kalenterisynkronointi ei toimi.{" "}
          <Button
            variant="link"
            size="sm"
            className="p-0 h-auto align-baseline"
            onClick={handleSignIn}
          >
            Kirjaudu sisään
          </Button>
        </AlertDescription>
        <button
          type="button"
          aria-label="Sulje ilmoitus"
          onClick={() => setDismissed(true)}
          className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </Alert>
    </div>
  )
}
