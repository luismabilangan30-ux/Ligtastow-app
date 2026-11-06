import type { IncomingMessage, ServerResponse } from "node:http"
import { ApiError } from "./dispatchService.ts"
import type { PostgresDispatch, VerifiedUser } from "./postgresDispatch.ts"

export type VerifyUser = (token: string) => Promise<VerifiedUser>

export function cloudHandler(service: PostgresDispatch | null, verify: VerifyUser | null) {
  return async (request: IncomingMessage, response: ServerResponse) => {
    response.setHeader("Content-Type", "application/json; charset=utf-8")
    response.setHeader("Cache-Control", "no-store")
    response.setHeader("X-Content-Type-Options", "nosniff")
    const send = (status: number, data: unknown) => { response.statusCode = status; response.end(JSON.stringify(data)) }
    try {
      // Hosted data, local API: deployment requires a separate HTTPS host/origin policy.
      const host = new URL(`http://${request.headers.host ?? "invalid"}`)
      if (!["localhost", "127.0.0.1", "[::1]"].includes(host.hostname) ||
          !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(request.socket.remoteAddress ?? "")) {
        throw new ApiError(403, "LOCAL_ONLY", "This development API is available only on this computer.")
      }
      if (request.headers.origin && new URL(request.headers.origin).origin !== host.origin) {
        throw new ApiError(403, "ORIGIN_REJECTED", "Cross-origin requests are not allowed.")
      }
      const authorization = request.headers.authorization
      if (!authorization || !/^Bearer [a-zA-Z0-9._-]+$/.test(authorization) || authorization.length > 16384) {
        throw new ApiError(401, "SIGN_IN_REQUIRED", "Sign in to access your account.")
      }
      if (!service || !verify) throw new ApiError(503, "SETUP_REQUIRED", "The account API is not configured. Check the server environment file and restart the development server.")
      const user = await verify(authorization.slice(7))
      const workspace = typeof request.headers["x-workspace"] === "string" ? request.headers["x-workspace"] : "motorist"
      const path = (request.url ?? "").split("?")[0]
      if (request.method === "GET" && path === "/api/v2/session") return send(200, await service.session(user))
      if (request.method === "GET" && path === "/api/v2/snapshot") return send(200, await service.snapshot(user, workspace))
      if (request.method !== "POST") throw new ApiError(404, "NOT_FOUND", "Unknown account API endpoint.")
      if (!request.headers["content-type"]?.startsWith("application/json")) throw new ApiError(415, "JSON_REQUIRED", "Send a JSON request.")
      const chunks: Buffer[] = []
      let bytes = 0
      for await (const chunk of request) {
        const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        bytes += part.length
        if (bytes > 16384) throw new ApiError(413, "BODY_TOO_LARGE", "Request body exceeds 16 KB.")
        chunks.push(part)
      }
      let body: unknown
      try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")) }
      catch { throw new ApiError(400, "INVALID_JSON", "Request body is not valid JSON.") }
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
      if (error instanceof ApiError) send(error.status, { error: { code: error.code, message: error.message } })
      else {
        // PostgreSQL/network errors may contain SQL data, hosts or credentials. Do not log them.
        console.error("Account API request failed; check database connectivity with pnpm run db:check.")
        send(503, { error: { code: "SERVICE_UNAVAILABLE", message: "Account storage is unavailable. Retry shortly; keep the same booking request when retrying." } })
      }
    }
  }
}
