export type FieldErrors = Record<string, string[] | undefined>

/** What every Server Action returns. Errors are always safe to show to the user. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: FieldErrors }
