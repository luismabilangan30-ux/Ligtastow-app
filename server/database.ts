import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { parseEnv } from "node:util"
import pg from "pg"

export type SqlClient = {
  query<R extends Record<string, any> = Record<string, any>>(sql: string, values?: any[]): Promise<{ rows: R[]; rowCount?: number | null }>
}
export type TransactionRunner = <T>(work: (client: SqlClient) => Promise<T>) => Promise<T>

export function localEnvironment(root: string) {
  const env: Record<string, string | undefined> = {}
  for (const name of [".env.local", ".env.server.local"]) {
    try { Object.assign(env, parseEnv(readFileSync(resolve(root, name), "utf8"))) }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error }
  }
  return { ...env, ...process.env }
}

export function databaseConfig(env: Record<string, string | undefined>) {
  // Never include the input URI in errors: it contains the database password.
  let uri: URL
  let auth: URL
  try {
    uri = new URL(env.DATABASE_URL ?? "")
    auth = new URL(env.VITE_SUPABASE_URL ?? "")
  } catch { throw new Error("Save a valid DATABASE_URL and Supabase project URL in the local environment files.") }
  const project = auth.hostname.split(".")[0]
  const pooler = /^aws-[a-z0-9-]+\.pooler\.supabase\.com$/.test(uri.hostname)
  const direct = uri.hostname === `db.${project}.supabase.co`
  if (!/^[a-z]{20}$/.test(project) || auth.origin !== `https://${project}.supabase.co` ||
      !["postgres:", "postgresql:"].includes(uri.protocol) || (!pooler && !direct) ||
      (uri.port && uri.port !== "5432") || uri.pathname !== "/postgres" ||
      !uri.password || /YOUR-PASSWORD|REPLACE_WITH/.test(uri.password) || uri.hash ||
      (pooler ? decodeURIComponent(uri.username) !== `postgres.${project}` : uri.username !== "postgres")) {
    throw new Error("DATABASE_URL must be this project's complete Session pooler URI on port 5432. URL-encode the password.")
  }
  // SSL options in a URI can override pg's explicit TLS verification settings.
  // Use explicit fields and our own CA instead of passing the connection string.
  return {
    host: uri.hostname, port: 5432, database: "postgres",
    user: decodeURIComponent(uri.username), password: decodeURIComponent(uri.password),
    ssl: { rejectUnauthorized: true, ...(env.DATABASE_CA_FILE ? { ca: readFileSync(env.DATABASE_CA_FILE, "utf8") } : {}) },
    max: 3, connectionTimeoutMillis: 8000, idleTimeoutMillis: 30000,
    statement_timeout: 8000, query_timeout: 10000,
    application_name: "ligtastow-development-api",
  }
}

export function postgresDatabase(env: Record<string, string | undefined>) {
  const pool = new pg.Pool(databaseConfig(env))
  pool.on("error", () => console.error("PostgreSQL idle connection lost; subsequent requests will reconnect."))
  const transaction: TransactionRunner = async (work) => {
    for (let attempt = 0; ; attempt++) {
      const client = await pool.connect()
      let discard = false
      try {
        await client.query("begin isolation level serializable")
        await client.query("set local role service_role")
        await client.query("set local lock_timeout = '5s'")
        const value = await work(client)
        await client.query("commit")
        return value
      } catch (error) {
        try { await client.query("rollback") } catch { discard = true }
        if (attempt < 2 && ["40001", "40P01"].includes((error as { code?: string }).code ?? "")) continue
        throw error
      } finally { client.release(discard) }
    }
  }
  return { transaction, close: () => pool.end() }
}
