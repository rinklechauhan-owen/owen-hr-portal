import {
  BarChart3,
  CalendarDays,
  CalendarRange,
  FileText,
  Home,
  LayoutDashboard,
  type LucideIcon,
  PartyPopper,
  ScrollText,
  Settings,
  UserRound,
  Users,
  Wallet,
} from "lucide-react"

export type NavItem = {
  href: string
  label: string
  shortLabel?: string
  icon: LucideIcon
  /** Paths that also mark this item active (besides its own sub-paths). */
  match?: string[]
  exact?: boolean
}

export const EMPLOYEE_NAV: NavItem[] = [
  { href: "/employee", label: "Dashboard", shortLabel: "Home", icon: Home, exact: true },
  { href: "/employee/leave", label: "Leave", icon: CalendarRange },
  { href: "/employee/calendar", label: "Calendar", icon: CalendarDays, match: ["/employee/holidays"] },
  { href: "/employee/salary", label: "Salary", icon: Wallet },
  { href: "/employee/profile", label: "Profile", icon: UserRound, match: ["/employee/notifications"] },
]

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/employees", label: "Employees", icon: Users },
  { href: "/admin/leave", label: "Leave Management", icon: CalendarRange },
  { href: "/admin/holidays", label: "Holidays", icon: PartyPopper },
  { href: "/admin/payroll", label: "Payroll", icon: FileText },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: ScrollText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
]

export function isNavItemActive(item: NavItem, pathname: string) {
  const paths = [item.href, ...(item.match ?? [])]
  return paths.some((path) =>
    item.exact && path === item.href ? pathname === path : pathname === path || pathname.startsWith(`${path}/`)
  )
}
