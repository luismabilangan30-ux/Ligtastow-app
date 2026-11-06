import assert from "node:assert/strict"
import { test } from "node:test"
import { once } from "node:events"
import { DispatchService } from "../server/dispatchService.ts"
import { createDispatchServer, standaloneConfig } from "../server/standalone.ts"

test("standalone fixture server is loopback-only and rejects production and invalid ports", () => {
  assert.deepEqual(standaloneConfig({}), { host: "127.0.0.1", port: 8444 })
  for (const DISPATCH_PORT of ["abc", "8444x", "0", "80", "65536", "-5", "1.5"]) {
    assert.throws(() => standaloneConfig({ DISPATCH_PORT }))
  }
  assert.throws(() => standaloneConfig({ NODE_ENV: "production" }), /cannot run in production/)
})

test("standalone API runs without Vite and awaits asynchronous adapters", async () => {
  const service = new DispatchService()
  const server = createDispatchServer({
    snapshot: async (actor) => service.snapshot(actor),
    create: async (actor, body) => service.create(actor, body),
    command: async (actor, id, body) => service.command(actor, id, body),
  })
  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1/snapshot`
  try {
    assert.equal((await fetch(url)).status, 401)
    const response = await fetch(url, { headers: { "X-Demo-Actor": "company-viray" } })
    assert.equal(response.status, 200)
    assert.equal(response.headers.get("cache-control"), "no-store")
    const data = await response.json()
    assert.equal(data.bookings.length, 0)
    assert.equal(data.operators.length, 2)
  } finally {
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})
