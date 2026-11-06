import assert from "node:assert/strict"
import { before, beforeEach, after, test } from "node:test"
import { readFile } from "node:fs/promises"
import { createServer } from "node:http"
import { once } from "node:events"
import { PGlite } from "@electric-sql/pglite"
import { PostgresDispatch } from "../server/postgresDispatch.ts"
import { ApiError } from "../server/dispatchService.ts"
import { cloudHandler } from "../server/cloudHttp.ts"
import { databaseConfig, type TransactionRunner } from "../server/database.ts"
import { initialVehicles, newDraft } from "../src/motorist/model.ts"

const db = new PGlite()
const uid = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const user = (n: number) => ({ id: uid(n), email: `sample${n}@example.test` })
const motorist = user(1), operator = user(3), company = user(6), central = user(8)
const operatorWorkspace = `operator:${uid(101)}`
const transaction: TransactionRunner = work => db.transaction(async tx => {
  await tx.exec("set local role service_role")
  return work(tx)
})
const service = new PostgresDispatch(transaction)
const code = (expected: string) => (error: unknown) => error instanceof ApiError && error.code === expected
const vehicle = (id = 401) => ({ ...initialVehicles[0], id: uid(id) })
async function request(who = motorist, providerId = "viray") {
  const saved = await service.saveVehicle(who, vehicle(400 + Number(who.id.slice(-2))))
  return { draft: { ...newDraft([saved], "Sample pickup Cubao", "Tow Truck", providerId), incident: "Engine failure" },
    vehicle: { ...saved, make: "CLIENT SPOOF" }, requestId: crypto.randomUUID(), motoristId: uid(999), quote: { total: 1 } }
}

