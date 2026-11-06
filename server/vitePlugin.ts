import { resolve } from "node:path"
import type { Plugin } from "vite"
import { DispatchService } from "./dispatchService.ts"
import { createHandler } from "./http.ts"
import { cloudRuntime } from "./cloudRuntime.ts"

export default function dispatchApi(): Plugin {
  return {
    name: "ligtastow-local-dispatch-api",
    apply: "serve",
    configureServer(server) {
      const cloud = cloudRuntime(server.config.root)
      server.httpServer?.once("close", () => { void cloud.close() })
      const handler = createHandler(
        new DispatchService(
          resolve(server.config.root, ".local/dispatch-v1.json"),
        ),
      )
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith("/api/v2/")) void cloud.handler(req, res)
        else if (req.url?.startsWith("/api/")) void handler(req, res)
        else next()
      })
    },
  }
}
