import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createSupabaseMiddlewareClient } from "@/lib/supabase/middleware"

export async function middleware(request: NextRequest) {
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
  const isOnHome = pathname === "/"
  const isOnAuthRoute = pathname.startsWith("/auth/")

  if (!user && !isOnHome && !isOnAuthRoute) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
