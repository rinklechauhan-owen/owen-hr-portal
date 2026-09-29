import { CalendarCheck, FileText, ShieldCheck } from "lucide-react"

import { Brand } from "@/components/shared/brand"

const POINTS = [
  { icon: CalendarCheck, text: "Apply for leave and track approvals" },
  { icon: FileText, text: "Payslips, YTD and PF reports in one place" },
  { icon: ShieldCheck, text: "Private to you, secured by your company" },
]

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden flex-col justify-between bg-primary p-10 text-white lg:flex">
        <Brand subtitle="Owen Media" inverted />
        <div className="max-w-md space-y-6">
          <h2 className="text-3xl leading-tight font-semibold text-balance">
            Your leave, holidays and payroll documents, all in one place.
          </h2>
          <ul className="space-y-3 text-white/85">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-lg bg-white/10" aria-hidden>
                  <Icon className="size-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-white/60">Having trouble signing in? Contact the HR team.</p>
      </aside>

      <main className="flex flex-col px-5 py-8 sm:px-8">
        <Brand subtitle="Owen Media" className="lg:hidden" />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </main>
    </div>
  )
}
