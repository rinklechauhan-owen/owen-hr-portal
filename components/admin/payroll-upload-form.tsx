"use client"

import { CheckCircle2, FileUp, UploadCloud } from "lucide-react"
import { useRouter } from "next/navigation"
import { useId, useMemo, useRef, useState, useTransition } from "react"
import { toast } from "sonner"

import { finalizeUpload, prepareUpload } from "@/app/admin/payroll/actions"
import { EmployeeCombobox, type EmployeeOption } from "@/components/admin/employee-combobox"
import { FormAlert } from "@/components/forms/form-alert"
import { SubmitButton } from "@/components/shared/submit-button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Field, FieldDescription, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@/lib/supabase/browser"
import { cn } from "@/lib/utils"
import { financialYearLabel, formatFileSize, MONTHS, payslipPeriod } from "@/lib/utils/format"
import { checkPdfFile, DOCUMENT_KINDS, type DocumentKind, PAYROLL_BUCKET, type UploadDetails } from "@/lib/validations/payroll"

type Errors = Partial<Record<"employee" | "month" | "file", string>>

export function PayrollUploadForm({
  currentYear,
  currentMonth,
  defaultKind = "payslips",
  defaultEmployee,
}: {
  currentYear: number
  currentMonth: number
  defaultKind?: DocumentKind
  defaultEmployee?: EmployeeOption
}) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const fileInput = useRef<HTMLInputElement>(null)
  const ids = { employee: useId(), year: useId(), month: useId(), file: useId() }

  const [employee, setEmployee] = useState<EmployeeOption | null>(defaultEmployee ?? null)
  const [kind, setKind] = useState<DocumentKind>(defaultKind)
  const hasMonth = DOCUMENT_KINDS[kind].hasMonth
  const currentFy = currentMonth >= 4 ? currentYear : currentYear - 1
  const [year, setYear] = useState(hasMonth ? currentYear : currentFy)
  const [month, setMonth] = useState(currentMonth)
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [error, setError] = useState<string | null>(null)
  const [stage, setStage] = useState<"idle" | "uploading" | "saving">("idle")
  const [conflict, setConflict] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const baseYear = hasMonth ? currentYear : currentFy
  const years = [baseYear + 1, baseYear, baseYear - 1, baseYear - 2, baseYear - 3]
  const period = hasMonth ? payslipPeriod(year, month) : financialYearLabel(year)

  function chooseKind(next: DocumentKind) {
    setKind(next)
    setYear(DOCUMENT_KINDS[next].hasMonth ? currentYear : currentFy)
  }

  function chooseFile(next: File | null | undefined) {
    setFile(next ?? null)
    setErrors((e) => ({ ...e, file: next ? (checkPdfFile(next) ?? undefined) : undefined }))
    setDone(null)
  }

  function validate(): Errors {
    const next: Errors = {}
    if (!employee) next.employee = "Choose an employee."
    if (hasMonth && !month) next.month = "Choose the payslip month."
    const fileProblem = checkPdfFile(file)
    if (fileProblem) next.file = fileProblem
    return next
  }

  function upload(replace: boolean) {
    const found = validate()
    setErrors(found)
    setError(null)
    if (Object.keys(found).length || !employee || !file) return

    const details: UploadDetails = {
      employee_id: employee.id,
      kind,
      year,
      month: hasMonth ? month : null,
      file_name: file.name,
      file_size: file.size,
      replace,
    }

    startTransition(async () => {
      const prepared = await prepareUpload(details)
      if (!prepared.ok) return setError(prepared.error)
      if (prepared.data.conflict) return setConflict(prepared.data.existingFileName)

      setStage("uploading")
      const { error: uploadError } = await supabase.storage
        .from(PAYROLL_BUCKET)
        .uploadToSignedUrl(prepared.data.path, prepared.data.token, file, { contentType: "application/pdf" })
      if (uploadError) {
        setStage("idle")
        return setError("The file could not be uploaded. Check your connection and try again.")
      }

      setStage("saving")
      const result = await finalizeUpload({ details, path: prepared.data.path })
      setStage("idle")
      if (!result.ok) return setError(result.error)

      toast.success(result.message)
      setDone(`${DOCUMENT_KINDS[kind].label} for ${employee.label}, ${period}, is now available to them.`)
      setFile(null)
      if (fileInput.current) fileInput.current.value = ""
      router.refresh()
    })
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        upload(false)
      }}
      className="space-y-6"
    >
      <FormAlert message={error} />
      <FormAlert message={done} tone="success" />

      <Field data-invalid={Boolean(errors.employee)}>
        <FieldLabel htmlFor={ids.employee}>1. Employee</FieldLabel>
        <EmployeeCombobox
          id={ids.employee}
          value={employee?.id ?? null}
          selectedLabel={employee?.label}
          invalid={Boolean(errors.employee)}
          onSelect={(next) => {
            setEmployee(next)
            setErrors((e) => ({ ...e, employee: undefined }))
            setDone(null)
          }}
        />
        <FieldError>{errors.employee}</FieldError>
      </Field>

      <FieldSet>
        <FieldLegend variant="label">2. Document type</FieldLegend>
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Document type">
          {(Object.keys(DOCUMENT_KINDS) as DocumentKind[]).map((option) => (
            <label
              key={option}
              className={cn(
                "flex h-11 cursor-pointer items-center gap-2.5 rounded-lg border bg-card px-3 text-sm font-medium",
                "has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                kind === option && "border-primary/40 bg-secondary text-primary"
              )}
            >
              <input
                type="radio"
                name="kind"
                value={option}
                checked={kind === option}
                onChange={() => chooseKind(option)}
                className="accent-primary"
              />
              {DOCUMENT_KINDS[option].label}
            </label>
          ))}
        </div>
      </FieldSet>

      <FieldSet>
        <FieldLegend variant="label">3. Period</FieldLegend>
        <div className="grid gap-3 sm:grid-cols-2">
          {hasMonth && (
            <Field data-invalid={Boolean(errors.month)}>
              <FieldLabel htmlFor={ids.month} className="sr-only">Month</FieldLabel>
              <Select value={String(month)} onValueChange={(value) => setMonth(Number(value))}>
                <SelectTrigger id={ids.month} className="w-full" aria-label="Month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((name, index) => (
                    <SelectItem key={name} value={String(index + 1)}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError>{errors.month}</FieldError>
            </Field>
          )}
          <Field>
            <FieldLabel htmlFor={ids.year} className="sr-only">{hasMonth ? "Year" : "Financial year"}</FieldLabel>
            <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
              <SelectTrigger id={ids.year} className="w-full" aria-label={hasMonth ? "Year" : "Financial year"}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>{hasMonth ? y : financialYearLabel(y)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!hasMonth && <FieldDescription>April {year} to March {year + 1}.</FieldDescription>}
          </Field>
        </div>
      </FieldSet>

      <Field data-invalid={Boolean(errors.file)}>
        <FieldLabel htmlFor={ids.file}>4. PDF file</FieldLabel>
        <label
          htmlFor={ids.file}
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            chooseFile(event.dataTransfer.files?.[0])
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-card px-4 py-8 text-center",
            "has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
            dragging && "border-brand bg-info-soft",
            errors.file && "border-destructive/50"
          )}
        >
          {file ? <FileUp className="size-6 text-primary" aria-hidden /> : <UploadCloud className="size-6 text-muted-foreground" aria-hidden />}
          {file ? (
            <span className="text-sm">
              <span className="font-medium">{file.name}</span>
              <span className="text-muted-foreground"> · {formatFileSize(file.size)}</span>
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">
              <span className="font-medium text-brand">Choose a PDF</span> or drag it here · up to 10 MB
            </span>
          )}
          <input
            ref={fileInput}
            id={ids.file}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={(event) => chooseFile(event.target.files?.[0])}
          />
        </label>
        <FieldError>{errors.file}</FieldError>
      </Field>

      <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {employee ? (
            <>
              <CheckCircle2 className="mr-1 inline size-4 text-success" aria-hidden />
              {DOCUMENT_KINDS[kind].label} · {period} · {employee.label}
            </>
          ) : (
            "Files are stored privately. Only the employee and HR admins can open them."
          )}
        </p>
        <SubmitButton
          pending={pending}
          pendingLabel={stage === "uploading" ? "Uploading…" : stage === "saving" ? "Checking and saving…" : "Validating…"}
        >
          Upload document
        </SubmitButton>
      </div>

      <AlertDialog open={conflict !== null} onOpenChange={(open) => !open && setConflict(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace the existing document?</AlertDialogTitle>
            <AlertDialogDescription>
              {employee?.label} already has a {DOCUMENT_KINDS[kind].label.toLowerCase()} for {period} ({conflict}). Replacing it removes
              the old file.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep existing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConflict(null)
                upload(true)
              }}
            >
              Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  )
}
