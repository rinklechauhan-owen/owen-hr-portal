import { ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"

export function YearSwitcher({ year, hrefFor, label = "Year" }: { year: number; hrefFor: (year: number) => string; label?: string }) {
  return (
    <nav aria-label={label} className="flex items-center gap-1">
      <Link href={hrefFor(year - 1)} className={buttonVariants({ variant: "outline", size: "icon" })} aria-label={`Previous year, ${year - 1}`} scroll={false}>
        <ChevronLeft aria-hidden />
      </Link>
      <span className="min-w-14 text-center text-sm font-semibold tabular-nums" aria-live="polite">
        {year}
      </span>
      <Link href={hrefFor(year + 1)} className={buttonVariants({ variant: "outline", size: "icon" })} aria-label={`Next year, ${year + 1}`} scroll={false}>
        <ChevronRight aria-hidden />
      </Link>
    </nav>
  )
}
