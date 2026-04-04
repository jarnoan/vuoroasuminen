import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as authSchema from "./schema/auth"
import * as domainSchema from "./schema/domain"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export const db = drizzle(pool, {
  schema: { ...authSchema, ...domainSchema },
})
