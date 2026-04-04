import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as authSchema from "./schema/auth"
import * as domainSchema from "./schema/domain"

function createDb() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  return drizzle(pool, {
    schema: { ...authSchema, ...domainSchema },
  })
}

export const db = createDb()
