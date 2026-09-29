import { NextResponse } from "next/server"
import { z } from "zod"

import { tableFor } from "@/lib/payroll"
import { createClient } from "@/lib/supabase/server"
import { logServerError } from "@/lib/utils/errors"
import { isDocumentKind, PAYROLL_BUCKET } from "@/lib/validations/payroll"

const SIGNED_URL_SECONDS = 60

function notFound() {
  return new NextResponse("Document not found.", { status: 404, headers: { "Cache-Control": "no-store" } })
}

/**
 * GET /api/documents/<payslips|ytd|pf-ytd>/<id>[?download=1]
 *
 * 1. The document row is read with the signed-in user's session, so RLS returns
 *    it only to its owner (or an admin). Someone else's id simply isn't found.
 * 2. A short-lived signed URL is created, also as the user, so the storage RLS
 *    policy checks the file's folder belongs to them.
 * 3. The browser is redirected to that URL. Nothing is public or long-lived.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/documents/[kind]/[id]">) {
  const { kind, id } = await ctx.params
  if (!isDocumentKind(kind) || !z.uuid().safeParse(id).success) return notFound()

  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  if (!claims?.claims?.sub) {
    return new NextResponse("Please sign in.", { status: 401, headers: { "Cache-Control": "no-store" } })
  }

  const { data: document, error } = await supabase
    .from(tableFor(kind))
    .select("file_path, file_name")
    .eq("id", id)
    .maybeSingle()
  if (error) {
    logServerError("load document for download", error)
    return notFound()
  }
  if (!document) return notFound()

  const download = new URL(request.url).searchParams.get("download") === "1"
  const { data: signed, error: signError } = await supabase.storage
    .from(PAYROLL_BUCKET)
    .createSignedUrl(document.file_path, SIGNED_URL_SECONDS, { download: download ? document.file_name : false })
  if (signError || !signed) {
    logServerError("sign document url", signError)
    return notFound()
  }

  return NextResponse.redirect(signed.signedUrl, {
    status: 302,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  })
}
