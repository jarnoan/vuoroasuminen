"use server"

import { z } from "zod"
import { db } from "@/db"
import { familyConfig } from "@/db/schema/domain"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { buildGCalClient } from "@/lib/gcal/client"

const WizardInputSchema = z.object({
  parent1Name: z.string().min(1, "Nimi ei voi olla tyhjä").max(80),
  parent1Email: z.string().email("Syötä kelvollinen sähköpostiosoite"),
  parent1CalendarId: z.string().min(1, "Valitse tai syötä kalenterin tunnus"),
  parent2Name: z.string().min(1, "Nimi ei voi olla tyhjä").max(80),
  parent2Email: z.string().email("Syötä kelvollinen sähköpostiosoite"),
  parent2CalendarId: z.string().min(1, "Syötä toisen vanhemman kalenterin tunnus"),
  children: z
    .array(z.string().min(1, "Lapsen nimi ei voi olla tyhjä").max(80))
    .min(1, "Lisää vähintään yksi lapsen nimi"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Virheellinen päivämäärä"),
  firstParent: z.enum(["father", "mother"]),
})

export type WizardInput = z.infer<typeof WizardInputSchema>

/**
 * Persist the wizard data to family_config (D-15).
 *
 * Uses onConflictDoUpdate so re-submitting the wizard updates the
 * existing single row. parent1/parent2 ids are always "father" and
 * "mother" — the firstParent field controls week-1 assignment, not the
 * label-id mapping.
 */
export async function saveWizardConfig(
  input: WizardInput
): Promise<{ success: true } | { success: false; error: string }> {
  // Auth: require authenticated user (any signed-in Google user can complete
  // first-time setup; per D-11 no additional gate on /setup).
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) {
    return { success: false, error: "Ei kirjautunut" }
  }

  // Zod parse — collects first error from each field
  const parsed = WizardInputSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Virheelliset tiedot" }
  }
  const data = parsed.data

  // Domain rules not expressible in Zod cleanly
  if (data.parent1Email === data.parent2Email) {
    return {
      success: false,
      error: "Toisen vanhemman sähköposti ei voi olla sama kuin omasi",
    }
  }
  // Reject duplicate children names
  const uniqueChildren = new Set(data.children.map((c) => c.trim().toLowerCase()))
  if (uniqueChildren.size !== data.children.length) {
    return { success: false, error: "Lasten nimet eivät voi olla samoja" }
  }
  // Reject non-Monday startDate (getUTCDay returns 1 for Monday)
  const startDay = new Date(data.startDate + "T00:00:00Z").getUTCDay()
  if (startDay !== 1) {
    return { success: false, error: "Aloituspäivän on oltava maanantai" }
  }

  await db
    .insert(familyConfig)
    .values({
      id: 1,
      parent1Id: "father",
      parent1Name: data.parent1Name,
      parent1Email: data.parent1Email,
      parent1CalendarId: data.parent1CalendarId,
      parent2Id: "mother",
      parent2Name: data.parent2Name,
      parent2Email: data.parent2Email,
      parent2CalendarId: data.parent2CalendarId,
      children: data.children,
      startDate: data.startDate,
      firstParent: data.firstParent,
    })
    .onConflictDoUpdate({
      target: familyConfig.id,
      set: {
        parent1Name: data.parent1Name,
        parent1Email: data.parent1Email,
        parent1CalendarId: data.parent1CalendarId,
        parent2Name: data.parent2Name,
        parent2Email: data.parent2Email,
        parent2CalendarId: data.parent2CalendarId,
        children: data.children,
        startDate: data.startDate,
        firstParent: data.firstParent,
        updatedAt: new Date(),
      },
    })

  return { success: true }
}

/**
 * Fetch the authenticated user's Google calendars for the wizard picker (D-05).
 * Uses the same buildGCalClient + refresh-token infrastructure as GCal sync.
 */
export async function listCalendars(): Promise<
  | { success: true; calendars: Array<{ id: string; summary: string }> }
  | { success: false; error: string }
> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) {
    return { success: false, error: "Ei kirjautunut" }
  }

  try {
    const calendar = await buildGCalClient(user.email)
    const res = await calendar.calendarList.list()
    const items = (res.data.items ?? []).map((c) => ({
      id: c.id ?? "",
      summary: c.summary ?? c.id ?? "",
    }))
    return { success: true, calendars: items }
  } catch (err) {
    console.error("[listCalendars] failed:", err)
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}
