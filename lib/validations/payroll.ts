import { z } from "zod"

export const MAX_PDF_BYTES = 10 * 1024 * 1024
export const PAYROLL_BUCKET = "payroll-documents"

/** The three payroll document kinds. `slug` is used in URLs and storage folders. */
export const DOCUMENT_KINDS = {
  payslips: { table: "payslips", label: "Payslip", plural: "Payslips", hasMonth: true },
  ytd: { table: "ytd_reports", label: "YTD Report", plural: "YTD Reports", hasMonth: false },
  "pf-ytd": { table: "pf_ytd_reports", label: "PF YTD Report", plural: "PF YTD Reports", hasMonth: false },
} as const

export type DocumentKind = keyof typeof DOCUMENT_KINDS
export const documentKindSchema = z.enum(["payslips", "ytd", "pf-ytd"])

export function isDocumentKind(value: string): value is DocumentKind {
  return Object.hasOwn(DOCUMENT_KINDS, value)
}

export const uploadDetailsSchema = z
  .object({
    employee_id: z.uuid("Choose an employee."),
    kind: documentKindSchema,
    year: z.number({ message: "Choose a year." }).int().min(2000).max(2100),
    month: z.number().int().min(1).max(12).nullable(),
    file_name: z
      .string()
      .trim()
      .min(1, "Choose a PDF file.")
      .max(255, "The file name is too long.")
      .refine((name) => name.toLowerCase().endsWith(".pdf"), "Only PDF files can be uploaded."),
    file_size: z
      .number()
      .int()
      .positive("The file is empty.")
      .max(MAX_PDF_BYTES, "The file must be 10 MB or smaller."),
    replace: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (values.kind === "payslips" && values.month === null) {
      ctx.addIssue({ code: "custom", path: ["month"], message: "Choose the payslip month." })
    }
  })

export type UploadDetails = z.infer<typeof uploadDetailsSchema>

export const finalizeUploadSchema = z.object({
  details: uploadDetailsSchema,
  path: z.string().min(1),
})

/** Client-side file check. The server re-checks size and the PDF signature. */
export function checkPdfFile(file: File | undefined | null): string | null {
  if (!file) return "Choose a PDF file."
  if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) {
    return "Only PDF files can be uploaded."
  }
  if (file.size === 0) return "The file is empty."
  if (file.size > MAX_PDF_BYTES) return "The file must be 10 MB or smaller."
  return null
}

/** True when the bytes start with the PDF signature "%PDF-". */
export function hasPdfSignature(bytes: Uint8Array) {
  const signature = [0x25, 0x50, 0x44, 0x46, 0x2d]
  return signature.every((byte, index) => bytes[index] === byte)
}
