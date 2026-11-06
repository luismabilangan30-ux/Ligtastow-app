import type { VercelRequest, VercelResponse } from "@vercel/node"
import { createClient } from "@supabase/supabase-js"
import pg from "pg"
import { ApiError } from "../../server/dispatchService"
import { PostgresDispatch, type VerifiedUser } from "../../server/postgresDispatch"
import type { TransactionRunner } from "../../server/database"

// ── Lazy singletons (reused across warm invocations) ─────────────────
let pool: pg.Pool | null = null
let supabaseClient: ReturnType<typeof createClient> | null = null
let serviceInstance: PostgresDispatch | null = null

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

function getService(): PostgresDispatch {
  if (!serviceInstance) serviceInstance = new PostgresDispatch(getTransaction())
  return serviceInstance
}

async function verifyToken(token: string): Promise<VerifiedUser> {
  const sb = getSupabase()
  const { data, error } = await sb.auth.getUser(token)
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

// ── Handler ──────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin as string | undefined
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin)
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Workspace")
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    res.setHeader("Access-Control-Max-Age", "86400")
  }
  if (req.method === "OPTIONS") return res.status(204).end()

  res.setHeader("Content-Type", "application/json; charset=utf-8")
  res.setHeader("Cache-Control", "no-store")
  res.setHeader("X-Content-Type-Options", "nosniff")

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

    if (req.method === "GET" && path === "/api/v2/session") return res.status(200).json(await service.session(user))
    if (req.method === "GET" && path === "/api/v2/snapshot") return res.status(200).json(await service.snapshot(user, workspace))
    if (req.method !== "POST") throw new ApiError(404, "NOT_FOUND", "Unknown account API endpoint.")

    const body = req.body
    if (body === undefined || body === null) throw new ApiError(400, "INVALID_JSON", "Request body is not valid JSON.")

    if (path === "/api/v2/bookings") return res.status(201).json(await service.create(user, workspace, body))
    const command = path.match(/^\/api\/v2\/bookings\/([a-zA-Z0-9-]+)\/commands$/)
    if (command) return res.status(200).json(await service.command(user, workspace, command[1], body))
    if (path === "/api/v2/profile") return res.status(200).json(await service.saveProfile(user, body))
    if (path === "/api/v2/preferences") return res.status(200).json(await service.savePreference(user, body))
    if (path === "/api/v2/vehicles") return res.status(200).json(await service.saveVehicle(user, body))
    const deletion = path.match(/^\/api\/v2\/vehicles\/([a-zA-Z0-9-]+)\/delete$/)
    if (deletion) return res.status(200).json(await service.removeVehicle(user, deletion[1]))

    throw new ApiError(404, "NOT_FOUND", "Unknown account API endpoint.")
  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.status).json({ error: { code: error.code, message: error.message } })
    }
    console.error("Account API request failed:", (error as Error).message ?? error)
    return res.status(503).json({ error: { code: "SERVICE_UNAVAILABLE", message: "Account storage is unavailable. Retry shortly." } })
  }
}
