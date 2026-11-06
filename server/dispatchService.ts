import { randomUUID } from "node:crypto"
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import {
  isVehicle,
  makeBooking,
  services,
  type Draft,
} from "../src/motorist/model.ts"
import {
  bookingStages,
  demoActors,
  isActive,
  progressLabel,
  type Actor,
  type BookingCommand,
  type DispatchBooking,
  type DispatchSnapshot,
} from "../src/shared/dispatch.ts"

export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}
function fail(status: number, code: string, message: string): never {
  throw new ApiError(status, code, message)
}
type Database = {
  schemaVersion: 1
  bookings: DispatchBooking[]
  creations: Record<string, {
    bookingId: string
    payload: string
  }>
}
const emptyDatabase = (): Database => ({
  schemaVersion: 1,
  bookings: [],
  creations: {},
})
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value)

export class DispatchService {
  private database: Database
  private file?: string
  private actors: Actor[]
  constructor(file?: string, seed?: { bookings: DispatchBooking[]; actors: Actor[] }) {
    this.file = file
    this.database = emptyDatabase()
    this.actors = seed?.actors ?? demoActors
    if (seed) this.database.bookings = structuredClone(seed.bookings)
    if (file) {
      try {
        const data = JSON.parse(readFileSync(file, "utf8"))
        if (
          data.schemaVersion !== 1 ||
          !Array.isArray(data.bookings) ||
          !object(data.creations) ||
          !data.bookings.every(
            (b: DispatchBooking) =>
              object(b) &&
              typeof b.id === "string" &&
              Number.isInteger(b.version) &&
              Array.isArray(b.events) &&
              Array.isArray(b.declinedOperatorIds) &&
              isVehicle(b.vehicle),
          )
        ) {
          throw new Error("Invalid dispatch database schema")
        }
        this.database = data
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
      }
    }
  }
  private commit(next: Database) {
    // Synchronous commit serializes mutations within this single development
    // process. Atomic replacement prevents truncated writes being accepted.
    if (this.file) {
      mkdirSync(dirname(this.file), { recursive: true })
      const temporary = `${this.file}.tmp`
      writeFileSync(temporary, JSON.stringify(next, null, 2), {
        encoding: "utf8",
        mode: 0o600,
      })
      renameSync(temporary, this.file)
    }
    this.database = next
  }
  private visible(actor: Actor, booking: DispatchBooking) {
    if (actor.role === "central") return true
    if (actor.role === "motorist") return actor.id === booking.motoristId
    if (actor.providerId !== booking.providerId) return false
    return (
      actor.role === "company" ||
      booking.operatorId === actor.id ||
      (booking.status === "searching" &&
        !booking.declinedOperatorIds.includes(actor.id))
    )
  }
  snapshot(actor: Actor): DispatchSnapshot {
    return structuredClone({
      bookings: this.database.bookings.filter((b) => this.visible(actor, b)),
      operators:
        actor.role === "motorist"
          ? []
          : this.actors.filter(
              (a) =>
                a.role === "operator" &&
                (actor.role === "central" || a.providerId === actor.providerId),
            ),
    })
  }
  create(actor: Actor, input: unknown): DispatchBooking {
    if (actor.role !== "motorist")
      fail(403, "FORBIDDEN", "Only a motorist can request assistance.")
    if (
      !object(input) ||
      !object(input.draft) ||
      !isVehicle(input.vehicle) ||
      typeof input.requestId !== "string" ||
      !/^[a-zA-Z0-9-]{8,100}$/.test(input.requestId)
    ) {
      fail(
        400,
        "INVALID_REQUEST",
        "Provide a valid request identifier, vehicle and booking details.",
      )
    }
    const raw = input.draft
    for (const key of [
      "service",
      "vehicleId",
      "incident",
      "notes",
      "pickup",
      "destination",
      "providerId",
    ]) {
      if (typeof raw[key] !== "string")
        fail(400, "INVALID_REQUEST", `Missing or invalid ${key}.`)
    }
    if (
      !services.some((s) => s.name === raw.service) ||
      (raw.pickup as string).length > 180 ||
      (raw.destination as string).length > 180
    ) {
      fail(
        400,
        "INVALID_REQUEST",
        "Choose a supported service and addresses up to 180 characters.",
      )
    }
    // Select fields explicitly: never trust client fare, owner, status or operator.
    const draft = Object.fromEntries(
      [
        "service",
        "vehicleId",
        "incident",
        "notes",
        "pickup",
        "destination",
        "providerId",
      ].map((key) => [key, raw[key]]),
    ) as Draft
    if (draft.vehicleId !== input.vehicle.id)
      fail(
        400,
        "INVALID_REQUEST",
        "The selected vehicle does not match the request.",
      )
    const payload = JSON.stringify({ draft, vehicle: input.vehicle })
    const key = `${actor.id}:${input.requestId}`
    const prior = this.database.creations[key]
    if (prior) {
      if (prior.payload !== payload)
        fail(
          409,
          "IDEMPOTENCY_CONFLICT",
          "This request identifier was already used for different details.",
        )
      return structuredClone(
        this.database.bookings.find((b) => b.id === prior.bookingId)!,
      )
    }
    if (
      this.database.bookings.some(
        (b) => b.motoristId === actor.id && isActive(b),
      )
    )
      fail(
        409,
        "ACTIVE_BOOKING",
        "You already have an active request. Open History to continue it.",
      )
    let base
    try {
      base = makeBooking(draft, [input.vehicle])
    } catch (error) {
      fail(
        400,
        "INVALID_REQUEST",
        error instanceof Error ? error.message : "Review the booking details.",
      )
    }
    const booking: DispatchBooking = {
      ...base,
      id: `LT-${randomUUID()}`,
      motoristId: actor.id,
      version: 1,
      updatedAt: base.createdAt,
      declinedOperatorIds: [],
      events: [],
    }
    this.event(
      booking,
      actor,
      "created",
      "Request received by the selected provider.",
    )
    this.commit({
      ...this.database,
      bookings: [booking, ...this.database.bookings],
      creations: {
        ...this.database.creations,
        [key]: { bookingId: booking.id, payload },
      },
    })
    return structuredClone(booking)
  }
  private event(
    booking: DispatchBooking,
    actor: Actor,
    action: string,
    detail: string,
  ) {
    booking.events.push({
      id: randomUUID(),
      at: booking.updatedAt,
      actorId: actor.userId ?? actor.id,
      actorName: actor.name,
      action,
      detail,
    })
  }
  command(actor: Actor, id: string, input: unknown): DispatchBooking {
    const current = this.database.bookings.find((b) => b.id === id)
    if (!current || !this.visible(actor, current))
      fail(
        404,
        "NOT_FOUND",
        "This booking is unavailable for the selected workspace.",
      )
    if (
      !object(input) ||
      !Number.isInteger(input.expectedVersion) ||
      typeof input.action !== "string"
    )
      fail(
        400,
        "INVALID_REQUEST",
        "Provide an action and the current booking version.",
      )
    if (current.version !== input.expectedVersion)
      fail(
        409,
        "STALE_VERSION",
        "This booking changed. Refresh it before trying again.",
      )
    const command = input as unknown as BookingCommand
    const booking = structuredClone(current)
    let detail = ""
    const manager = actor.role === "company" || actor.role === "central"
    if (command.action === "accept" || command.action === "assign") {
      if (command.action === "accept" ? actor.role !== "operator" : !manager)
        fail(403, "FORBIDDEN", "This workspace cannot assign an operator.")
      if (booking.status !== "searching")
        fail(409, "INVALID_STATE", "Only a waiting request can be assigned.")
      const operator = this.actors.find(
        (a) =>
          a.id ===
            (command.action === "accept" ? actor.id : command.operatorId) &&
          a.role === "operator" &&
          a.providerId === booking.providerId,
      )
      if (!operator || booking.declinedOperatorIds.includes(operator.id))
        fail(
          400,
          "INVALID_OPERATOR",
          "Choose an eligible operator from this provider.",
        )
      if (
        this.database.bookings.some(
          (b) => b.operatorId === operator.id && isActive(b),
        )
      )
        fail(409, "OPERATOR_BUSY", "This operator already has an active job.")
      booking.operatorId = operator.id
      booking.operatorName = operator.name
      booking.status = "assigned"
      booking.stage = 1
      detail = `Assigned to ${operator.name}.`
    } else if (command.action === "decline") {
      if (actor.role !== "operator")
        fail(403, "FORBIDDEN", "Only an operator can decline an offer.")
      if (booking.status !== "searching")
        fail(409, "INVALID_STATE", "Only a waiting offer can be declined.")
      booking.declinedOperatorIds.push(actor.id)
      detail =
        "Offer declined; request remains available to other eligible operators."
    } else if (command.action === "advance") {
      if (actor.role !== "operator" || actor.id !== booking.operatorId)
        fail(
          403,
          "FORBIDDEN",
          "Only the assigned operator can update progress.",
        )
      if (booking.status !== "assigned")
        fail(409, "INVALID_STATE", "Only an assigned job can progress.")
      if (booking.stage === bookingStages(booking.service).length - 1)
        booking.status = "completed"
      else booking.stage += 1
      detail = progressLabel(booking)
    } else if (command.action === "cancel") {
      if (actor.role !== "motorist" && !manager)
        fail(403, "FORBIDDEN", "Contact your dispatcher to cancel this job.")
      if (!isActive(booking))
        fail(409, "INVALID_STATE", "This request has already ended.")
      if (actor.role === "motorist" && booking.stage >= 4)
        fail(
          409,
          "CANCELLATION_REVIEW",
          "Service has started. Ask the dispatcher to review cancellation.",
        )
      if (
        typeof command.reason !== "string" ||
        !command.reason.trim() ||
        command.reason.trim().length > 300
      )
        fail(
          400,
          "INVALID_REASON",
          "Enter a cancellation reason between 1 and 300 characters.",
        )
      booking.status = "cancelled"
      booking.cancellationReason = command.reason.trim()
      detail = booking.cancellationReason
    } else if (command.action === "rate") {
      if (actor.role !== "motorist")
        fail(
          403,
          "FORBIDDEN",
          "Only the requesting motorist can rate the service.",
        )
      if (booking.status !== "completed")
        fail(
          409,
          "INVALID_STATE",
          "Ratings are available after service completion.",
        )
      if (
        !Number.isInteger(command.rating) ||
        command.rating! < 1 ||
        command.rating! > 5
      )
        fail(400, "INVALID_RATING", "Choose a rating between 1 and 5.")
      booking.rating = command.rating
      detail = `Service rated ${command.rating}/5.`
    } else fail(400, "INVALID_ACTION", "Unknown booking action.")
    booking.version += 1
    booking.updatedAt = new Date().toISOString()
    this.event(booking, actor, command.action, detail)
    this.commit({
      ...this.database,
      bookings: this.database.bookings.map((b) => (b.id === id ? booking : b)),
    })
    return structuredClone(booking)
  }
}
