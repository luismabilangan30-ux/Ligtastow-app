import { createServer } from "node:http"
import { createHandler, type DispatchApi } from "./http.ts"

export function standaloneConfig(env: NodeJS.ProcessEnv) {
  if (env.NODE_ENV === "production") {
    throw new Error("The fixture API cannot run in production. Verified authentication and PostgreSQL integration are pending.")
  }
  const raw = env.DISPATCH_PORT ?? "8444"
  if (!/^\d+$/.test(raw) || Number(raw) < 1024 || Number(raw) > 65535) {
    throw new Error("DISPATCH_PORT must be an integer from 1024 to 65535.")
  }
  return { host: "127.0.0.1", port: Number(raw) }
}

export function createDispatchServer(service: DispatchApi) {
  const handler = createHandler(service)
  const server = createServer((req, res) => { void handler(req, res) })
  server.requestTimeout = 15000
  server.headersTimeout = 10000
  server.keepAliveTimeout = 5000
  return server
}
