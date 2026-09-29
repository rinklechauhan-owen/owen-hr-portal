/** Flattens Next.js searchParams into single string values (first value wins). */
export function flattenParams(params: Record<string, string | string[] | undefined>) {
  const flat: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(params)) {
    flat[key] = Array.isArray(value) ? value[0] : value
  }
  return flat
}
