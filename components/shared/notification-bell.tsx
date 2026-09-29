"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Bell, CheckCheck } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { createClient } from "@/lib/supabase/browser"
import { cn } from "@/lib/utils"
import { formatDateTime } from "@/lib/utils/format"

const QUERY_KEY = ["notifications"] as const

/**
 * Latest notifications for the signed-in user. Reads go straight to Supabase
 * with the user's session; RLS limits them to the user's own rows, and the only
 * column they may change is `is_read`.
 */
export function NotificationBell() {
  const supabase = useMemo(() => createClient(), [])
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  const { data, isPending, isError } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, message, link, is_read, created_at")
        .order("created_at", { ascending: false })
        .limit(15)
      if (error) throw error
      return data
    },
    refetchInterval: 60_000,
  })

  const markRead = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return
      const { error } = await supabase.from("notifications").update({ is_read: true }).in("id", ids)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })

  const unread = data?.filter((n) => !n.is_read) ?? []

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unread.length ? `Notifications, ${unread.length} unread` : "Notifications"}
        >
          <Bell aria-hidden />
          {unread.length > 0 && (
            <span className="absolute top-1.5 right-1.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[0.65rem] leading-4 font-semibold text-white">
              {unread.length > 9 ? "9+" : unread.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {unread.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markRead.mutate(unread.map((n) => n.id))}
              disabled={markRead.isPending}
            >
              <CheckCheck aria-hidden />
              Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {isPending && <p className="px-4 py-6 text-center text-sm text-muted-foreground">Loading…</p>}
          {isError && <p className="px-4 py-6 text-center text-sm text-muted-foreground">Unable to load notifications.</p>}
          {data?.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
          )}
          <ul className="divide-y">
            {data?.map((note) => {
              const body = (
                <div className={cn("flex gap-3 px-4 py-3", !note.is_read && "bg-info-soft/60")}>
                  <span
                    className={cn("mt-1.5 size-2 shrink-0 rounded-full", note.is_read ? "bg-transparent" : "bg-brand")}
                    aria-hidden
                  />
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-medium">
                      {note.title}
                      {!note.is_read && <span className="sr-only"> (unread)</span>}
                    </p>
                    <p className="text-sm text-muted-foreground">{note.message}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(note.created_at)}</p>
                  </div>
                </div>
              )
              const onSelect = () => {
                if (!note.is_read) markRead.mutate([note.id])
                setOpen(false)
              }
              return (
                <li key={note.id}>
                  {note.link ? (
                    <Link href={note.link} onClick={onSelect} className="block hover:bg-muted/60">
                      {body}
                    </Link>
                  ) : (
                    <button type="button" onClick={onSelect} className="block w-full text-left hover:bg-muted/60">
                      {body}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      </PopoverContent>
    </Popover>
  )
}
