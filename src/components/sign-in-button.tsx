"use client"

import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"

export default function SignInButton() {
  async function handleSignIn() {
    const supabase = createBrowserClient()
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
    <Button size="lg" onClick={handleSignIn}>
      Kirjaudu sisään Googlella
    </Button>
  )
}
