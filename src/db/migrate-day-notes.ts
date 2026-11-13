import "../env" // must be first — loads .env.local before db pool initializes
import { db } from "./index"
import { dayNotes, scheduleEntries } from "./schema/domain"
import { and, asc, isNotNull, ne } from "drizzle-orm"

/**
 * One-time copy of the legacy per-day notes (schedule_entries.notes) into day_notes as
 * single-day notes. Non-destructive: schedule_entries.notes is left as it is.
 * Idempotent: a day that already has a day_notes row with the same text is skipped.
 *
 * Run after `npm run db:push` has created the day_notes table:
 *   npm run db:migrate-notes -- --yes
 */
async function migrate() {
  if (!process.argv.includes("--yes")) {
    console.error("Refusing to run: pass --yes to copy legacy notes into day_notes.")
    process.exit(1)
  }

  const legacy = await db.select({ day: scheduleEntries.day, notes: scheduleEntries.notes })
    .from(scheduleEntries)
    .where(and(isNotNull(scheduleEntries.notes), ne(scheduleEntries.notes, "")))
    .orderBy(asc(scheduleEntries.day))

  // The old UI kept one note per day (on one of the day's entries); collect distinct texts per day
  const byDay = new Map<string, Set<string>>()
  for (const row of legacy) {
    const text = row.notes!.trim()
    if (!text) continue
    if (!byDay.has(row.day)) byDay.set(row.day, new Set())
    byDay.get(row.day)!.add(text)
  }

  const existing = await db.select({ startDay: dayNotes.startDay, endDay: dayNotes.endDay, text: dayNotes.text }).from(dayNotes)
  const existingKeys = new Set(existing.filter(n => n.startDay === n.endDay).map(n => `${n.startDay}|${n.text}`))

  const values = [...byDay].flatMap(([day, texts]) =>
    [...texts]
      .filter(text => !existingKeys.has(`${day}|${text}`))
      .map(text => ({ startDay: day, endDay: day, text })),
  )

  if (values.length > 0) await db.insert(dayNotes).values(values)
  console.log(`Copied ${values.length} note(s) into day_notes (${byDay.size} day(s) had legacy notes).`)
  process.exit(0)
}

migrate().catch((err) => {
  console.error(err)
  process.exit(1)
})
