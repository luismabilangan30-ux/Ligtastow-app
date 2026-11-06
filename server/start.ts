import { fileURLToPath } from "node:url"
import { DispatchService } from "./dispatchService.ts"
import { createDispatchServer, standaloneConfig } from "./standalone.ts"

// Separate store prevents competing writes from the existing Vite demo process.
const config = standaloneConfig(process.env)
const file = fileURLToPath(new URL("../.local/standalone-dispatch-v1.json", import.meta.url))
const server = createDispatchServer(new DispatchService(file))
server.on("error", (error: NodeJS.ErrnoException) => {
  console.error(`Dispatch API startup failed (${error.code ?? "unknown error"}).`)
  process.exitCode = 1
})
server.listen(config.port, config.host, () => {
  console.log(`Local fixture API: http://${config.host}:${config.port}/api/v1/snapshot`)
  console.log("Separate development store; Supabase persistence and authentication are not connected.")
})
const stop = () => {
  server.close(() => { process.exitCode = 0 })
  const timer = setTimeout(() => server.closeAllConnections(), 5000)
  timer.unref()
}
process.once("SIGINT", stop)
process.once("SIGTERM", stop)
