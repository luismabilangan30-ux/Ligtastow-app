import type { IncomingMessage, ServerResponse } from "node:http"
import { demoActors, type Actor, type DispatchBooking, type DispatchSnapshot } from "../src/shared/dispatch.ts"
import { ApiError } from "./dispatchService.ts"

export type DispatchApi = {
  snapshot(actor: Actor): DispatchSnapshot | Promise<DispatchSnapshot>
  create(actor: Actor, input: unknown): DispatchBooking | Promise<DispatchBooking>
  command(actor: Actor, id: string, input: unknown): DispatchBooking | Promise<DispatchBooking>
}

const localHosts = new Set(["127.0.0.1", "localhost", "[::1]"])
export function createHandler(service: DispatchApi) {
  return async (request: IncomingMessage, response: ServerResponse) => {
    response.setHeader("Content-Type", "application/json; charset=utf-8")
    response.setHeader("Cache-Control", "no-store")
    response.setHeader("X-Content-Type-Options", "nosniff")
    const send = (status: number, data: unknown) => {
      response.statusCode = status
      response.end(JSON.stringify(data))
    }
    try {
      // The fixture API is loopback-only and has no CORS allowance. This is a
      // development guard, not a substitute for production authentication.
      const host = new URL(`http://${request.headers.host ?? "invalid"}`)
      const peer = request.socket.remoteAddress
      if (
        !localHosts.has(host.hostname) ||
        !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(peer ?? "")
      )
        throw new ApiError(
          403,
          "LOCAL_ONLY",
          "The demo API is available only on this computer.",
        )
      const origin = request.headers.origin
      if (origin && new URL(origin).host !== host.host)
        throw new ApiError(
          403,
          "ORIGIN_REJECTED",
          "Cross-origin requests are not allowed.",
        )
      const actor = demoActors.find(
        (a) => a.id === request.headers["x-demo-actor"],
      )
      if (!actor)
        throw new ApiError(
          401,
          "DEMO_IDENTITY_REQUIRED",
          "Select a known demo workspace.",
        )
      const path = (request.url ?? "").split("?")[0]
      if (path === "/api/v1/snapshot" && request.method === "GET")
        return send(200, await service.snapshot(actor))
      if (request.method !== "POST")
        throw new ApiError(404, "NOT_FOUND", "Unknown API endpoint.")
      if (!request.headers["content-type"]?.startsWith("application/json"))
        throw new ApiError(415, "JSON_REQUIRED", "Send a JSON request.")
      const chunks: Buffer[] = []
      let bytes = 0
      for await (const chunk of request) {
        const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        bytes += data.length
        if (bytes > 16384)
          throw new ApiError(
            413,
            "BODY_TOO_LARGE",
            "Request body exceeds 16 KB.",
          )
        chunks.push(data)
      }
      let body: unknown
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8"))
      } catch {
        throw new ApiError(
          400,
          "INVALID_JSON",
          "Request body is not valid JSON.",
        )
      }
      if (path === "/api/v1/bookings")
        return send(201, await service.create(actor, body))
      const match = path.match(
        /^\/api\/v1\/bookings\/([a-zA-Z0-9-]+)\/commands$/,
      )
      if (match) return send(200, await service.command(actor, match[1], body))
      throw new ApiError(404, "NOT_FOUND", "Unknown API endpoint.")
    } catch (error) {
      if (error instanceof ApiError)
        send(error.status, {
          error: { code: error.code, message: error.message },
        })
      else {
        console.error(
          "Dispatch API failure:",
          error instanceof Error ? error.message : "Unknown error",
        )
        send(500, {
          error: {
            code: "SERVER_ERROR",
            message:
              "The request could not be saved. Retry when the local service is available.",
          },
        })
      }
    }
  }
}
