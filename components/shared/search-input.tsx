"use client"

import { Loader2, Search } from "lucide-react"
import { useEffect, useState } from "react"

import { Input } from "@/components/ui/input"
import { useSearchParamsUpdater } from "@/hooks/use-search-params-updater"
import { cn } from "@/lib/utils"

export function SearchInput({
  param = "q",
  placeholder = "Search",
  label = "Search",
  className,
}: {
  param?: string
  placeholder?: string
  label?: string
  className?: string
}) {
  const { update, pending, searchParams } = useSearchParamsUpdater()
  const current = searchParams.get(param) ?? ""
  const [value, setValue] = useState(current)
  const [syncedWith, setSyncedWith] = useState(current)

  // Keep the box in step with back/forward navigation.
  if (current !== syncedWith) {
    setSyncedWith(current)
    if (value.trim() !== current) setValue(current)
  }

  useEffect(() => {
    if (value.trim() === current) return
    const timer = setTimeout(() => update({ [param]: value.trim() || null }), 350)
    return () => clearTimeout(timer)
  }, [value, current, param, update])

  return (
    <div className={cn("relative w-full sm:max-w-xs", className)}>
      <label className="sr-only" htmlFor={`search-${param}`}>
        {label}
      </label>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        id={`search-${param}`}
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        className="pl-9"
        maxLength={100}
      />
      {pending && (
        <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />
      )}
    </div>
  )
}
