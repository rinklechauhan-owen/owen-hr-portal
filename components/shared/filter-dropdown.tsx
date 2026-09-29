"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSearchParamsUpdater } from "@/hooks/use-search-params-updater"
import { cn } from "@/lib/utils"

// Radix Select cannot use "" as an item value, so "all" stands for "no filter".
const ALL = "__all__"

export function FilterDropdown({
  param,
  label,
  options,
  allLabel = "All",
  defaultValue = "",
  className,
}: {
  param: string
  label: string
  options: { value: string; label: string }[]
  allLabel?: string
  /** Value used when the URL has no entry for this param. */
  defaultValue?: string
  className?: string
}) {
  const { update, searchParams } = useSearchParamsUpdater()
  const raw = searchParams.get(param)
  const value = raw === null ? defaultValue : raw === "all" ? "" : raw

  return (
    <Select
      value={value === "" ? ALL : value}
      onValueChange={(next) => {
        const selected = next === ALL ? "" : next
        // Store an explicit "all" when the default is a specific value.
        update({ [param]: selected === defaultValue ? null : selected === "" ? "all" : selected })
      }}
    >
      <SelectTrigger aria-label={label} className={cn("w-full sm:w-44", className)}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
