"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { findExistingDocument, isPathForDetails, removeStoredFile, storagePathFor, tableFor, verifyStoredPdf } from "@/lib/payroll"
import { authorizeAdmin } from "@/lib/permissions"
import { createClient } from "@/lib/supabase/server"
import { fail, invalid, logServerError } from "@/lib/utils/errors"
import { DOCUMENT_KINDS, documentKindSchema, finalizeUploadSchema, PAYROLL_BUCKET, type UploadDetails, uploadDetailsSchema } from "@/lib/validations/payroll"
import type { ActionResult } from "@/types/actions"

type Prepared = { conflict: false; path: string; token: string } | { conflict: true; existingFileName: string }

function refresh(employeeId: string) {
  revalidatePath("/admin/payroll", "layout")
  revalidatePath(`/admin/employees/${employeeId}`)
  revalidatePath("/employee/salary", "layout")
}

/**
 * Step 1: validate the details and issue a one-time signed upload URL for a path
 * the server chooses. All storage calls use the admin's own session, so the
 * storage RLS policies apply. No service-role key is involved.
 */
export async function prepareUpload(input: UploadDetails): Promise<ActionResult<Prepared>> {
  try {
    await authorizeAdmin()
    const parsed = uploadDetailsSchema.safeParse(input)
    if (!parsed.success) return invalid(parsed.error)
    const details = parsed.data

    const supabase = await createClient()
    const { data: employee } = await supabase.from("employees").select("id").eq("id", details.employee_id).maybeSingle()
    if (!employee) return { ok: false, error: "Choose an employee." }

    const existing = await findExistingDocument(supabase, details)
    if (existing && !details.replace) {
      return { ok: true, data: { conflict: true, existingFileName: existing.file_name } }
    }

    const path = storagePathFor(details)
    const { data, error } = await supabase.storage.from(PAYROLL_BUCKET).createSignedUploadUrl(path)
    if (error || !data) return fail(error, "create upload url")
    return { ok: true, data: { conflict: false, path: data.path, token: data.token } }
  } catch (error) {
    return fail(error, "prepare upload")
  }
}

/**
 * Step 3 (after the browser uploaded the file): verify the stored file, then save
 * the metadata. If anything fails, the uploaded file is removed again.
 */
export async function finalizeUpload(input: z.input<typeof finalizeUploadSchema>): Promise<ActionResult> {
  let uploadedPath: string | null = null
  const supabase = await createClient()
  try {
    const session = await authorizeAdmin()
    const parsed = finalizeUploadSchema.safeParse(input)
    if (!parsed.success) return invalid(parsed.error)
    const { details, path } = parsed.data
    if (!isPathForDetails(path, details)) return { ok: false, error: "The upload did not match the selected details." }
    uploadedPath = path

    const problem = await verifyStoredPdf(supabase, path)
    if (problem) {
      await removeStoredFile(supabase, path)
      return { ok: false, error: problem }
    }

    const existing = await findExistingDocument(supabase, details)
    const table = tableFor(details.kind)
    const metadata = {
      file_path: path,
      file_name: details.file_name,
      file_size: details.file_size,
      uploaded_by: session.userId,
    }

    const newRow = { ...metadata, employee_id: details.employee_id, year: details.year }
    const { error } = existing
      ? await supabase.from(table).update(metadata).eq("id", existing.id)
      : details.kind === "payslips"
        ? await supabase.from("payslips").insert({ ...newRow, month: details.month! })
        : await supabase.from(details.kind === "ytd" ? "ytd_reports" : "pf_ytd_reports").insert(newRow)
    if (error) {
      await removeStoredFile(supabase, path)
      return fail(error, "save payroll document")
    }
    uploadedPath = null

    if (existing) {
      const removeError = await removeStoredFile(supabase, existing.file_path)
      if (removeError) logServerError("remove replaced payroll file", removeError)
    }

    refresh(details.employee_id)
    const label = DOCUMENT_KINDS[details.kind].label
    return { ok: true, data: undefined, message: `${label} ${existing ? "replaced" : "uploaded"}. The employee has been notified.` }
  } catch (error) {
    if (uploadedPath) await removeStoredFile(supabase, uploadedPath)
    return fail(error, "finalize upload")
  }
}

export async function deleteDocument(kind: string, documentId: string): Promise<ActionResult> {
  try {
    await authorizeAdmin()
    const parsedKind = documentKindSchema.safeParse(kind)
    if (!parsedKind.success || !z.uuid().safeParse(documentId).success) return { ok: false, error: "Document not found." }
    const table = tableFor(parsedKind.data)

    const supabase = await createClient()
    const { data: document, error: loadError } = await supabase
      .from(table)
      .select("id, file_path, employee_id")
      .eq("id", documentId)
      .maybeSingle()
    if (loadError) return fail(loadError, "load document")
    if (!document) return { ok: false, error: "Document not found." }

    // Remove the file first so a failure never leaves a readable orphan behind.
    const removeError = await removeStoredFile(supabase, document.file_path)
    if (removeError) return fail(removeError, "remove payroll file")

    const { error } = await supabase.from(table).delete().eq("id", documentId)
    if (error) return fail(error, "delete document")

    refresh(document.employee_id)
    return { ok: true, data: undefined, message: `${DOCUMENT_KINDS[parsedKind.data].label} deleted.` }
  } catch (error) {
    return fail(error, "delete document")
  }
}
