// Re-export from @supabase/ssr so callers get a cookie-aware Supabase client.
// Callers must pass (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY).
// @supabase/ssr handles its own internal caching — no singleton guard needed.
// Required for RLS-04: Realtime must connect with the authenticated session JWT,
// not as the anon role.
export { createBrowserClient } from "@supabase/ssr"
