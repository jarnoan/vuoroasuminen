import { google } from "googleapis"
import type { calendar_v3 } from "googleapis"
import { db } from "@/db"
import { userGoogleTokens } from "@/db/schema/tokens"
import { eq } from "drizzle-orm"

/**
 * Build an authenticated googleapis Calendar client for the given calendar owner.
 *
 * Token lookup strategy (Phase 8 D-01, D-11):
 * - user_google_tokens stores Google refresh tokens captured by /auth/callback.
 * - Lookup is by email (PK on user_google_tokens), regardless of which parent
 *   triggered publish — the calendar owner's token is always used.
 * - Reads via the admin Drizzle connection (DATABASE_URL) — bypasses RLS,
 *   which is correct because Phase 9 RLS policies restrict user_google_tokens
 *   reads to the row owner; the GCal sync runs server-side with full DB access.
 *
 * Token exchange strategy (preserved from v1.0):
 * - Call Google token endpoint manually with the stored refresh_token.
 * - Pass access_token + expiry_date to setCredentials so googleapis does not
 *   attempt a second auto-refresh that could fail silently if expiry_date is absent
 *   (Issue #2350).
 *
 * Env vars (Phase 10 rename): GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET. These are
 * the Google OAuth client credentials configured in Google Cloud Console. They are
 * separate from Supabase Auth — Supabase Dashboard holds its own copy of these for
 * the sign-in flow; this file uses them directly for the GCal refresh-token exchange.
 */
export async function buildGCalClient(
  ownerEmail: string
): Promise<calendar_v3.Calendar> {
  const [row] = await db
    .select({ refreshToken: userGoogleTokens.refreshToken })
    .from(userGoogleTokens)
    .where(eq(userGoogleTokens.email, ownerEmail))
    .limit(1)

  if (!row?.refreshToken) {
    console.error(`[GCal] No refresh token found for ${ownerEmail}`)
    throw new Error(
      `No refresh token found for ${ownerEmail}. Calendar owner must sign in.`
    )
  }

  // Exchange refresh_token for a fresh access_token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: row.refreshToken,
    }),
  })

  if (!tokenResponse.ok) {
    const errBody = await tokenResponse.text()
    console.error(
      `[GCal] Token exchange failed for ${ownerEmail} (HTTP ${tokenResponse.status}): ${errBody}`
    )
    throw new Error(
      `Calendar authentication failed for ${ownerEmail}. Owner must sign in again.`
    )
  }

  const { access_token, expires_in } = (await tokenResponse.json()) as {
    access_token: string
    expires_in: number
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  )
  // Set both access_token and expiry_date.
  // If only access_token is set without expiry_date, googleapis assumes it is valid
  // and never auto-refreshes — a silent-failure trap (Issue #2350).
  oauth2Client.setCredentials({
    access_token,
    expiry_date: Date.now() + (expires_in - 60) * 1000, // 60-second buffer
  })

  return google.calendar({ version: "v3", auth: oauth2Client })
}
