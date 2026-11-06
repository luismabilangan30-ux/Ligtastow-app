import assert from "node:assert/strict"
import { test } from "node:test"
import { createServer } from "node:http"
import { once } from "node:events"
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DispatchService, ApiError } from "../server/dispatchService.ts"
import { createHandler } from "../server/http.ts"
import {
  demoActors,
  type Actor,
  type DispatchBooking,
} from "../src/shared/dispatch.ts"
import { initialVehicles, newDraft } from "../src/motorist/model.ts"

const actor = (id: string) => demoActors.find((a) => a.id === id)!
const motorist = actor("motorist-demo")
const operator = actor("operator-viray")
const company = actor("company-viray")
const central = actor("central-demo")
const input = (providerId = "viray") => ({
  draft: newDraft(
    initialVehicles,
    "Test pickup, Cubao",
    "Jump Start",
    providerId,
  ),
  vehicle: initialVehicles[0],
  requestId: crypto.randomUUID(),
})
const errorCode = (code: string) => (error: unknown) =>
  error instanceof ApiError && error.code === code
const command = (
  service: DispatchService,
  who: Actor,
  booking: DispatchBooking,
  action: string,
  values = {},
) =>
  service.command(who, booking.id, {
    action,
    expectedVersion: booking.version,
    ...values,
  })

test("server owns fares and status; retrying creation is idempotent and active bookings are unique", () => {
  const service = new DispatchService()
  const request = input()
  const booking = service.create(motorist, {
    ...request,
    status: "completed",
    quote: { total: 1 },
    motoristId: "other",
  })
  assert.equal(booking.quote.total, 745)
  assert.equal(booking.status, "searching")
  assert.equal(booking.motoristId, motorist.id)
  assert.equal(service.create(motorist, request).id, booking.id)
  assert.equal(service.snapshot(motorist).bookings.length, 1)
  assert.throws(
    () => service.create(motorist, input()),
    errorCode("ACTIVE_BOOKING"),
  )
  assert.throws(
    () =>
      service.create(motorist, {
        ...request,
        draft: { ...request.draft, pickup: "Different pickup" },
      }),
    errorCode("IDEMPOTENCY_CONFLICT"),
  )
})

test("server validates malformed fields, services and vehicle selection", () => {
  const service = new DispatchService()
  assert.throws(
    () => service.create(motorist, null),
    errorCode("INVALID_REQUEST"),
  )
  const request = input()
  for (const draft of [
    { ...request.draft, service: "Unsupported" },
    { ...request.draft, notes: null },
    { ...request.draft, vehicleId: "missing" },
    { ...request.draft, pickup: "x" },
    { ...request.draft, pickup: "x".repeat(181) },
  ]) {
    assert.throws(
      () => service.create(motorist, { ...request, draft }),
      errorCode("INVALID_REQUEST"),
    )
  }
  assert.throws(() => service.create(operator, request), errorCode("FORBIDDEN"))
})

test("motorists and providers are isolated; clients cannot elevate role through command fields", () => {
  const service = new DispatchService()
  const booking = service.create(motorist, input())
  const other = { ...motorist, id: "test-other-motorist" }
  for (const who of [
    other,
    actor("operator-motor-trust"),
    actor("company-motor-trust"),
  ]) {
    assert.equal(service.snapshot(who).bookings.length, 0)
    assert.throws(
      () => command(service, who, booking, "accept"),
      errorCode("NOT_FOUND"),
    )
  }
  assert.throws(
    () =>
      command(service, motorist, booking, "accept", {
        role: "operator",
        operatorId: operator.id,
      }),
    errorCode("FORBIDDEN"),
  )
  assert.equal(service.snapshot(central).bookings.length, 1)
  assert.equal(service.snapshot(company).operators.length, 2)
})

test("acceptance uses version checks and only assigned operator can advance sequentially", () => {
  const service = new DispatchService()
  const created = service.create(motorist, input())
  let booking = command(service, operator, created, "accept")
  assert.throws(
    () =>
      command(service, company, created, "assign", {
        operatorId: "operator-viray-2",
      }),
    errorCode("STALE_VERSION"),
  )
  assert.throws(
    () => command(service, motorist, booking, "advance"),
    errorCode("FORBIDDEN"),
  )
  assert.throws(
    () => command(service, company, booking, "advance"),
    errorCode("FORBIDDEN"),
  )
  for (let stage = 2; stage <= 5; stage++) {
    booking = command(service, operator, booking, "advance", { stage: 99 })
    assert.equal(booking.stage, stage)
    assert.equal(booking.status, "assigned")
  }
  booking = command(service, operator, booking, "advance")
  assert.equal(booking.status, "completed")
  assert.equal(booking.events.length, 7)
  assert.throws(
    () => command(service, operator, booking, "advance"),
    errorCode("INVALID_STATE"),
  )
  assert.throws(
    () => command(service, motorist, booking, "rate", { rating: 6 }),
    errorCode("INVALID_RATING"),
  )
  booking = command(service, motorist, booking, "rate", { rating: 5 })
  assert.equal(booking.rating, 5)
  assert.equal(booking.events[7].actorId, motorist.id)
})

