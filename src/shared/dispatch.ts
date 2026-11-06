import type { Booking, Draft, Service, Vehicle } from "../motorist/model.ts"

export type Actor = {
  id: string
  userId?: string
  name: string
  role: "motorist" | "operator" | "company" | "central"
  providerId?: string
  truck?: string
}

// Public development fixtures, never credentials. Production must replace these
// with a verified server session; selecting a fixture is not authentication.
export const demoActors: Actor[] = [
  { id: "motorist-demo", name: "Demo motorist", role: "motorist" },
  {
    id: "operator-viray",
    name: "Marco Reyes",
    role: "operator",
    providerId: "viray",
    truck: "Flatbed · VT 001",
  },
  {
    id: "operator-viray-2",
    name: "Ana Santos",
    role: "operator",
    providerId: "viray",
    truck: "Flatbed · VT 002",
  },
  {
    id: "operator-motor-trust",
    name: "Luis Cruz",
    role: "operator",
    providerId: "motor-trust",
    truck: "Flatbed · MT 001",
  },
  {
    id: "company-viray",
    name: "Viray dispatch",
    role: "company",
    providerId: "viray",
  },
  {
    id: "company-motor-trust",
    name: "Motor Trust dispatch",
    role: "company",
    providerId: "motor-trust",
  },
  { id: "central-demo", name: "LigtasTow operations", role: "central" },
]

export type BookingEvent = {
  id: string
  at: string
  actorId: string
  actorName: string
  action: string
  detail: string
}

export type DispatchBooking = Booking & {
  motoristId: string
  version: number
  updatedAt: string
  operatorId?: string
  operatorName?: string
  declinedOperatorIds: string[]
  events: BookingEvent[]
}

export type CreateBooking = {
  draft: Draft
  vehicle: Vehicle
  requestId: string
}
export type BookingCommand = {
  action: "accept" | "decline" | "assign" | "advance" | "cancel" | "rate"
  expectedVersion: number
  operatorId?: string
  reason?: string
  rating?: number
}
export type DispatchSnapshot = {
  bookings: DispatchBooking[]
  operators: Actor[]
}

export type Workspace = {
  key: string
  actor: Actor
}

export const isActive = (booking: Booking) =>
  booking.status === "searching" || booking.status === "assigned"
export function bookingStages(service: Service) {
  const tow = service === "Tow Truck" || service === "Emergency Tow"
  return [
    "Request received",
    "Operator assigned",
    "Operator en route",
    "Operator arrived",
    "Vehicle inspection",
    tow ? "Vehicle loaded" : "Assistance provided",
  ]
}
export function progressLabel(booking: Booking) {
  if (booking.status === "completed") return "Service completed"
  if (booking.status === "cancelled") return "Request cancelled"
  if (booking.status === "searching") return "Awaiting operator"
  return bookingStages(booking.service)[booking.stage]
}
