import Link from "next/link"

import { EmployeeBottomNav, EmployeeTopNav } from "@/components/employee/employee-nav"
import { Brand } from "@/components/shared/brand"
import { NotificationBell } from "@/components/shared/notification-bell"
import { UserMenu } from "@/components/shared/user-menu"
import { displayName } from "@/lib/auth/session"
import { requireEmployee } from "@/lib/permissions"

export default async function EmployeeLayout({ children }: LayoutProps<"/employee">) {
  // Server-side check on every request; RLS enforces the same rules on the data.
  const session = await requireEmployee()
  const name = displayName(session)

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-card px-3 py-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/employee" className="rounded-lg" aria-label="Owen HR home">
            <Brand subtitle="Employee Portal" />
          </Link>
          <EmployeeTopNav />
          <div className="flex items-center gap-1">
            <NotificationBell />
            <UserMenu
              name={name}
              email={session.profile.email}
              profileHref="/employee/profile"
              switchTo={session.profile.role === "admin" ? { href: "/admin", label: "Go to Admin Portal" } : undefined}
            />
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-5xl px-4 pt-6 pb-28 sm:px-6 md:pt-8 md:pb-12">
        {children}
      </main>
      <EmployeeBottomNav />
    </div>
  )
}
