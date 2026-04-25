"use server"

import { db } from "@/db"
import { scheduleEntries } from "@/db/schema/domain"
import { and, eq, gte, lte } from "drizzle-orm"
import { auth } from "@/auth"
import type { ParentId } from "@/config/app"
import config from "@/config/app"
import { getWindowBounds } from "@/lib/schedule/generate-default"
import { format } from "date-fns"
import { syncCalendarsAfterPublish } from "@/lib/gcal/sync"
import type { SyncResult } from "@/lib/gcal/sync"

const VALID_PARENT_IDS: ParentId[] = ["father", "mother"]

async function requireAuthorizedParent() {
  const session = await auth()
  const email = session?.user?.email
  if (!email) throw new Error("Not authenticated")
  const isAuthorized = config.parents.some((p) => p.email === email)
  if (!isAuthorized) throw new Error("Forbidden")
  return { session, email }
}

export async function toggleCell(entryId: string, newParentId: ParentId) {
  await requireAuthorizedParent()

  if (!VALID_PARENT_IDS.includes(newParentId)) {
    throw new Error("Invalid parentId")
  }

  await db.update(scheduleEntries)
    .set({ parentId: newParentId, status: "draft" })
    .where(eq(scheduleEntries.id, entryId))

  return { success: true }
}

export async function saveNotes(entryId: string, notes: string) {
  await requireAuthorizedParent()

  if (typeof notes !== "string") throw new Error("Invalid notes")
  if (notes.length > 500) throw new Error("Notes too long (max 500 characters)")

  await db.update(scheduleEntries)
    .set({ notes })
    .where(eq(scheduleEntries.id, entryId))

  return { success: true }
}

export async function publishSchedule(): Promise<
  | { success: true; count: number }
  | { success: false; error: string }
> {
  await requireAuthorizedParent()

  const { start, end } = getWindowBounds()
  const startStr = format(start, "yyyy-MM-dd")
  const endStr = format(end, "yyyy-MM-dd")

  const result = await db.update(scheduleEntries)
    .set({ status: "published" })
    .where(
      and(
        eq(scheduleEntries.status, "draft"),
        gte(scheduleEntries.day, startStr),
        lte(scheduleEntries.day, endStr),
      )
    )
    .returning({ id: scheduleEntries.id })

  return { success: true, count: result.length }
}

export async function syncCalendars(): Promise<SyncResult> {
  await requireAuthorizedParent()
  let syncResult: SyncResult
  try {
    syncResult = await syncCalendarsAfterPublish()
  } catch (err) {
    // Log the error but still return a result object — sync is best-effort
    console.error("[syncCalendars] GCal sync threw unexpectedly:", err)
    syncResult = {
      success: false,
      parentResults: [
        { parentId: "unknown", created: 0, deleted: 0, error: String(err) },
      ],
    }
  }

  console.log("[syncCalendars] syncResult:", JSON.stringify(syncResult, null, 2))
  return syncResult
}
