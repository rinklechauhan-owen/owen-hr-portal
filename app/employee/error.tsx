"use client"

import { RouteError } from "@/components/shared/error-state"

export default function EmployeeError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <RouteError reset={retry} />
}
