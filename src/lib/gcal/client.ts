import { google } from "googleapis"
import type { calendar_v3 } from "googleapis"
import { db } from "@/db"
import { accounts } from "@/db/schema/auth"
import { users } from "@/db/schema/auth"
import { eq, and } from "drizzle-orm"

/**
 * Build an authenticated googleapis Calendar client for the given parent.
 *
 * Token lookup strategy (per D-03, corrected from CONTEXT.md):
 * - accounts.providerAccountId stores Google's numeric sub ID, NOT the email.
 * - Join users → accounts on userId, filter by users.email.
 *
 * Token exchange strategy (per D-04, consistent with auth.ts jwt callback):
 * - Call Google token endpoint manually with the stored refresh_token.
 * - Pass access_token + expiry_date to setCredentials so googleapis does not
 *   attempt a second auto-refresh that could fail silently if expiry_date is absent.
 */
export async function buildGCalClient(
  parentEmail: string
): Promise<calendar_v3.Calendar> {
  const [row] = await db
    .select({ refresh_token: accounts.refresh_token })
    .from(accounts)
    .innerJoin(users, eq(accounts.userId, users.id))
    .where(
      and(
        eq(users.email, parentEmail),
        eq(accounts.provider, "google")
      )
    )
    .limit(1)

  if (!row?.refresh_token) {
    console.error(`[GCal] No refresh token found for ${parentEmail}`)
    throw new Error("Calendar authentication required. Please sign in with Google again.")
  }

  // Exchange refresh_token for a fresh access_token (same pattern as auth.ts lines 32-47)
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID!,
      client_secret: process.env.AUTH_GOOGLE_SECRET!,
      grant_type: "refresh_token",
      refresh_token: row.refresh_token,
    }),
  })

  if (!tokenResponse.ok) {
    const errBody = await tokenResponse.text()
    console.error(`[GCal] Token exchange failed for ${parentEmail} (HTTP ${tokenResponse.status}): ${errBody}`)
    throw new Error("Calendar authentication failed. Please sign in with Google again.")
  }

  const { access_token, expires_in } = await tokenResponse.json() as {
    access_token: string
    expires_in: number
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.AUTH_GOOGLE_ID,
    process.env.AUTH_GOOGLE_SECRET,
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
