import { cn } from "@/lib/utils"

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground",
        className
      )}
      aria-hidden
    >
      O
    </span>
  )
}

export function Brand({ subtitle, className, inverted = false }: { subtitle?: string; className?: string; inverted?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <BrandMark className={inverted ? "bg-white text-primary" : undefined} />
      <span className="flex flex-col leading-tight">
        <span className={cn("text-[0.95rem] font-semibold", inverted ? "text-white" : "text-foreground")}>Owen HR</span>
        {subtitle && (
          <span className={cn("text-xs", inverted ? "text-white/70" : "text-muted-foreground")}>{subtitle}</span>
        )}
      </span>
    </span>
  )
}
