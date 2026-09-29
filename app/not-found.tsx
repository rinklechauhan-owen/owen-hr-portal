import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="max-w-sm space-y-4 text-center">
        <p className="text-sm font-semibold text-brand">404</p>
        <h1 className="text-xl font-semibold">Page not found</h1>
        <p className="text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist, or you don&apos;t have access to it.
        </p>
        <Link href="/" className={buttonVariants({ size: "lg" })}>
          Go to my portal
        </Link>
      </div>
    </main>
  )
}
