import { defineConfig } from "drizzle-kit"
import { config } from "dotenv"

config({ path: ".env.local" })

export default defineConfig({
  schema: "./src/db/schema/*.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // Policies reference Supabase's built-in roles (anon, authenticated, ...);
  // never try to create or drop them.
  entities: {
    roles: { provider: "supabase" },
  },
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
