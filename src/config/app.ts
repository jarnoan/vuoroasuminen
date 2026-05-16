import { db } from "@/db"
import { familyConfig } from "@/db/schema/domain"
import { eq } from "drizzle-orm"

export type ParentId = "father" | "mother"

export interface AppConfig {
  parents: Array<{
    id: ParentId
    name: string
    email: string
    calendarId: string
    ownerEmail: string
  }>
  children: string[]
  startDate: string
  firstParent: ParentId
}

/**
 * Read the family configuration from the database.
 *
 * Replaces the legacy synchronous env-var config (Phase 12 D-15).
 *
 * ownerEmail derivation (D-07): both parent entries report
 * `ownerEmail = parent1Email`. The first parent who completes the
 * setup wizard becomes the single calendar token owner — this
 * preserves Phase 8 D-01 (single calendar owner) without a separate
 * DB column.
 *
 * Throws when no row exists — callers (e.g., dashboard) must catch
 * and redirect to /setup (D-10).
 */
export async function getAppConfig(): Promise<AppConfig> {
  const [row] = await db
    .select()
    .from(familyConfig)
    .where(eq(familyConfig.id, 1))
    .limit(1)

  if (!row) {
    throw new Error("Family config not found — onboarding not complete")
  }

  return {
    parents: [
      {
        id: row.parent1Id as ParentId,
        name: row.parent1Name,
        email: row.parent1Email,
        calendarId: row.parent1CalendarId,
        ownerEmail: row.parent1Email, // D-07
      },
      {
        id: row.parent2Id as ParentId,
        name: row.parent2Name,
        email: row.parent2Email,
        calendarId: row.parent2CalendarId,
        ownerEmail: row.parent1Email, // D-07: same owner for both
      },
    ],
    children: row.children,
    startDate: row.startDate,
    firstParent: row.firstParent as ParentId,
  }
}
