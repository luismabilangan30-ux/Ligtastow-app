import { isDeepStrictEqual } from "node:util"
import { isVehicle, providers, type Draft, type Vehicle } from "../src/motorist/model.ts"
import { cleanProfile, validateProfile } from "../src/motorist/profileModel.ts"
import type { AccountSession } from "../src/shared/account.ts"
import type { Actor, DispatchBooking, Workspace } from "../src/shared/dispatch.ts"
import { ApiError, DispatchService } from "./dispatchService.ts"
import type { SqlClient, TransactionRunner } from "./database.ts"

export type VerifiedUser = { id: string; email: string }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const record = (input: unknown): input is Record<string, unknown> => !!input && typeof input === "object" && !Array.isArray(input)
function invalid(message: string): never { throw new ApiError(400, "INVALID_REQUEST", message) }
function missing(): never { throw new ApiError(404, "NOT_FOUND", "This record is unavailable for your account or workspace.") }
const dbId = (id: string) => {
  const value = id.startsWith("LT-") ? id.slice(3) : id
  if (!uuid.test(value)) missing()
  return value.toLowerCase()
}
const date = (value: Date | string) => new Date(value).toISOString()
const vehicleRow = (row: Record<string, any>): Vehicle => ({
  id: row.id, make: row.make, model: row.model, year: String(row.year), type: row.type, color: row.color, plate: row.plate,
})

async function workspaces(client: SqlClient, user: VerifiedUser): Promise<Workspace[]> {
  const { rows: [profile] } = await client.query("select display_name from public.profiles where id=$1", [user.id])
  if (!profile) throw new ApiError(409, "PROFILE_MISSING", "Your account profile is not ready. Ask the project owner to check the database migration.")
  const result: Workspace[] = []
  const { rows } = await client.query(`select m.provider_id, m.role, p.name as provider_name,
    o.id as operator_id, o.display_name, o.truck_label, o.active as operator_active
    from public.provider_memberships m join public.providers p on p.id=m.provider_id
    left join public.operators o on o.membership_id=m.id where m.user_id=$1 and m.active`, [user.id])
  for (const row of rows) {
    if (row.role === "company") result.push({ key: `company:${row.provider_id}`, actor: {
      id: user.id, userId: user.id, role: "company", name: row.provider_name, providerId: row.provider_id,
    } })
    if (row.role === "operator" && row.operator_active) result.push({ key: `operator:${row.operator_id}`, actor: {
      id: row.operator_id, userId: user.id, role: "operator", name: row.display_name, providerId: row.provider_id, truck: row.truck_label,
    } })
  }
  const central = await client.query("select 1 from app_private.central_admins where user_id=$1 and active", [user.id])
  if (central.rows.length) result.push({ key: "central", actor: { id: user.id, userId: user.id, name: profile.display_name, role: "central" } })
  // Only offer the Motorist workspace to accounts with no staff roles
  if (result.length === 0) result.unshift({ key: "motorist", actor: { id: user.id, userId: user.id, name: profile.display_name, role: "motorist" } })
  return result
}

async function actorFor(client: SqlClient, user: VerifiedUser, workspace: string) {
  const actor = (await workspaces(client, user)).find(item => item.key === workspace)?.actor
  if (!actor) throw new ApiError(403, "WORKSPACE_FORBIDDEN", "This workspace is not assigned to your account. Sign in again to refresh your access.")
  return actor
}

async function roster(client: SqlClient, actor: Actor): Promise<Actor[]> {
  if (actor.role === "motorist") return []
  const { rows } = await client.query(`select o.*, m.user_id from public.operators o
    join public.provider_memberships m on m.id=o.membership_id
    where o.active and m.active and ($1::text is null or o.provider_id=$1) order by o.display_name`,
  [actor.role === "central" ? null : actor.providerId])
  return rows.map(row => ({ id: row.id, userId: row.user_id, name: row.display_name, role: "operator", providerId: row.provider_id, truck: row.truck_label }))
}

