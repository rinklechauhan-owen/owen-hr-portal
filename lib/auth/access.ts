// Route-level access rules used by the proxy. This is a convenience layer that
// sends people to the right place; the real security boundary is Row Level
// Security plus the role checks in each layout and Server Action.

export const PROTECTED_PREFIXES = ["/employee", "/admin"] as const
export const GUEST_ONLY_PATHS = ["/login", "/forgot-password"] as const

export type AccessDecision = { type: "allow" } | { type: "redirect"; to: string }

function matches(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some((prefix) => matches(pathname, prefix))
}

export function decideRouteAccess(pathname: string, search: string, isSignedIn: boolean): AccessDecision {
  if (!isSignedIn && isProtectedPath(pathname)) {
    const next = `${pathname}${search}`
    return { type: "redirect", to: `/login?next=${encodeURIComponent(next)}` }
  }
  if (isSignedIn && GUEST_ONLY_PATHS.some((path) => matches(pathname, path))) {
    return { type: "redirect", to: "/" }
  }
  return { type: "allow" }
}

/**
 * Only same-site relative paths are allowed as post-login destinations, so a
 * crafted `?next=` link cannot send someone to another website.
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null
  try {
    const url = new URL(next, "http://localhost")
    if (url.origin !== "http://localhost") return null
    const path = `${url.pathname}${url.search}`
    // Normalisation can turn "/.//evil.com" into "//evil.com", which browsers treat
    // as another site, so check the result again.
    if (path.startsWith("//") || path.startsWith("/\\")) return null
    return path
  } catch {
    return null
  }
}

/** Where a signed-in user belongs, optionally honouring a requested page they may open. */
export function homeFor(role: "admin" | "employee", hasEmployeeRecord: boolean, next?: string | null) {
  const target = safeNextPath(next)
  if (target) {
    if (matches(new URL(target, "http://localhost").pathname, "/admin") && role !== "admin") {
      return "/employee"
    }
    if (matches(new URL(target, "http://localhost").pathname, "/employee") && !hasEmployeeRecord) {
      return "/admin"
    }
    return target
  }
  return role === "admin" ? "/admin" : "/employee"
}
