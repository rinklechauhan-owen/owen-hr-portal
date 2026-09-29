import { z } from "zod"

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ message: "NEXT_PUBLIC_SUPABASE_URL must be your Supabase project URL." }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string({ message: "NEXT_PUBLIC_SUPABASE_ANON_KEY is missing." })
    .min(20, "NEXT_PUBLIC_SUPABASE_ANON_KEY is missing."),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
})

let cached: z.infer<typeof publicEnvSchema> | undefined

/**
 * Browser-safe configuration. Each variable is referenced by its full name so
 * Next.js can inline it into client bundles.
 */
export function publicEnv() {
  if (cached) return cached
  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
  })
  if (!parsed.success) {
    throw new Error(
      `Invalid environment configuration: ${parsed.error.issues.map((i) => i.message).join(" ")} ` +
        "Copy .env.example to .env.local and fill in the values from your Supabase project."
    )
  }
  cached = parsed.data
  return cached
}
