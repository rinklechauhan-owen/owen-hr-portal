import { createBrowserClient } from "@supabase/ssr"

import { publicEnv } from "@/lib/env"
import type { Database } from "@/types/database"

/**
 * Supabase client for Client Components. Runs as the signed-in user, so every
 * query is limited by Row Level Security.
 */
export function createClient() {
  const env = publicEnv()
  return createBrowserClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}
