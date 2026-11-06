import { createServer } from "node:http"
import { cloudRuntime } from "./cloudRuntime.ts"
import { localEnvironment } from "./database.ts"

if (process.env.NODE_ENV === "production") throw new Error("Configure production hosting and HTTPS/origin controls before deploying the development API.")
const env = localEnvironment(process.cwd())
const port = Number(env.DISPATCH_PORT ?? 8444)
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("DISPATCH_PORT must be an integer from 1024 to 65535.")
const runtime = cloudRuntime(process.cwd())
const server = createServer((request, response) => { void runtime.handler(request, response) })
server.requestTimeout = 15000
server.headersTimeout = 10000
server.keepAliveTimeout = 5000
server.listen(port, "127.0.0.1", () => console.log(`Verified account API: http://127.0.0.1:${port}/api/v2 (development only)`))
let closing = false
const close = () => {
  if (closing) return
  closing = true
  server.close(() => { void runtime.close().then(() => process.exit(0)) })
  setTimeout(() => process.exit(1), 5000).unref()
}
process.on("SIGINT", close)
process.on("SIGTERM", close)
