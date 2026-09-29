import "server-only"

import { createClient } from "@supabase/supabase-js"

import { publicEnv } from "@/lib/env"
import { serverEnv } from "@/lib/env.server"
import type { Database } from "@/types/database"

/**
 * Service-role client. It bypasses Row Level Security, so it is used only for the
 * few things RLS cannot express: managing Auth users (invite, ban, unban) and
 * linking a new login to its employee. Always verify the caller is an admin first.
 * Never import this from a Client Component.
 */
export function createAdminClient() {
  return createClient<Database>(publicEnv().NEXT_PUBLIC_SUPABASE_URL, serverEnv().SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
