import { AdminMobileNav, AdminSidebar } from "@/components/admin/admin-nav"
import { AccessDenied } from "@/components/shared/access-denied"
import { Brand } from "@/components/shared/brand"
import { UserMenu } from "@/components/shared/user-menu"
import { displayName } from "@/lib/auth/session"
import { isAdmin, requireSession } from "@/lib/permissions"
import { createClient } from "@/lib/supabase/server"

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  // Server-side role check. RLS independently blocks non-admins from admin data.
  const session = await requireSession()
  if (!isAdmin(session)) return <AccessDenied homeHref="/employee" />

  const supabase = await createClient()
  const { count } = await supabase
    .from("leave_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
  const pendingLeave = count ?? 0

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-card px-3 py-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <AdminSidebar pendingLeave={pendingLeave} />
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b bg-card/95 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2">
            <AdminMobileNav pendingLeave={pendingLeave} />
            <Brand subtitle="Admin Portal" className="lg:hidden" />
          </div>
          <UserMenu
            name={displayName(session)}
            email={session.profile.email}
            switchTo={session.employee ? { href: "/employee", label: "Go to my Employee Portal" } : undefined}
          />
        </header>
        <main id="main" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  )
}
