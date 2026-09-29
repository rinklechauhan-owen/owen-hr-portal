"use client"

import { Input } from "@/components/ui/input"
import { useSearchParamsUpdater } from "@/hooks/use-search-params-updater"

export function DateRangeFilter({ fromParam = "from", toParam = "to" }: { fromParam?: string; toParam?: string }) {
  const { update, searchParams } = useSearchParamsUpdater()
  const from = searchParams.get(fromParam) ?? ""
  const to = searchParams.get(toParam) ?? ""

  return (
    <fieldset className="flex w-full items-center gap-2 sm:w-auto">
      <legend className="sr-only">Date range</legend>
      <label className="sr-only" htmlFor="filter-from">
        From date
      </label>
      <Input
        id="filter-from"
        type="date"
        value={from}
        max={to || undefined}
        onChange={(event) => update({ [fromParam]: event.target.value || null })}
        className="sm:w-40"
      />
      <span className="text-sm text-muted-foreground" aria-hidden>
        to
      </span>
      <label className="sr-only" htmlFor="filter-to">
        To date
      </label>
      <Input
        id="filter-to"
        type="date"
        value={to}
        min={from || undefined}
        onChange={(event) => update({ [toParam]: event.target.value || null })}
        className="sm:w-40"
      />
    </fieldset>
  )
}
