"use client"

import { Menu } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"

import { Brand } from "@/components/shared/brand"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { ADMIN_NAV, isNavItemActive } from "@/lib/navigation"

function NavLinks({ pendingLeave, onNavigate }: { pendingLeave: number; onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <ul className="space-y-0.5">
      {ADMIN_NAV.map((item) => {
        const active = isNavItemActive(item, pathname)
        const Icon = item.icon
        const badge = item.href === "/admin/leave" && pendingLeave > 0 ? pendingLeave : null
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                active && "bg-secondary text-primary hover:bg-secondary hover:text-primary"
              )}
            >
              <Icon className="size-4.5" aria-hidden />
              <span className="flex-1">{item.label}</span>
              {badge && (
                <span className="rounded-full bg-warning-soft px-2 text-xs font-semibold text-warning tabular-nums">
                  {badge}
                  <span className="sr-only"> pending</span>
                </span>
              )}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

export function AdminSidebar({ pendingLeave }: { pendingLeave: number }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-sidebar lg:flex">
      <div className="flex h-16 items-center border-b px-5">
        <Link href="/admin" className="rounded-lg" aria-label="Admin dashboard">
          <Brand subtitle="Admin Portal" />
        </Link>
      </div>
      <nav aria-label="Admin" className="flex-1 overflow-y-auto p-3">
        <NavLinks pendingLeave={pendingLeave} />
      </nav>
    </aside>
  )
}

export function AdminMobileNav({ pendingLeave }: { pendingLeave: number }) {
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
          <Menu aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetTitle className="sr-only">Admin menu</SheetTitle>
        <div className="flex h-16 items-center border-b px-5">
          <Brand subtitle="Admin Portal" />
        </div>
        <nav aria-label="Admin" className="p-3">
          <NavLinks pendingLeave={pendingLeave} onNavigate={() => setOpen(false)} />
        </nav>
      </SheetContent>
    </Sheet>
  )
}