test("declining preserves the request for other operators and company assignment respects eligibility", () => {
  const service = new DispatchService()
  let booking = service.create(motorist, input())
  booking = command(service, operator, booking, "decline")
  assert.equal(service.snapshot(operator).bookings.length, 0)
  assert.equal(service.snapshot(actor("operator-viray-2")).bookings.length, 1)
  assert.throws(
    () =>
      command(service, company, booking, "assign", { operatorId: operator.id }),
    errorCode("INVALID_OPERATOR"),
  )
  assert.throws(
    () =>
      command(service, company, booking, "assign", {
        operatorId: "operator-motor-trust",
      }),
    errorCode("INVALID_OPERATOR"),
  )
  booking = command(service, company, booking, "assign", {
    operatorId: "operator-viray-2",
  })
  assert.equal(booking.operatorName, "Ana Santos")
})

test("busy operators cannot take a second job; cancellation rules retain reasons and terminal integrity", () => {
  const service = new DispatchService()
  let first = command(
    service,
    operator,
    service.create(motorist, input()),
    "accept",
  )
  const second = service.create({ ...motorist, id: "second-motorist" }, input())
  assert.throws(
    () => command(service, operator, second, "accept"),
    errorCode("OPERATOR_BUSY"),
  )
  assert.throws(
    () => command(service, motorist, first, "rate", { rating: 5 }),
    errorCode("INVALID_STATE"),
  )
  for (let i = 0; i < 3; i++)
    first = command(service, operator, first, "advance")
  assert.throws(
    () =>
      command(service, motorist, first, "cancel", { reason: "Changed mind" }),
    errorCode("CANCELLATION_REVIEW"),
  )
  assert.throws(
    () => command(service, central, first, "cancel", { reason: " " }),
    errorCode("INVALID_REASON"),
  )
  first = command(service, central, first, "cancel", {
    reason: " Service cannot continue ",
  })
  assert.equal(first.cancellationReason, "Service cannot continue")
  assert.throws(
    () => command(service, central, first, "cancel", { reason: "Again" }),
    errorCode("INVALID_STATE"),
  )
  assert.equal(
    command(service, operator, second, "accept").operatorId,
    operator.id,
  )
})

test("bookings survive a new service instance and invalid saves fail without changing memory", () => {
  const directory = mkdtempSync(join(tmpdir(), "ligtastow-dispatch-test-"))
  try {
    const file = join(directory, "bookings.json")
    const first = new DispatchService(file)
    const request = input()
    const booking = first.create(motorist, request)
    assert.equal(
      new DispatchService(file).create(motorist, request).id,
      booking.id,
    )
    assert.equal(JSON.parse(readFileSync(file, "utf8")).schemaVersion, 1)
    const blocked = join(directory, "blocked.json")
    const broken = new DispatchService(blocked)
    mkdirSync(blocked)
    assert.throws(() => broken.create(motorist, input()))
    assert.equal(broken.snapshot(motorist).bookings.length, 0)
    writeFileSync(file, "{corrupt")
    assert.throws(() => new DispatchService(file))
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test("HTTP API rejects missing identities, cross-origin requests and malformed JSON; never caches bookings", async () => {
  const server = createServer(createHandler(new DispatchService()))
  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  const address = server.address() as { port: number }
  const url = `http://127.0.0.1:${address.port}/api/v1/`
  const headers = {
    "X-Demo-Actor": motorist.id,
    "Content-Type": "application/json",
  }
  try {
    assert.equal((await fetch(`${url}snapshot`)).status, 401)
    assert.equal(
      (
        await fetch(`${url}snapshot`, {
          headers: { ...headers, Origin: "https://example.com" },
        })
      ).status,
      403,
    )
    assert.equal(
      (await fetch(`${url}bookings`, { method: "POST", headers, body: "{" }))
        .status,
      400,
    )
    const created = await fetch(`${url}bookings`, {
      method: "POST",
      headers,
      body: JSON.stringify(input()),
    })
    assert.equal(created.status, 201)
    assert.equal(created.headers.get("cache-control"), "no-store")
    const booking = (await created.json()) as DispatchBooking
    const accepted = await fetch(`${url}bookings/${booking.id}/commands`, {
      method: "POST",
      headers: { ...headers, "X-Demo-Actor": operator.id },
      body: JSON.stringify({
        action: "accept",
        expectedVersion: booking.version,
      }),
    })
    assert.equal(accepted.status, 200)
    assert.equal((await accepted.json()).operatorName, operator.name)
    const response = await fetch(`${url}snapshot`, { headers })
    assert.equal((await response.json()).bookings[0].status, "assigned")
  } finally {
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})