before(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users (id uuid primary key, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated;`)
  await db.exec(await readFile(new URL("../supabase/migrations/202610310001_dispatch_foundation.sql", import.meta.url), "utf8"))
})
beforeEach(async () => {
  await db.exec("truncate auth.users, public.providers cascade")
  for (let n = 1; n <= 10; n++) await db.query("insert into auth.users(id,raw_user_meta_data) values ($1,$2)", [uid(n), JSON.stringify({ display_name: `Sample ${n}`, role: "central" })])
  await db.exec(`insert into public.providers(id,name,area,active) values ('viray','Test provider A','Cubao',true),('motor-trust','Test provider B','Ortigas',true);
    insert into public.provider_memberships(id,user_id,provider_id,role,active) values
      ('${uid(201)}','${uid(3)}','viray','operator',true),('${uid(202)}','${uid(4)}','viray','operator',true),
      ('${uid(203)}','${uid(5)}','motor-trust','operator',true),('${uid(206)}','${uid(6)}','viray','company',true),
      ('${uid(207)}','${uid(7)}','motor-trust','company',true),('${uid(209)}','${uid(9)}','viray','company',false);
    insert into public.operators(id,membership_id,provider_id,display_name,truck_label,active) values
      ('${uid(101)}','${uid(201)}','viray','Operator A','VT001',true),('${uid(102)}','${uid(202)}','viray','Operator B','VT002',true),
      ('${uid(103)}','${uid(203)}','motor-trust','Operator C','MT001',true);
    insert into app_private.central_admins(user_id) values ('${uid(8)}');`)
})
after(() => db.close())

test("cloud sessions use server memberships and reject forged or revoked workspaces", async () => {
  assert.deepEqual((await service.session(motorist)).workspaces.map(item => item.key), ["motorist"])
  assert.deepEqual((await service.session(operator)).workspaces.map(item => item.key), [operatorWorkspace])
  assert.deepEqual((await service.session(central)).workspaces.map(item => item.key), ["central"])
  await assert.rejects(service.snapshot(motorist, "central"), code("WORKSPACE_FORBIDDEN"))
  await assert.rejects(service.snapshot(user(9), "company:viray"), code("WORKSPACE_FORBIDDEN"))
  await db.query("update public.provider_memberships set active=false where user_id=$1", [operator.id])
  await assert.rejects(service.snapshot(operator, operatorWorkspace), code("WORKSPACE_FORBIDDEN"))
})

test("cloud profile, preference and vehicle writes persist and enforce ownership", async () => {
  await service.saveProfile(motorist, { name: "  Saved Person  ", phone: "09171234567", email: "spoof@example.test", role: "central" })
  await service.savePreference(motorist, { enabled: false })
  const saved = await service.saveVehicle(motorist, vehicle())
  await service.saveVehicle(motorist, { ...saved, color: "White" })
  await assert.rejects(service.saveVehicle(user(2), { ...saved, color: "Stolen" }), code("NOT_FOUND"))
  await assert.rejects(service.saveVehicle(motorist, { ...vehicle(402), plate: "abc1234" }), code("CONFLICT"))
  await service.removeVehicle(user(2), saved.id)
  const fresh = await new PostgresDispatch(transaction).session(motorist)
  assert.equal(fresh.profile.name, "Saved Person")
  assert.equal(fresh.profile.email, motorist.email)
  assert.equal(fresh.profile.phone, "+639171234567")
  assert.equal(fresh.bookingUpdates, false)
  assert.equal(fresh.vehicles.length, 1)
  assert.equal(fresh.vehicles[0].color, "White")
  assert.equal((await service.session(user(2))).vehicles.length, 0)
  await service.removeVehicle(motorist, saved.id)
  assert.equal((await service.session(motorist)).vehicles.length, 0)
})

test("cloud creation uses owned vehicle snapshots, authoritative prices and durable idempotency", async () => {
  const input = await request()
  const booking = await service.create(motorist, "motorist", input)
  assert.equal(booking.motoristId, motorist.id)
  assert.equal(booking.vehicle.make, "Toyota")
  assert.equal(booking.providerName, "Test provider A")
  assert.equal(booking.quote.total, 1685)
  await service.saveVehicle(motorist, { ...booking.vehicle, color: "Red" })
  const replay = await new PostgresDispatch(transaction).create(motorist, "motorist", input)
  assert.equal(replay.id, booking.id)
  assert.equal(replay.vehicle.color, "Black")
  await assert.rejects(service.create(motorist, "motorist", { ...input, draft: { ...input.draft, notes: "Changed" } }), code("IDEMPOTENCY_CONFLICT"))
  await assert.rejects(service.create(motorist, "motorist", { ...input, requestId: crypto.randomUUID() }), code("ACTIVE_BOOKING"))
  await assert.rejects(service.create(user(2), "motorist", input), code("INVALID_REQUEST"))
  assert.equal((await db.query("select * from app_private.booking_requests")).rows.length, 1)
  assert.equal((await db.query("select * from public.booking_events")).rows.length, 1)
})

test("cloud dispatch lifecycle preserves isolation, versions, audit identity and ratings", async () => {
  let booking = await service.create(motorist, "motorist", await request())
  assert.equal((await service.snapshot(user(2), "motorist")).bookings.length, 0)
  assert.equal((await service.snapshot(user(7), "company:motor-trust")).bookings.length, 0)
  await assert.rejects(service.command(user(7), "company:motor-trust", booking.id, { action: "cancel", expectedVersion: 1, reason: "Forged", role: "central" }), code("NOT_FOUND"))
  booking = await service.command(operator, operatorWorkspace, booking.id, { action: "accept", expectedVersion: booking.version })
  assert.equal(booking.operatorId, uid(101))
  assert.equal(booking.events[1].actorId, operator.id)
  assert.equal((await service.snapshot(user(4), `operator:${uid(102)}`)).bookings.length, 0)
  await assert.rejects(service.command(operator, operatorWorkspace, booking.id, { action: "advance", expectedVersion: 1 }), code("STALE_VERSION"))
  while (booking.status !== "completed") booking = await service.command(operator, operatorWorkspace, booking.id, { action: "advance", expectedVersion: booking.version })
  booking = await service.command(motorist, "motorist", booking.id, { action: "rate", expectedVersion: booking.version, rating: 5 })
  const saved = (await new PostgresDispatch(transaction).snapshot(motorist, "motorist")).bookings[0]
  assert.equal(saved.rating, 5)
  assert.equal(saved.events.length, saved.version)
  assert.equal(saved.status, "completed")
  assert.equal(saved.quote.total, booking.quote.total)
})

test("cloud declines, busy operators and central cancellation use the shared rules", async () => {
  let first = await service.create(motorist, "motorist", await request())
  first = await service.command(operator, operatorWorkspace, first.id, { action: "decline", expectedVersion: first.version })
  assert.equal((await service.snapshot(operator, operatorWorkspace)).bookings.length, 0)
  await assert.rejects(service.command(company, "company:viray", first.id, { action: "assign", operatorId: uid(101), expectedVersion: first.version }), code("INVALID_OPERATOR"))
  first = await service.command(company, "company:viray", first.id, { action: "assign", operatorId: uid(102), expectedVersion: first.version })
  const second = await service.create(user(2), "motorist", await request(user(2)))
  await assert.rejects(service.command(company, "company:viray", second.id, { action: "assign", operatorId: uid(102), expectedVersion: second.version }), code("OPERATOR_BUSY"))
  first = await service.command(central, "central", first.id, { action: "cancel", reason: "Sample cancellation", expectedVersion: first.version })
  assert.equal(first.cancellationReason, "Sample cancellation")
  assert.equal((await service.snapshot(central, "central")).bookings.length, 2)
})

test("failure to append an event rolls back the booking, version and request ledger", async () => {
  const input = await request()
  const failing = new PostgresDispatch(work => transaction(client => work({ query: async (sql, values) => {
    if (sql.startsWith("insert into public.booking_events")) throw new Error("Injected audit failure")
    return client.query(sql, values)
  } })))
  await assert.rejects(failing.create(motorist, "motorist", input), /Injected audit failure/)
  assert.equal((await db.query("select * from public.bookings")).rows.length, 0)
  assert.equal((await db.query("select * from app_private.booking_requests")).rows.length, 0)
  const booking = await service.create(motorist, "motorist", input)
  await assert.rejects(failing.command(operator, operatorWorkspace, booking.id, { action: "accept", expectedVersion: 1 }), /Injected audit failure/)
  const saved = (await service.snapshot(motorist, "motorist")).bookings[0]
  assert.equal(saved.version, 1)
  assert.equal(saved.status, "searching")
  assert.equal(saved.events.length, 1)
})

test("cloud HTTP requires a verified bearer token, ignores fixture headers and rejects foreign origins", async () => {
  let verifications = 0
  const handler = cloudHandler(service, async token => {
    verifications++
    if (token !== "valid-test-token") throw new ApiError(401, "INVALID_TOKEN", "Invalid token")
    return motorist
  })
  const server = createServer((req, res) => void handler(req, res))
  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v2`
  try {
    assert.equal((await fetch(`${url}/session`, { headers: { "X-Demo-Actor": "central-demo" } })).status, 401)
    assert.equal((await fetch(`${url}/session`, { headers: { Authorization: "Bearer forged" } })).status, 401)
    const headers = { Authorization: "Bearer valid-test-token", "X-Demo-Actor": "central-demo" }
    const session = await fetch(`${url}/session`, { headers })
    assert.equal(session.status, 200)
    assert.equal(session.headers.get("cache-control"), "no-store")
    assert.deepEqual((await session.json()).workspaces.map((item: { key: string }) => item.key), ["motorist"])
    assert.equal((await fetch(`${url}/snapshot`, { headers: { ...headers, "X-Workspace": "central" } })).status, 403)
    assert.equal((await fetch(`${url}/session`, { headers: { ...headers, Origin: "https://foreign.example" } })).status, 403)
    assert.equal((await fetch(`${url}/vehicles`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: "{" })).status, 400)
    assert.equal(verifications, 4)
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())) }
})

test("database configuration pins the project, session pooler and verified TLS without URI overrides", () => {
  const project = "pgfpftflyggnmqrveubk"
  const env = { VITE_SUPABASE_URL: `https://${project}.supabase.co`, DATABASE_URL: `postgresql://postgres.${project}:test-only@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=disable` }
  const config = databaseConfig(env)
  assert.equal(config.ssl.rejectUnauthorized, true)
  assert.equal(config.port, 5432)
  assert.throws(() => databaseConfig({ ...env, DATABASE_URL: env.DATABASE_URL.replace(":5432", ":6543") }))
  assert.throws(() => databaseConfig({ ...env, DATABASE_URL: env.DATABASE_URL.replace("aws-1-ap-southeast-1.pooler.supabase.com", "untrusted.example") }))
  assert.throws(() => databaseConfig({ ...env, DATABASE_URL: "not-a-connection-uri" }))
})
