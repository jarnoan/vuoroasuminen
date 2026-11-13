import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as domainSchema from "./schema/domain"
import * as tokensSchema from "./schema/tokens"

// Supabase's session-mode pooler allows only a handful of clients (pool_size 15)
// across ALL app instances, so keep each instance's pool small and release idle
// connections quickly.
const POOL_MAX = 5

// In dev, every hot reload re-evaluates this module. Without caching, each reload
// would create a fresh Pool while the old one keeps its connections open, until
// Supabase rejects new clients with EMAXCONNSESSION. Reuse one Pool per process.
const globalForDb = globalThis as unknown as { __vuoroPgPool?: Pool }

function getPool(): Pool {
  if (globalForDb.__vuoroPgPool) return globalForDb.__vuoroPgPool

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Cannot initialise database connection."
    )
  }
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: POOL_MAX,
    idleTimeoutMillis: 10_000,
  })
  globalForDb.__vuoroPgPool = pool
  return pool
}

export const db = drizzle(getPool(), {
  schema: { ...domainSchema, ...tokensSchema },
})
