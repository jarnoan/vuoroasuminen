import { createClient } from "@supabase/supabase-js"

let client: ReturnType<typeof createClient> | null = null

export function createBrowserClient() {
  if (client) return client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  client = createClient(url, anonKey, {
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  })

  return client
}
