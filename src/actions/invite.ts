"use server"

import crypto from "crypto"
import { db } from "@/db"
import { inviteTokens } from "@/db/schema/domain"
import { eq, and, isNull, desc } from "drizzle-orm"
import { createSupabaseServerClient } from "@/lib/supabase/server"

/**
 * Generate a new invite token for the authenticated user.
 *
 * Implements D-04 (43-char base64url token), D-05 (72h expiry), and
 * D-06 (one outstanding token per creator — prior unused tokens are
 * hard-deleted before inserting the new one).
 *
 * Returns the token and expiry so the caller can construct the invite URL.
 */
export async function generateInviteToken(): Promise<
  | { success: true; token: string; expiresAt: Date }
  | { success: false; error: string }
> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) {
    return { success: false, error: "Ei kirjautunut" }
  }

  // D-04: 43-char URL-safe token (32 bytes base64url)
  const token = crypto.randomBytes(32).toString("base64url")
  // D-05: 72-hour expiry
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000)

  try {
    // D-06: Delete prior unused tokens for this creator (one outstanding at a time)
    await db.delete(inviteTokens).where(
      and(
        eq(inviteTokens.createdBy, user.email),
        isNull(inviteTokens.usedAt),
      )
    )

    // Insert new token
    await db.insert(inviteTokens).values({
      token,
      createdBy: user.email,
      expiresAt,
    })

    return { success: true, token, expiresAt }
  } catch (err) {
    console.error("[generateInviteToken] failed:", err)
    return { success: false, error: "Linkin luonti epäonnistui. Yritä uudelleen." }
  }
}

/**
 * Return the most recent invite token for the authenticated user, with status.
 *
 * Called by the Dashboard invite section (P02) to show the current link state.
 * Status: "active" | "expired" | "used"
 * When no token exists, returns status "expired" with empty token and epoch-zero date.
 */
export async function getActiveInviteToken(): Promise<
  | { success: true; token: string; expiresAt: Date; status: "active" | "expired" | "used" }
  | { success: false; error: string }
> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) {
    return { success: false, error: "Ei kirjautunut" }
  }

  const [row] = await db
    .select()
    .from(inviteTokens)
    .where(eq(inviteTokens.createdBy, user.email))
    .orderBy(desc(inviteTokens.createdAt))
    .limit(1)

  if (!row) {
    // No token ever generated — treat as expired for display purposes
    return { success: true, token: "", expiresAt: new Date(0), status: "expired" }
  }

  let status: "active" | "expired" | "used"
  if (row.usedAt !== null) {
    status = "used"
  } else if (row.expiresAt <= new Date()) {
    status = "expired"
  } else {
    status = "active"
  }

  return { success: true, token: row.token, expiresAt: row.expiresAt, status }
}
