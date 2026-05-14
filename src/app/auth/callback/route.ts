import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")

  if (!code) {
    return NextResponse.redirect(new URL("/auth/error", request.url))
  }

  // CRITICAL (Pitfall 3): build the response BEFORE creating the Supabase client
  // so the cookie setAll callback has a response object to write session cookies to.
  // If the redirect is constructed after exchangeCodeForSession, the session cookies
  // are silently dropped and the browser remains unauthenticated.
  const response = NextResponse.redirect(new URL("/dashboard", request.url))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    },
  )

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.session) {
    return NextResponse.redirect(new URL("/auth/error", request.url))
  }

  // SAUTH-06: provider_refresh_token is only available HERE — not in subsequent
  // getSession() calls. If Google did not return one (e.g. user had a prior
  // consent grant without prompt:consent), redirect to the error page so the
  // user can re-grant with the correct OAuth params.
  const providerRefreshToken = data.session.provider_refresh_token
  const userEmail = data.session.user.email

  console.log("[auth/callback] provider_refresh_token present:", !!providerRefreshToken, "email:", userEmail)

  if (!providerRefreshToken || !userEmail) {
    console.log("[auth/callback] missing provider_refresh_token or email → redirecting to /auth/error")
    return NextResponse.redirect(new URL("/auth/error", request.url))
  }

  const { error: upsertError } = await supabase
    .from('user_google_tokens')
    .upsert(
      {
        email: userEmail,
        refresh_token: providerRefreshToken,   // snake_case — raw DB column name
        updated_at: new Date().toISOString(),  // snake_case — raw DB column name
      },
      { onConflict: 'email' },
    )

  if (upsertError) {
    console.error("[auth/callback] token upsert failed:", upsertError)
    return NextResponse.redirect(new URL("/auth/error", request.url))
  }
  console.log("[auth/callback] token row upserted for", userEmail)

  return response
}
