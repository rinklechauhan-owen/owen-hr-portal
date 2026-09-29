import "server-only"

import { randomUUID } from "node:crypto"

import type { SupabaseClient } from "@supabase/supabase-js"

import { DOCUMENT_KINDS, type DocumentKind, hasPdfSignature, MAX_PDF_BYTES, PAYROLL_BUCKET, type UploadDetails } from "@/lib/validations/payroll"
import type { Database } from "@/types/database"

type Client = SupabaseClient<Database>

export function tableFor(kind: DocumentKind) {
  return DOCUMENT_KINDS[kind].table
}

/**
 * Storage path chosen by the server: `<employee_id>/<kind>/<period>-<random>.pdf`.
 * The first folder is what the storage RLS policy compares with the employee's id.
 */
function periodFor(details: UploadDetails) {
  return details.month ? `${details.year}-${String(details.month).padStart(2, "0")}` : String(details.year)
}

/**
 * Storage path chosen by the server: `<employee_id>/<kind>/<period>-<random>.pdf`.
 * The first folder is what the storage RLS policy compares with the employee's id.
 */
export function storagePathFor(details: UploadDetails) {
  return `${details.employee_id}/${details.kind}/${periodFor(details)}-${randomUUID()}.pdf`
}

/** True only for a path in exactly the format storagePathFor issues for these details. */
export function isPathForDetails(path: string, details: UploadDetails) {
  const expected = `${details.employee_id}/${details.kind}/${periodFor(details)}-`
  return (
    path.startsWith(expected) &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/.test(path.slice(expected.length))
  )
}

/** Whether any saved document already points at this storage path. */
export async function isPathInUse(supabase: Client, details: UploadDetails, path: string) {
  const { count, error } = await supabase
    .from(tableFor(details.kind))
    .select("id", { count: "exact", head: true })
    .eq("file_path", path)
  if (error) throw error
  return (count ?? 0) > 0
}

/** The existing document for this employee and period, if any. */
export async function findExistingDocument(supabase: Client, details: UploadDetails) {
  const table = tableFor(details.kind)
  let query = supabase
    .from(table)
    .select("id, file_path, file_name")
    .eq("employee_id", details.employee_id)
    .eq("year", details.year)
  if (details.kind === "payslips") query = query.filter("month", "eq", details.month)
  const { data, error } = await query.maybeSingle()
  if (error) throw error
  return data as { id: string; file_path: string; file_name: string } | null
}

/**
 * Checks the stored object really is a PDF within the size limit, reading only
 * its first bytes. Returns an error message, or null when the file is fine.
 */
export async function verifyStoredPdf(supabase: Client, path: string): Promise<string | null> {
  const bucket = supabase.storage.from(PAYROLL_BUCKET)
  const { data: info, error: infoError } = await bucket.info(path)
  if (infoError || !info) return "The upload did not complete. Please try again."
  if (!info.size || info.size > MAX_PDF_BYTES) return "The file must be 10 MB or smaller."

  const { data: signed, error: signError } = await bucket.createSignedUrl(path, 30)
  if (signError || !signed) return "The upload could not be checked. Please try again."
  const response = await fetch(signed.signedUrl, { headers: { Range: "bytes=0-7" }, cache: "no-store" })
  if (!response.ok) return "The upload could not be checked. Please try again."
  const head = new Uint8Array(await response.arrayBuffer()).slice(0, 8)
  if (!hasPdfSignature(head)) return "This file is not a valid PDF."
  return null
}

export async function removeStoredFile(supabase: Client, path: string) {
  const { error } = await supabase.storage.from(PAYROLL_BUCKET).remove([path])
  return error
}
