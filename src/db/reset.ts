import "../env" // must be first — loads .env.local before db pool initializes
import { db } from "./index"
import { gcalEvents, scheduleEntries, schedules, children } from "./schema/domain"
import config from "../config/app"

/**
 * Clears all schedule data and re-seeds children from config.
 *
 * Run this whenever you change children names or add/remove children in app.ts.
 * The app will auto-seed fresh schedule entries on the next page load.
 */
async function reset() {
  console.log("Resetting schedule data...")

  // Delete in FK dependency order
  await db.delete(gcalEvents)
  console.log("  ✓ gcal_events cleared")

  await db.delete(scheduleEntries)
  console.log("  ✓ schedule_entries cleared")

  await db.delete(schedules)
  console.log("  ✓ schedules cleared")

  await db.delete(children)
  console.log("  ✓ children cleared")

  // Re-seed children from config
  for (const name of config.children) {
    await db.insert(children).values({ name })
  }
  console.log(`  ✓ children re-seeded: ${config.children.join(", ")}`)

  console.log("Done. Open the app to auto-seed schedule entries.")
  process.exit(0)
}

reset().catch((e) => {
  console.error(e)
  process.exit(1)
})
