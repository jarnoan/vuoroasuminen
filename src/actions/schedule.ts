"use server"

import { db } from "@/db"
import { scheduleEntries } from "@/db/schema/domain"
import { and, eq, gte, lte } from "drizzle-orm"
import { auth } from "@/auth"
import type { ParentId } from "@/config/app"
import { getWindowBounds } from "@/lib/schedule/generate-default"
import { format } from "date-fns"
import { syncCalendarsAfterPublish } from "@/lib/gcal/sync"
import type { SyncResult } from "@/lib/gcal/sync"

export async function toggleCell(entryId: string, newParentId: ParentId) {
  const session = await auth()
  if (!session?.user) throw new Error("Not authenticated")

  await db.update(scheduleEntries)
    .set({ parentId: newParentId, status: "draft" })
    .where(eq(scheduleEntries.id, entryId))

  return { success: true }
}

export async function saveNotes(entryId: string, notes: string) {
  const session = await auth()
  if (!session?.user) throw new Error("Not authenticated")

  await db.update(scheduleEntries)
    .set({ notes })
    .where(eq(scheduleEntries.id, entryId))

  return { success: true }
}

export async function publishDraft(): Promise<
  | { success: true; count: number; syncResult: SyncResult | null }
  | { success: false; error: string }
> {
  const session = await auth()
  if (!session?.user) throw new Error("Not authenticated")

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

  // GCal sync is best-effort — a sync failure must NOT roll back the DB publish (per D-05)
  let syncResult: SyncResult | null = null
  try {
    syncResult = await syncCalendarsAfterPublish()
  } catch (err) {
    // Log the error but still return success: true for the DB publish
    console.error("[publishDraft] GCal sync threw unexpectedly:", err)
    syncResult = {
      success: false,
      parentResults: [
        { parentId: "unknown", created: 0, deleted: 0, error: String(err) },
      ],
    }
  }

  return { success: true, count: result.length, syncResult }
}
