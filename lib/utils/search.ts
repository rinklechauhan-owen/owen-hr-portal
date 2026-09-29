/**
 * Makes user search text safe to embed in a PostgREST `or=(...)` filter: removes
 * the characters that filter syntax uses (commas, parentheses, wildcards, quotes).
 */
export function sanitizeSearchTerm(input: string) {
  return input.replace(/[,()*%\\"':.]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100)
}

/** One `or` filter per word, so "asha nair" matches first name AND last name. */
export function searchFilters(input: string, columns: string[]) {
  return sanitizeSearchTerm(input)
    .split(" ")
    .filter(Boolean)
    .slice(0, 5)
    .map((word) => columns.map((column) => `${column}.ilike.%${word}%`).join(","))
}
