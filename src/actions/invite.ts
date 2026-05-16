"use server"

import crypto from "crypto"
import { db } from "@/db"
import { inviteTokens } from "@/db/schema/domain"
import { eq, and, isNull, desc } from "drizzle-orm"
import { createSupabaseServerClient } from "@/lib/supabase/server"

/**
 * Generate a new invite token for Parent A to share with Parent B.
 *
 * Implements D-04 (43-char base64url token), D-05 (72h expiry), and
 * D-06 (one outstanding token per creator — deletes prior unused tokens).
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

  const token = crypto.randomBytes(32).toString("base64url")
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000)

  try {
    // D-06: Delete all prior unused tokens for this creator before inserting
    await db.delete(inviteTokens).where(
      and(eq(inviteTokens.createdBy, user.email), isNull(inviteTokens.usedAt)),
    )

    await db.insert(inviteTokens).values({
      token,
      createdBy: user.email,
      expiresAt,
    })

    return { success: true, token, expiresAt }
  } catch {
    return {
      success: false,
      error: "Linkin luonti epäonnistui. Yritä uudelleen.",
    }
  }
}

/**
 * Get the most recent invite token for the current user, with status.
 *
 * Used by the Dashboard invite section to show current link state.
 * Returns a synthetic "expired" response when no token exists.
 */
export async function getActiveInviteToken(): Promise<
  | {
      success: true
      token: string
      expiresAt: Date
      status: "active" | "expired" | "used"
    }
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
    return {
      success: true,
      token: "",
      expiresAt: new Date(0),
      status: "expired",
    }
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