async function bookings(client: SqlClient, where: string, values: unknown[]): Promise<DispatchBooking[]> {
  // One SQL statement keeps each booking, its version and its event history in the same snapshot.
  const { rows } = await client.query(`select b.*, o.display_name as operator_name, r.rating,
    coalesce((select jsonb_agg(d.operator_id order by d.created_at, d.operator_id) from public.booking_declines d where d.booking_id=b.id), '[]') as declines,
    coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'at', e.created_at, 'actorId', e.actor_user_id,
      'actorName', e.actor_name_snapshot, 'action', e.action, 'detail', e.detail) order by e.booking_version)
      from public.booking_events e where e.booking_id=b.id), '[]') as events
    from public.bookings b left join public.operators o on o.id=b.operator_id
    left join public.booking_ratings r on r.booking_id=b.id where ${where} order by b.created_at desc, b.id`, values)
  return rows.map(row => ({
    id: `LT-${row.id}`, motoristId: row.motorist_id, providerId: row.provider_id, providerName: row.provider_name_snapshot,
    operatorId: row.operator_id ?? undefined, operatorName: row.operator_name ?? undefined,
    service: row.service, vehicle: row.vehicle_snapshot, incident: row.incident, notes: row.notes,
    pickup: row.pickup, destination: row.destination, status: row.status, stage: row.stage,
    version: row.version, createdAt: date(row.created_at), updatedAt: date(row.updated_at),
    cancellationReason: row.cancellation_reason ?? undefined, rating: row.rating ?? undefined,
    declinedOperatorIds: row.declines, events: row.events,
    quote: { base: Number(row.base_centavos)/100, travel: Number(row.travel_centavos)/100,
      provider: Number(row.provider_centavos)/100, fee: Number(row.platform_centavos)/100, total: Number(row.total_centavos)/100 },
  }))
}

async function addEvent(client: SqlClient, booking: DispatchBooking) {
  const event = booking.events[booking.events.length - 1]
  await client.query(`insert into public.booking_events(id, booking_id, booking_version, actor_user_id, actor_name_snapshot, action, detail, created_at)
    values ($1,$2,$3,$4,$5,$6,$7,$8)`, [event.id, dbId(booking.id), booking.version, event.actorId, event.actorName, event.action, event.detail, event.at])
}

export class PostgresDispatch {
  private transaction: TransactionRunner
  constructor(transaction: TransactionRunner) { this.transaction = transaction }

  private async run<T>(work: (client: SqlClient) => Promise<T>) {
    try { return await this.transaction(work) }
    catch (error) {
      const code = (error as { code?: string }).code
      if (code === "23505") throw new ApiError(409, "CONFLICT", "A matching vehicle, active booking or operator assignment already exists. Refresh and try again.")
      if (["40001", "40P01", "55P03"].includes(code ?? "")) throw new ApiError(409, "RETRY_TRANSACTION", "Another update is being saved. Refresh and retry this action.")
      throw error
    }
  }

  session(user: VerifiedUser): Promise<AccountSession> {
    return this.run(async client => {
      const available = await workspaces(client, user)
      const { rows: [profile] } = await client.query("select display_name, phone, booking_updates from public.profiles where id=$1", [user.id])
      const vehicles = await client.query("select * from public.vehicles where owner_id=$1 order by created_at, id", [user.id])
      const providerRows = await client.query("select id, name, area from public.providers where active and id=any($1::text[]) order by name", [providers.map(item => item.id)])
      return { userId: user.id, profile: { name: profile.display_name, email: user.email, phone: profile.phone ?? "" },
        bookingUpdates: profile.booking_updates, vehicles: vehicles.rows.map(vehicleRow), workspaces: available,
        providers: providerRows.rows as AccountSession["providers"] }
    })
  }

