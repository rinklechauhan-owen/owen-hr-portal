import { Bell } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { Pagination, pageRange } from "@/components/shared/pagination"
import { requireEmployee } from "@/lib/permissions"
import { getSettings } from "@/lib/queries/reference"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"
import { formatDateTime } from "@/lib/utils/format"
import { flattenParams } from "@/lib/utils/params"

export const metadata: Metadata = { title: "Notifications" }

export default async function NotificationsPage({ searchParams }: PageProps<"/employee/notifications">) {
  await requireEmployee()
  const params = flattenParams(await searchParams)
  const page = Math.max(1, Number(params.page) || 1)
  const { from, to } = pageRange(page)
  const settings = await getSettings()
  const supabase = await createClient()
  // RLS returns only the signed-in user's notifications.
  const { data, count, error } = await supabase
    .from("notifications")
    .select("id, title, message, link, is_read, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to)
  if (error) throw error

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Notifications" backHref="/employee/profile" backLabel="Profile" />
      {data?.length ? (
        <>
          <ul className="divide-y rounded-xl border bg-card shadow-card">
            {data.map((note) => {
              const body = (
                <div className={cn("flex gap-3 px-4 py-3.5", !note.is_read && "bg-info-soft/60")}>
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", note.is_read ? "bg-border" : "bg-brand")} aria-hidden />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {note.title}
                      {!note.is_read && <span className="sr-only"> (unread)</span>}
                    </p>
                    <p className="text-sm text-muted-foreground">{note.message}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(note.created_at, settings.timezone)}</p>
                  </div>
                </div>
              )
              return <li key={note.id}>{note.link ? <Link href={note.link} className="block hover:bg-muted/50">{body}</Link> : body}</li>
            })}
          </ul>
          <Pagination basePath="/employee/notifications" params={params} page={page} total={count ?? 0} />
        </>
      ) : (
        <EmptyState icon={Bell} title="No notifications yet" description="Updates about your leave, payslips and holidays will appear here." />
      )}
    </div>
  )
}
