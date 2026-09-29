"use client"

import { ArrowLeftRight, LogOut, UserRound } from "lucide-react"
import Link from "next/link"

import { signOut } from "@/app/(auth)/actions"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { initials } from "@/lib/utils/format"

export function UserMenu({
  name,
  email,
  profileHref,
  switchTo,
}: {
  name: string
  email: string
  profileHref?: string
  switchTo?: { href: string; label: string }
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label={`Account menu for ${name}`}>
          <Avatar className="size-8">
            <AvatarFallback className="bg-secondary text-xs font-semibold text-primary">{initials(name)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium text-foreground">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {profileHref && (
          <DropdownMenuItem asChild>
            <Link href={profileHref}>
              <UserRound aria-hidden />
              My profile
            </Link>
          </DropdownMenuItem>
        )}
        {switchTo && (
          <DropdownMenuItem asChild>
            <Link href={switchTo.href}>
              <ArrowLeftRight aria-hidden />
              {switchTo.label}
            </Link>
          </DropdownMenuItem>
        )}
        {(profileHref || switchTo) && <DropdownMenuSeparator />}
        <form action={signOut}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOut aria-hidden />
              Log out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
