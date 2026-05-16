import "../env" // must be first — loads .env.local before db pool initializes
import { db } from "./index"
import { children } from "./schema/domain"
import { getAppConfig } from "../config/app"

async function seed() {
  console.log("Seeding children from config...")
  const config = await getAppConfig()
  for (const name of config.children) {
    await db.insert(children).values({ name }).onConflictDoNothing()
  }
  console.log("Done.")
  process.exit(0)
}

seed().catch((e) => {
  console.error(e)
  process.exit(1)
})
