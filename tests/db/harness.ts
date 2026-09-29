import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"

import { PGlite, type Transaction } from "@electric-sql/pglite"
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist"

const root = path.resolve(import.meta.dirname, "../..")
const migrationsDir = path.join(root, "supabase", "migrations")

/** A fresh Postgres with the Supabase stubs and every migration applied, in order. */
export async function createDatabase() {
  const db = await PGlite.create({ extensions: { btree_gist } })
  await db.exec(readFileSync(path.join(import.meta.dirname, "supabase-stubs.sql"), "utf8"))
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    try {
      await db.exec(readFileSync(path.join(migrationsDir, file), "utf8"))
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`)
    }
  }
  return db
}

export type Actor =
  | { kind: "user"; id: string }
  | { kind: "anon" }
  | { kind: "service" }

/**
 * Runs `fn` exactly as the Data API would for this actor: switched to the API role
 * with the JWT claims set, inside a transaction. Throws the database's error.
 */
export async function asActor<T>(
  db: PGlite,
  actor: Actor,
  fn: (tx: Transaction) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    const role =
      actor.kind === "user" ? "authenticated" : actor.kind === "anon" ? "anon" : "service_role"
    const claims =
      actor.kind === "user" ? { sub: actor.id, role } : { role }
    await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)])
    await tx.exec(`set local role ${role}`)
    return fn(tx)
  })
}

/** Runs `fn` as the given actor and returns the error message it raises. */
export async function errorMessage(
  db: PGlite,
  actor: Actor,
  fn: (tx: Transaction) => Promise<unknown>
): Promise<string> {
  try {
    await asActor(db, actor, fn)
  } catch (error) {
    return (error as Error).message
  }
  throw new Error("Expected the statement to fail, but it succeeded.")
}

/** Creates an auth user; the migration's trigger creates the matching profile. */
export async function createUser(db: PGlite, email: string, role: "admin" | "employee" = "employee") {
  const { rows } = await db.query<{ id: string }>(
    `insert into auth.users (email, raw_app_meta_data, raw_user_meta_data)
     values ($1, $2, $3) returning id`,
    [email, JSON.stringify({ role }), JSON.stringify({ full_name: email.split("@")[0] })]
  )
  return rows[0].id
}

export async function createEmployee(
  db: PGlite,
  input: { code: string; firstName: string; lastName: string; email: string; profileId?: string }
) {
  const { rows } = await db.query<{ id: string }>(
    `insert into public.employees (employee_code, first_name, last_name, email, joining_date, profile_id)
     values ($1, $2, $3, $4, '2024-04-01', $5) returning id`,
    [input.code, input.firstName, input.lastName, input.email, input.profileId ?? null]
  )
  return rows[0].id
}

/** Today's date in the company's time zone, as the database sees it. */
export async function companyToday(db: PGlite) {
  const { rows } = await db.query<{ today: string }>("select private.today()::text as today")
  return rows[0].today
}

export function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** A Monday at least `minDaysAhead` days away whose Monday–Friday week sits in one year. */
export function futureMonday(today: string, minDaysAhead = 7) {
  let date = addDays(today, minDaysAhead)
  while (new Date(`${date}T00:00:00Z`).getUTCDay() !== 1) date = addDays(date, 1)
  while (date.slice(0, 4) !== addDays(date, 4).slice(0, 4)) date = addDays(date, 7)
  return date
}

/** The error message of a promise that is expected to reject. */
export async function failureOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (error) {
    return (error as Error).message
  }
  throw new Error("Expected the statement to fail, but it succeeded.")
}
