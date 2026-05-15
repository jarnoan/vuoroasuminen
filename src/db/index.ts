import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as domainSchema from "./schema/domain"
import * as tokensSchema from "./schema/tokens"

function createDb() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  return drizzle(pool, {
    schema: { ...domainSchema, ...tokensSchema },
  })
}

export const db = createDb()
