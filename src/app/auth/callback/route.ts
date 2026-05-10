import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { db } from "@/db"
import { userGoogleTokens } from "@/db/schema/tokens"

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

  if (!providerRefreshToken || !userEmail) {
    return NextResponse.redirect(new URL("/auth/error", request.url))
  }

  // D-11: write via the admin Drizzle connection (DATABASE_URL bypasses RLS).
  // onConflictDoUpdate handles re-sign-ins as upserts on the email PK,
  // avoiding race conditions if the user signs in twice in quick succession.
  await db
    .insert(userGoogleTokens)
    .values({
      email: userEmail,
      refreshToken: providerRefreshToken,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userGoogleTokens.email,
      set: {
        refreshToken: providerRefreshToken,
        updatedAt: new Date(),
      },
    })

  return response
}
