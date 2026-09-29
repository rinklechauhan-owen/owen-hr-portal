import { ShieldAlert } from "lucide-react"
import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"

export function AccessDenied({ homeHref = "/" }: { homeHref?: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="max-w-sm space-y-4 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-danger-soft text-destructive" aria-hidden>
          <ShieldAlert className="size-6" />
        </span>
        <h1 className="text-xl font-semibold">You don&apos;t have access to this page</h1>
        <p className="text-sm text-muted-foreground">
          This area is for HR administrators. If you think you should have access, please contact HR.
        </p>
        <Link href={homeHref} className={buttonVariants({ size: "lg" })}>
          Go to my portal
        </Link>
      </div>
    </main>
  )
}
