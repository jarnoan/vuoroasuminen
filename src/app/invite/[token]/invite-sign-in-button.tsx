"use client"

import { useState } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { Button } from "@/components/ui/button"
import { LogIn, Loader2 } from "lucide-react"

/**
 * Client Component: sign-in button for the invite acceptance page.
 *
 * Before triggering Google OAuth, sets an invite_token cookie (D-07)
 * so /auth/callback can consume it on the other side of the OAuth roundtrip.
 *
 * Cookie note: Max-Age=600 (10 min) survives the OAuth roundtrip.
 * HttpOnly cannot be set via document.cookie (browser ignores it).
 * The token is a single-use random value validated server-side at /auth/callback.
 * Secure is set only on HTTPS — omitting it on http://localhost prevents the
 * browser from silently dropping the cookie, which would break the invite flow
 * in development.
 */
export function InviteSignInButton({ token }: { token: string }) {
  const [isLoading, setIsLoading] = useState(false)

  async function handleSignIn() {
    setIsLoading(true)
    // D-07: Set invite_token cookie BEFORE OAuth redirect.
    // Max-Age=600 (10 min) — survives the OAuth roundtrip.
    // Secure is conditional: browsers silently drop cookies with Secure on plain
    // http (including localhost), which would break the invite flow in development.
    const isSecure = window.location.protocol === "https:"
    const secureFlag = isSecure ? "; Secure" : ""
    document.cookie = `invite_token=${token}; Max-Age=600; Path=/; SameSite=Lax${secureFlag}`

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
