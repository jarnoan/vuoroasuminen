import { pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const userGoogleTokens = pgTable("user_google_tokens", {
  email: text("email").primaryKey(),
  refreshToken: text("refresh_token").notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
})