  snapshot(user: VerifiedUser, workspace: string) {
    return this.run(async client => {
      const actor = await actorFor(client, user, workspace)
      let where: string, args: unknown[]
      if (actor.role === "central") { where = "true"; args = [] }
      else if (actor.role === "motorist") { where = "b.motorist_id=$1"; args = [user.id] }
      else if (actor.role === "company") { where = "b.provider_id=$1"; args = [actor.providerId] }
      else {
        where = `b.provider_id=$1 and (b.operator_id=$2 or (b.status='searching' and not exists
          (select 1 from public.booking_declines d where d.booking_id=b.id and d.operator_id=$2)))`
        args = [actor.providerId, actor.id]
      }
      return { bookings: await bookings(client, where, args), operators: await roster(client, actor) }
    })
  }

  create(user: VerifiedUser, workspace: string, input: unknown) {
    return this.run(async client => {
      const actor = await actorFor(client, user, workspace)
      if (actor.role !== "motorist") throw new ApiError(403, "FORBIDDEN", "Only a motorist can request assistance.")
      if (!record(input) || !record(input.draft) || typeof input.requestId !== "string" || !/^[a-zA-Z0-9-]{8,100}$/.test(input.requestId)) invalid("Provide a valid booking request and identifier.")
      const raw = input.draft as Record<string, unknown>
      const keys = ["service", "vehicleId", "incident", "notes", "pickup", "destination", "providerId"]
      if (!keys.every(key => typeof raw[key] === "string") || !uuid.test(raw.vehicleId as string)) invalid("Choose a saved vehicle and complete the booking details.")
      const draft = Object.fromEntries(keys.map(key => [key, raw[key]])) as Draft
      const payload = { draft }
      // Serialize this motorist's creation attempts, including retries with a shared request ID.
      await client.query("select id from public.profiles where id=$1 for update", [user.id])
      const { rows: [prior] } = await client.query("select booking_id, payload from app_private.booking_requests where motorist_id=$1 and request_id=$2", [user.id, input.requestId])
      if (prior) {
        if (!isDeepStrictEqual(prior.payload, payload)) throw new ApiError(409, "IDEMPOTENCY_CONFLICT", "This request identifier was used for different booking details.")
        return (await bookings(client, "b.id=$1 and b.motorist_id=$2", [prior.booking_id, user.id]))[0]
      }
      const { rows: [vehicle] } = await client.query("select * from public.vehicles where id=$1 and owner_id=$2 for share", [draft.vehicleId, user.id])
      if (!vehicle) invalid("Choose a vehicle saved in your account.")
      const { rows: [provider] } = await client.query("select name from public.providers where id=$1 and active for share", [draft.providerId])
      if (!provider) throw new ApiError(409, "PROVIDER_UNAVAILABLE", "This provider is not accepting requests. Refresh and choose an available provider.")
      const engine = new DispatchService(undefined, { actors: [], bookings: await bookings(client, "b.motorist_id=$1 and b.status in ('searching','assigned')", [user.id]) })
      // Client-supplied owner, prices, state and vehicle snapshot are never authoritative.
      const booking = engine.create(actor, { draft, vehicle: vehicleRow(vehicle), requestId: input.requestId })
      booking.providerName = provider.name
      await client.query(`insert into public.bookings(id,motorist_id,provider_id,provider_name_snapshot,service,vehicle_snapshot,
        incident,notes,pickup,destination,base_centavos,travel_centavos,provider_centavos,platform_centavos,created_at,updated_at)
        values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [dbId(booking.id), user.id, booking.providerId, booking.providerName, booking.service, JSON.stringify(booking.vehicle),
        booking.incident, booking.notes, booking.pickup, booking.destination, Math.round(booking.quote.base*100),
        Math.round(booking.quote.travel*100), Math.round(booking.quote.provider*100), Math.round(booking.quote.fee*100), booking.createdAt, booking.updatedAt])
      await addEvent(client, booking)
      await client.query("insert into app_private.booking_requests(motorist_id,request_id,booking_id,payload) values ($1,$2,$3,$4::jsonb)",
        [user.id, input.requestId, dbId(booking.id), JSON.stringify(payload)])
      return booking
    })
  }

  command(user: VerifiedUser, workspace: string, id: string, input: unknown) {
    return this.run(async client => {
      const actor = await actorFor(client, user, workspace)
      const target = dbId(id)
      await client.query("select id from public.bookings where id=$1 for update", [target])
      const current = (await bookings(client, "b.id=$1", [target]))[0]
      if (!current) missing()
      // Include active provider jobs so the shared domain rules detect a busy operator.
      const active = await bookings(client, "b.provider_id=$1 and b.status='assigned' and b.id<>$2", [current.providerId, target])
      const engine = new DispatchService(undefined, { actors: await roster(client, actor), bookings: [current, ...active] })
      const booking = engine.command(actor, current.id, input)
      if (booking.operatorId) await client.query("select id from public.operators where id=$1 for update", [booking.operatorId])
      await client.query(`update public.bookings set operator_id=$2,status=$3,stage=$4,version=$5,cancellation_reason=$6,updated_at=$7 where id=$1`,
        [target, booking.operatorId ?? null, booking.status, booking.stage, booking.version, booking.cancellationReason ?? null, booking.updatedAt])
      for (const operatorId of booking.declinedOperatorIds.filter(value => !current.declinedOperatorIds.includes(value))) {
        await client.query("insert into public.booking_declines(booking_id,operator_id,provider_id) values ($1,$2,$3)", [target, operatorId, booking.providerId])
      }
      if (record(input) && input.action === "rate") await client.query(`insert into public.booking_ratings(booking_id,motorist_id,rating) values ($1,$2,$3)
        on conflict (booking_id) do update set rating=excluded.rating`, [target, user.id, booking.rating])
      await addEvent(client, booking)
      return booking
    })
  }

  saveProfile(user: VerifiedUser, input: unknown) {
    if (!record(input) || typeof input.name !== "string" || typeof input.phone !== "string") invalid("Enter your name and optional mobile number.")
    const profile = cleanProfile({ name: input.name as string, phone: input.phone as string, email: user.email })
    const errors = validateProfile(profile)
    if (Object.keys(errors).length) invalid(Object.values(errors)[0]!)
    return this.run(async client => {
      const saved = await client.query("update public.profiles set display_name=$2,phone=$3 where id=$1 returning id", [user.id, profile.name, profile.phone || null])
      if (!saved.rows.length) missing()
      return profile
    })
  }

  savePreference(user: VerifiedUser, input: unknown) {
    if (!record(input) || typeof input.enabled !== "boolean") invalid("Choose whether booking updates are enabled.")
    return this.run(async client => {
      const saved = await client.query("update public.profiles set booking_updates=$2 where id=$1 returning booking_updates", [user.id, input.enabled])
      if (!saved.rows.length) missing()
      return { enabled: saved.rows[0].booking_updates as boolean }
    })
  }

  saveVehicle(user: VerifiedUser, input: unknown) {
    if (!isVehicle(input) || !uuid.test(input.id) || input.make.trim().length > 60 || input.model.trim().length > 60 ||
        input.color.trim().length > 40 || Number(input.year) < 1950) invalid("Review the vehicle details: make/model up to 60 characters, color up to 40, and year from 1950.")
    const vehicle = input as Vehicle
    return this.run(async client => {
      const saved = await client.query(`insert into public.vehicles(id,owner_id,make,model,year,type,color,plate) values ($1,$2,$3,$4,$5,$6,$7,$8)
        on conflict (id) do update set make=excluded.make, model=excluded.model, year=excluded.year, type=excluded.type,
        color=excluded.color, plate=excluded.plate where public.vehicles.owner_id=excluded.owner_id returning *`,
      [vehicle.id, user.id, vehicle.make.trim(), vehicle.model.trim(), Number(vehicle.year), vehicle.type, vehicle.color.trim(), vehicle.plate.trim().toUpperCase()])
      if (!saved.rows.length) missing()
      return vehicleRow(saved.rows[0])
    })
  }

  removeVehicle(user: VerifiedUser, id: string) {
    if (!uuid.test(id)) missing()
    return this.run(async client => {
      await client.query("delete from public.vehicles where id=$1 and owner_id=$2", [id, user.id])
      return { removed: true }
    })
  }
}
