"use server"

import { db } from "@/db"
import { scheduleEntries } from "@/db/schema/domain"
import { eq } from "drizzle-orm"
import { auth } from "@/auth"
import type { ParentId } from "@/config/app"

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
