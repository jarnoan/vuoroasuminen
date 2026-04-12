import "../env" // must be first — loads .env.local before db pool initializes
import { db } from "./index"
import { accounts } from "./schema/auth"

/**
 * Clears all rows from the accounts table, forcing fresh OAuth tokens on next sign-in.
 *
 * Run this when GCal sync fails with invalid_grant after a long period without signing in.
 * After running, both parents must sign in again to populate fresh tokens.
 */
async function clearTokens() {
  console.log("Clearing OAuth tokens from accounts table...")

  await db.delete(accounts)
  console.log("  ✓ accounts cleared")

  console.log("Done. Sign in again to get fresh OAuth tokens.")
  process.exit(0)
}

clearTokens().catch((e) => {
  console.error(e)
  process.exit(1)
})
