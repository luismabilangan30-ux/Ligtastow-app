import type { IncomingMessage, ServerResponse } from "node:http"
import { createClient } from "@supabase/supabase-js"
import pg from "pg"
import { PostgresDispatch } from "../../server/postgresDispatch.ts"
import { ApiError } from "../../server/dispatchService.ts"

// ── Inline types (avoid cross-directory .ts imports) ─────────────────
type VerifiedUser = { id: string; email: string }
type SqlClient = {
  query<R extends Record<string, any> = Record<string, any>>(sql: string, values?: any[]): Promise<{ rows: R[]; rowCount?: number | null }>
}
type TransactionRunner = <T>(work: (client: SqlClient) => Promise<T>) => Promise<T>

// ApiError imported from server/dispatchService.ts

// ── Lazy singletons (reused across warm invocations) ─────────────────
let pool: pg.Pool | null = null
let supabaseClient: ReturnType<typeof createClient> | null = null

function getPool(): pg.Pool {
  if (pool) return pool
  const url = process.env.DATABASE_URL
  if (!url) throw new ApiError(503, "DB_NOT_CONFIGURED", "Database connection not configured.")
  const uri = new URL(url)
  pool = new pg.Pool({
    host: uri.hostname,
    port: Number(uri.port) || 5432,
    database: uri.pathname.replace(/^\//, "") || "postgres",
    user: decodeURIComponent(uri.username),
    password: decodeURIComponent(uri.password),
    ssl: {
      rejectUnauthorized: true,
      ...(process.env.DATABASE_CA ? { ca: process.env.DATABASE_CA } : {}),
    },
    max: 2,
    connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 30000,
    statement_timeout: 8000,
    query_timeout: 10000,
    application_name: "ligtastow-vercel",
  })
  pool.on("error", () => console.error("PostgreSQL idle connection lost"))
  return pool
}

function getSupabase() {
  if (supabaseClient) return supabaseClient
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) throw new ApiError(503, "AUTH_NOT_CONFIGURED", "Supabase auth not configured.")
  supabaseClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { fetch: (u, init) => fetch(u, { ...init, signal: AbortSignal.timeout(8000) }) },
  })
  return supabaseClient
}

function getTransaction(): TransactionRunner {
  const p = getPool()
  return async (work) => {
    for (let attempt = 0; ; attempt++) {
      const client = await p.connect()
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
}

let serviceInstance: PostgresDispatch | null = null
function getService(): PostgresDispatch {
  if (!serviceInstance) serviceInstance = new PostgresDispatch(getTransaction())
  return serviceInstance
}

async function verifyToken(token: string): Promise<VerifiedUser> {
  const sb = getSupabase()
  const { data, error } = await (sb.auth as any).getUser(token)
  if (error || !data.user) {
    if (error && (!error.status || error.status >= 500)) throw new ApiError(503, "AUTH_UNAVAILABLE", "Sign-in verification is unavailable. Please retry shortly.")
    throw new ApiError(401, "SESSION_EXPIRED", "Your session is invalid or expired. Sign in again.")
  }
  if (!data.user.email_confirmed_at || data.user.is_anonymous) throw new ApiError(403, "EMAIL_CONFIRMATION_REQUIRED", "Confirm your email before using this account.")
  return { id: data.user.id, email: data.user.email ?? "" }
}

// ── Allowed origins ──────────────────────────────────────────────────
function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true
  try {
    const host = new URL(origin).hostname
    if (host === "localhost" || host === "127.0.0.1") return true
    if (host.endsWith(".vercel.app")) return true
    const allowed = process.env.ALLOWED_ORIGIN
    if (allowed && new URL(allowed).hostname === host) return true
    return false
  } catch { return false }
}

// ── Body parser ──────────────────────────────────────────────────────
function parseBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let bytes = 0
    req.on("data", (chunk: Buffer) => {
      bytes += chunk.length
      if (bytes > 16384) { reject(new ApiError(413, "BODY_TOO_LARGE", "Request body exceeds 16 KB.")); return }
      chunks.push(chunk)
    })
    req.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))) }
      catch { reject(new ApiError(400, "INVALID_JSON", "Request body is not valid JSON.")) }
    })
    req.on("error", reject)
  })
}

// ── Handler ──────────────────────────────────────────────────────────
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin as string | undefined
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin)
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Workspace")
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    res.setHeader("Access-Control-Max-Age", "86400")
  }
  if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return }

  res.setHeader("Content-Type", "application/json; charset=utf-8")
  res.setHeader("Cache-Control", "no-store")
  res.setHeader("X-Content-Type-Options", "nosniff")

  const send = (status: number, data: unknown) => { res.statusCode = status; res.end(JSON.stringify(data)) }

  try {
    if (!isAllowedOrigin(origin)) throw new ApiError(403, "ORIGIN_REJECTED", "Cross-origin requests are not allowed.")

    const authorization = req.headers.authorization
    if (!authorization || !/^Bearer [a-zA-Z0-9._-]+$/.test(authorization) || authorization.length > 16384) {
      throw new ApiError(401, "SIGN_IN_REQUIRED", "Sign in to access your account.")
    }

    const user = await verifyToken(authorization.slice(7))
    const service = getService()
    const workspace = typeof req.headers["x-workspace"] === "string" ? req.headers["x-workspace"] : "motorist"

    const path = (req.url ?? "").split("?")[0]

    if (req.method === "GET" && path === "/api/v2/session") return send(200, await service.session(user))
    if (req.method === "GET" && path === "/api/v2/snapshot") return send(200, await service.snapshot(user, workspace))
    if (req.method !== "POST") throw new ApiError(404, "NOT_FOUND", "Unknown account API endpoint.")

    const body = await parseBody(req)

    if (path === "/api/v2/bookings") return send(201, await service.create(user, workspace, body))
    const command = path.match(/^\/api\/v2\/bookings\/([a-zA-Z0-9-]+)\/commands$/)
    if (command) return send(200, await service.command(user, workspace, command[1], body))
    if (path === "/api/v2/profile") return send(200, await service.saveProfile(user, body))
    if (path === "/api/v2/preferences") return send(200, await service.savePreference(user, body))
    if (path === "/api/v2/vehicles") return send(200, await service.saveVehicle(user, body))
    const deletion = path.match(/^\/api\/v2\/vehicles\/([a-zA-Z0-9-]+)\/delete$/)
    if (deletion) return send(200, await service.removeVehicle(user, deletion[1]))

    throw new ApiError(404, "NOT_FOUND", "Unknown account API endpoint.")
  } catch (error) {
    if (error instanceof ApiError) return send(error.status, { error: { code: error.code, message: error.message } })
    console.error("Account API request failed:", (error as Error).message ?? error)
    send(503, { error: { code: "SERVICE_UNAVAILABLE", message: "Account storage is unavailable. Retry shortly." } })
  }
}
