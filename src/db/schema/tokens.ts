import { sql } from "drizzle-orm"
import { pgTable, pgPolicy, text, timestamp } from "drizzle-orm/pg-core"
import { authenticatedRole } from "drizzle-orm/supabase"

// Per-user isolation by JWT email claim (D-08). /auth/callback upserts the caller's own
// row through the Supabase API (needs SELECT + INSERT + UPDATE), before invite redemption,
// so these policies must not depend on family_config. No DELETE policy: token rows are
// never deleted through the API. See the RLS note in ./domain.ts.
const ownEmail = sql`(auth.jwt() ->> 'email') = email`

export const userGoogleTokens = pgTable("user_google_tokens", {
  email: text("email").primaryKey(),
  refreshToken: text("refresh_token").notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
}, () => [
  pgPolicy("user can select own token", { for: "select", to: authenticatedRole, using: ownEmail }),
  pgPolicy("user can insert own token", { for: "insert", to: authenticatedRole, withCheck: ownEmail }),
  pgPolicy("user can update own token", { for: "update", to: authenticatedRole, using: ownEmail, withCheck: ownEmail }),
])
