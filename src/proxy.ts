import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createSupabaseMiddlewareClient } from "@/lib/supabase/middleware"
import { db } from "@/db"
import { familyConfig } from "@/db/schema/domain"
import { eq } from "drizzle-orm"

export async function proxy(request: NextRequest) {
  // CRITICAL (D-10): create the response and Supabase client INSIDE the handler.
  // Module-scope clients leak sessions between users on Vercel warm instances.
  const response = NextResponse.next()
  const supabase = createSupabaseMiddlewareClient(request, response)

  // CRITICAL (D-09): getUser() validates the JWT server-side. getSession() trusts
  // a spoofable cookie and MUST NOT be used for route protection.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Routes exempt from onboarding check:
  // - "/" — home / sign-in page
  // - "/auth/*" — OAuth callback, error page
  // - "/invite/*" — invite acceptance (unauthenticated users must reach this)
  // - "/setup" — onboarding wizard (no family_config row yet)
  const isExempt =
    pathname === "/" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/invite/") ||
    pathname === "/setup"

  // Tier 1: Not signed in → redirect to /
  if (!user && !isExempt) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  // Exempt routes bypass tiers 2 and 3
  if (isExempt) {
    return response
  }

  // Tier 2 + 3: user is signed in and route is protected
  // CRITICAL (D-13): Read family_config using service_role Drizzle connection.
  // Do NOT use supabase anon client for this read — RLS would block it.
  let configRow: { parent1Email: string; parent2Email: string } | undefined
  try {
    const [row] = await db
      .select({
        parent1Email: familyConfig.parent1Email,
        parent2Email: familyConfig.parent2Email,
      })
      .from(familyConfig)
      .where(eq(familyConfig.id, 1))
      .limit(1)
    configRow = row
  } catch (err) {
    console.error("[proxy] family_config read failed:", err)
    // DB error — allow through to avoid a boot-time lockout; dashboard handles missing config
    return response
  }

  // Tier 2: Signed in but no family_config row → redirect to /setup (wizard not completed)
  if (!configRow) {
    return NextResponse.redirect(new URL("/setup", request.url))
  }

  // Tier 3: Signed in, family_config exists, but email not in parent list
  // user is non-null here: tier 1 redirected unauthenticated requests and isExempt paths returned early
  const userEmail = user!.email
  const isRecognized =
    userEmail === configRow.parent1Email ||
    userEmail === configRow.parent2Email

  if (!isRecognized) {
    // Sign out FIRST so signOut() can write cookie-clearing headers into `response`,
    // then build the redirect and copy the post-signOut cookie state onto it.
    // Building errorRedirect before signOut would mean the first cookie copy carries
    // live session values, and a duplicate set with the cleared values could leave
    // the outcome dependent on which write wins.
    await supabase.auth.signOut()

    const errorRedirect = NextResponse.redirect(
      new URL("/auth/error?error=unauthorized_email", request.url),
    )
    // Copy post-signOut cookie state (includes session-clearing Set-Cookie headers)
    response.cookies.getAll().forEach(({ name, value, ...options }) => {
      errorRedirect.cookies.set(name, value, options)
    })
    return errorRedirect
  }

  // Tier 4: All checks pass — allow through
  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
