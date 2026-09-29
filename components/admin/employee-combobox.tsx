"use client"

import { useQuery } from "@tanstack/react-query"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useSearchParamsUpdater } from "@/hooks/use-search-params-updater"
import { createClient } from "@/lib/supabase/browser"
import { cn } from "@/lib/utils"
import { searchFilters } from "@/lib/utils/search"

export type EmployeeOption = { id: string; label: string; code: string }

/** Searchable employee picker. Queries run in the browser as the admin, under RLS. */
export function EmployeeCombobox({
  value,
  selectedLabel,
  onSelect,
  placeholder = "Choose an employee",
  activeOnly = false,
  id,
  invalid,
  className,
}: {
  value: string | null
  selectedLabel?: string | null
  onSelect: (employee: EmployeeOption | null) => void
  placeholder?: string
  activeOnly?: boolean
  id?: string
  invalid?: boolean
  className?: string
}) {
  const supabase = useMemo(() => createClient(), [])
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [term, setTerm] = useState("")

  useEffect(() => {
    const timer = setTimeout(() => setTerm(search), 250)
    return () => clearTimeout(timer)
  }, [search])

  const results = useQuery({
    queryKey: ["employee-search", term, activeOnly],
    enabled: open,
    queryFn: async () => {
      let query = supabase
        .from("employees")
        .select("id, employee_code, first_name, last_name, status")
        .order("first_name")
        .limit(20)
      if (activeOnly) query = query.eq("status", "active")
      for (const filter of searchFilters(term, ["first_name", "last_name", "employee_code", "email"])) {
        query = query.or(filter)
      }
      const { data, error } = await query
      if (error) throw error
      return data.map((e) => ({
        id: e.id,
        code: e.employee_code,
        label: `${e.first_name} ${e.last_name}${e.status === "inactive" ? " (disabled)" : ""}`,
      }))
    },
  })

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid}
          className={cn("w-full justify-between bg-card font-normal", !value && "text-muted-foreground", className)}
        >
          <span className="truncate">{value ? (selectedLabel ?? "Selected employee") : placeholder}</span>
          <ChevronsUpDown className="opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(22rem,calc(100vw-2rem))] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={search} onValueChange={setSearch} placeholder="Search name, ID or email" />
          <CommandList>
            {results.isFetching && !results.data && <p className="py-6 text-center text-sm text-muted-foreground">Searching…</p>}
            {results.isError && <p className="py-6 text-center text-sm text-muted-foreground">Unable to search right now.</p>}
            {results.data && <CommandEmpty>No employees found.</CommandEmpty>}
            <CommandGroup>
              {results.data?.map((employee) => (
                <CommandItem
                  key={employee.id}
                  value={employee.id}
                  onSelect={() => {
                    onSelect(employee)
                    setOpen(false)
                  }}
                >
                  <Check className={cn(value === employee.id ? "opacity-100" : "opacity-0")} aria-hidden />
                  <span className="flex-1 truncate">{employee.label}</span>
                  <span className="font-mono text-xs text-muted-foreground">{employee.code}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/** Employee filter bound to the `employee` URL param. */
export function EmployeeFilter({ selectedLabel }: { selectedLabel: string | null }) {
  const { update, searchParams } = useSearchParamsUpdater()
  const value = searchParams.get("employee")
  return (
    <div className="flex w-full items-center gap-1 sm:w-56">
      <EmployeeCombobox
        value={value}
        selectedLabel={selectedLabel}
        placeholder="All employees"
        onSelect={(employee) => update({ employee: employee?.id ?? null })}
      />
      {value && (
        <Button variant="ghost" size="icon" onClick={() => update({ employee: null })} aria-label="Clear employee filter">
          <X aria-hidden />
        </Button>
      )}
    </div>
  )
}
