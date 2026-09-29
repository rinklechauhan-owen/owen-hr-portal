import { ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const PAGE_SIZE = 20

/** Supabase range() bounds for a 1-based page. */
export function pageRange(page: number, pageSize = PAGE_SIZE) {
  const from = (Math.max(page, 1) - 1) * pageSize
  return { from, to: from + pageSize - 1 }
}

function hrefFor(basePath: string, params: Record<string, string | undefined>, page: number) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "page") query.set(key, value)
  }
  if (page > 1) query.set("page", String(page))
  const text = query.toString()
  return text ? `${basePath}?${text}` : basePath
}

export function Pagination({
  basePath,
  params,
  page,
  total,
  pageSize = PAGE_SIZE,
}: {
  basePath: string
  params: Record<string, string | undefined>
  page: number
  total: number
  pageSize?: number
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total === 0) return null
  const first = (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)

  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3 text-sm">
      <p className="text-muted-foreground">
        Showing <span className="font-medium text-foreground tabular-nums">{first}–{last}</span> of{" "}
        <span className="font-medium text-foreground tabular-nums">{total}</span>
      </p>
      {pages > 1 && (
        <div className="flex items-center gap-2">
          <PageLink href={hrefFor(basePath, params, page - 1)} disabled={page <= 1} label="Previous page">
            <ChevronLeft aria-hidden />
            <span className="hidden sm:inline">Previous</span>
          </PageLink>
          <span className="tabular-nums text-muted-foreground" aria-current="page">
            {page} / {pages}
          </span>
          <PageLink href={hrefFor(basePath, params, page + 1)} disabled={page >= pages} label="Next page">
            <span className="hidden sm:inline">Next</span>
            <ChevronRight aria-hidden />
          </PageLink>
        </div>
      )}
    </nav>
  )
}

function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string
  disabled: boolean
  label: string
  children: React.ReactNode
}) {
  const className = cn(buttonVariants({ variant: "outline", size: "default" }), disabled && "pointer-events-none opacity-50")
  if (disabled) {
    return (
      <span className={className} aria-disabled="true" aria-label={label}>
        {children}
      </span>
    )
  }
  return (
    <Link href={href} className={className} aria-label={label} scroll={false}>
      {children}
    </Link>
  )
}
