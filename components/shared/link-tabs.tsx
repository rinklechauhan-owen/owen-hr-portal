import Link from "next/link"

import { cn } from "@/lib/utils"

/**
 * Tabs that are plain links, so each tab is a server-rendered URL that can be
 * bookmarked and works without JavaScript.
 */
export function LinkTabs({
  tabs,
  active,
  label,
}: {
  tabs: { value: string; label: string; href: string; count?: number }[]
  active: string
  label: string
}) {
  return (
    <nav aria-label={label} className="-mx-4 mb-6 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1">
        {tabs.map((tab) => {
          const isActive = tab.value === active
          return (
            <li key={tab.value}>
              <Link
                href={tab.href}
                scroll={false}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex h-11 items-center gap-2 border-b-2 border-transparent px-3 text-sm font-medium text-muted-foreground hover:text-foreground",
                  isActive && "border-primary text-foreground"
                )}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground tabular-nums">{tab.count}</span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
