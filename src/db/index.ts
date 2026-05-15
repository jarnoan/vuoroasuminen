import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as domainSchema from "./schema/domain"
import * as tokensSchema from "./schema/tokens"

function createDb() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Cannot initialise database connection."
    )
  }
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  })
  return drizzle(pool, {
    schema: { ...domainSchema, ...tokensSchema },
  })
}

export const db = createDb()
