import "server-only"

import { z } from "zod"

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z
    .string({ message: "SUPABASE_SERVICE_ROLE_KEY is missing." })
    .min(20, "SUPABASE_SERVICE_ROLE_KEY is missing."),
})

/** Server-only secrets. Importing this file from a Client Component fails the build. */
export function serverEnv() {
  const parsed = serverEnvSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  })
  if (!parsed.success) {
    throw new Error(
      `Invalid server configuration: ${parsed.error.issues.map((i) => i.message).join(" ")} ` +
        "Add it to .env.local (never to a NEXT_PUBLIC_ variable)."
    )
  }
  return parsed.data
}
