import { Download, Eye, FileText } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { DocumentKind } from "@/lib/validations/payroll"

export function documentHref(kind: DocumentKind, id: string, download = false) {
  return `/api/documents/${kind}/${id}${download ? "?download=1" : ""}`
}

/** View opens the PDF in a new tab; Download saves it. Both go through the secure route. */
export function DocumentActions({ kind, id, title, compact = false }: { kind: DocumentKind; id: string; title: string; compact?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <a
        href={documentHref(kind, id)}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonVariants({ variant: "outline", size: compact ? "sm" : "default" })}
        aria-label={`View ${title} (opens in a new tab)`}
      >
        <Eye aria-hidden />
        View
      </a>
      <a
        href={documentHref(kind, id, true)}
        className={buttonVariants({ variant: "ghost", size: compact ? "sm" : "default" })}
        aria-label={`Download ${title}`}
      >
        <Download aria-hidden />
        <span className="hidden sm:inline">Download</span>
      </a>
    </div>
  )
}

export function DocumentCard({
  kind,
  id,
  title,
  subtitle,
  className,
}: {
  kind: DocumentKind
  id: string
  title: string
  subtitle?: string
  className?: string
}) {
  return (
    <div className={cn("flex items-center gap-3 rounded-xl border bg-card p-3 shadow-card sm:p-4", className)}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary" aria-hidden>
        <FileText className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{title}</p>
        {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <DocumentActions kind={kind} id={id} title={title} />
    </div>
  )
}
