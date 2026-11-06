export const vehicleTypes = [
  "Sedan",
  "SUV",
  "Pickup",
  "Motorcycle",
  "Van",
] as const
export type Vehicle = {
  id: string
  make: string
  model: string
  year: string
  type: string
  color: string
  plate: string
}
export const services = [
  {
    name: "Tow Truck",
    icon: "truck",
    description: "Vehicle transport and recovery",
    base: 1200,
  },
  {
    name: "Jump Start",
    icon: "wrench",
    description: "Restart a drained battery",
    base: 650,
  },
  {
    name: "Flat Tire",
    icon: "car",
    description: "Tire replacement assistance",
    base: 800,
  },
  {
    name: "Fuel Refill",
    icon: "fuel",
    description: "Emergency fuel delivery",
    base: 500,
  },
  {
    name: "Emergency Tow",
    icon: "sos",
    description: "Priority towing request",
    base: 1200,
  },
] as const
export type Service = typeof services[number]["name"]
export const incidents = [
  "Engine failure",
  "Accident",
  "Flat tire",
  "Battery problem",
  "Overheating",
  "Other",
]
export const providers = [
  {
    id: "viray",
    name: "Viray Towing Services",
    area: "Cubao, Quezon City",
    eta: "8–12 min",
    rating: "4.9",
    initials: "VT",
    adjustment: 0,
  },
  {
    id: "motor-trust",
    name: "Motor Trust Towing",
    area: "Ortigas Center",
    eta: "14–18 min",
    rating: "4.8",
    initials: "MT",
    adjustment: 100,
  },
]
export const savedPlaces = [
  { name: "Home", address: "Aurora Boulevard, Cubao" },
  { name: "Work", address: "Ortigas Center, Pasig" },
  { name: "Service center", address: "Quezon Avenue, Quezon City" },
]
export type Screen = "home" | "search" | "history" | "profile" | "edit-profile" | "vehicles" | "vehicle" | "booking" | "searching" | "tracking" | "notifications" | "location" | "receipt" | "settings"
export type Route = {
  screen: Screen
  step?: number
  id?: string
}
export type Draft = {
  service: Service
  vehicleId: string
  incident: string
  notes: string
  pickup: string
  destination: string
  providerId: string
}
export type Quote = {
  base: number
  travel: number
  fee: number
  provider: number
  total: number
}
export type Booking = Omit<Draft, "vehicleId"> & {
  id: string
  vehicle: Vehicle
  providerName: string
  createdAt: string
  quote: Quote
  status: "searching" | "assigned" | "completed" | "cancelled"
  stage: number
  cancellationReason?: string
  rating?: number
}
export const initialVehicles: Vehicle[] = [
  {
    id: "vios",
    make: "Toyota",
    model: "Vios",
    year: "2019",
    type: "Sedan",
    color: "Black",
    plate: "ABC 1234",
  },
]
export const vehicleName = (vehicle: Vehicle) =>
  `${vehicle.year} ${vehicle.make} ${vehicle.model}`
export const money = (amount: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(amount)
export const isTow = (service: Service) =>
  service === "Tow Truck" || service === "Emergency Tow"
export const normalizePlate = (plate: string) =>
  plate.toUpperCase().replace(/[^A-Z0-9]/g, "")
export function quoteFor(service: Service, providerId: string): Quote {
  const base = services.find((item) => item.name === service)?.base ?? 1200
  const travel = isTow(service) ? 390 : 0
  const fee = 95
  const provider =
    providers.find((item) => item.id === providerId)?.adjustment ?? 0
  return { base, travel, fee, provider, total: base + travel + fee + provider }
}
export function newDraft(
  vehicles: Vehicle[],
  pickup: string,
  service: Service = "Tow Truck",
  providerId = providers[0].id,
): Draft {
  return {
    service,
    providerId,
    vehicleId: vehicles[0]?.id ?? "",
    incident:
      service === "Jump Start"
        ? "Battery problem"
        : service === "Flat Tire"
          ? "Flat tire"
          : service === "Fuel Refill"
            ? "Other"
            : "",
    notes: "",
    pickup,
    destination: "Quezon Avenue, Quezon City",
  }
}
export function validateVehicle(
  vehicle: Vehicle,
  vehicles: Vehicle[],
): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const field of ["make", "model", "color"] as const)
    if (!vehicle[field].trim()) errors[field] = `Enter the vehicle ${field}.`
  if (
    !/^\d{4}$/.test(vehicle.year) ||
    Number(vehicle.year) < 1900 ||
    Number(vehicle.year) > new Date().getFullYear() + 1
  )
    errors.year = "Enter a valid four-digit model year."
  if (!(vehicleTypes as readonly string[]).includes(vehicle.type))
    errors.type = "Choose a vehicle type."
  if (
    !/^[A-Z0-9 -]{3,12}$/i.test(vehicle.plate.trim()) ||
    normalizePlate(vehicle.plate).length < 3
  )
    errors.plate =
      "Enter a plate or temporary registration (3–12 letters, numbers, spaces or hyphens)."
  else if (
    vehicles.some(
      (item) =>
        item.id !== vehicle.id &&
        normalizePlate(item.plate) === normalizePlate(vehicle.plate),
    )
  )
    errors.plate =
      "This plate is already saved. Edit the existing vehicle instead."
  return errors
}
export function validateStep(
  step: number,
  draft: Draft,
  vehicles: Vehicle[],
): string | undefined {
  if (step === 1 && !vehicles.some((vehicle) => vehicle.id === draft.vehicleId))
    return "Choose a saved vehicle or add one to continue."
  if (step === 2) {
    if (!incidents.includes(draft.incident))
      return "Choose the incident that best describes the problem."
    if (draft.incident === "Other" && !draft.notes.trim())
      return "Describe the problem so the provider knows what assistance you need."
    if (draft.notes.length > 500) return "Keep notes within 500 characters."
  }
  if (step === 3) {
    if (draft.pickup.trim().length < 5)
      return "Enter a pickup address with at least five characters."
    if (isTow(draft.service) && draft.destination.trim().length < 5)
      return "Enter a destination address with at least five characters."
    if (
      isTow(draft.service) &&
      draft.pickup.trim().toLowerCase() ===
        draft.destination.trim().toLowerCase()
    )
      return "Pickup and destination must be different."
  }
  if (
    step === 4 &&
    !providers.some((provider) => provider.id === draft.providerId)
  )
    return "Choose a provider to continue."
}
export function makeBooking(draft: Draft, vehicles: Vehicle[]): Booking {
  for (let step = 1; step <= 4; step++) {
    const error = validateStep(step, draft, vehicles)
    if (error) throw new Error(error)
  }
  const { vehicleId, ...details } = draft
  return {
    ...details,
    pickup: draft.pickup.trim(),
    destination: isTow(draft.service)
      ? draft.destination.trim()
      : "Assistance at pickup",
    notes: draft.notes.trim(),
    id: `LT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    vehicle: { ...vehicles.find((vehicle) => vehicle.id === vehicleId)! },
    providerName: providers.find(
      (provider) => provider.id === draft.providerId,
    )!.name,
    quote: quoteFor(draft.service, draft.providerId),
    createdAt: new Date().toISOString(),
    status: "searching",
    stage: 0,
  }
}
export const isVehicle = (value: unknown): value is Vehicle => {
  if (!value || typeof value !== "object") return false
  const vehicle = value as Vehicle
  return (
    ["id", "make", "model", "year", "type", "color", "plate"].every(
      (key) => typeof vehicle[(key as keyof Vehicle)] === "string",
    ) && !Object.keys(validateVehicle(vehicle, [])).length
  )
}
export function readVehicles(raw: string | null): Vehicle[] {
  if (raw === null) return initialVehicles.map((vehicle) => ({ ...vehicle }))
  try {
    const parsed: unknown = JSON.parse(raw)
    if (
      Array.isArray(parsed) &&
      parsed.every(isVehicle) &&
      new Set(parsed.map((item) => normalizePlate(item.plate))).size ===
        parsed.length &&
      new Set(parsed.map((item) => item.id)).size === parsed.length
    )
      return parsed
  } catch {
    /* A corrupt local save must not prevent the app from opening. */
  }
  return initialVehicles.map((vehicle) => ({ ...vehicle }))
}
export function matchesQuery(query: string, ...values: string[]) {
  const words = query.toLocaleLowerCase().trim().split(/\s+/)
  const text = values.join(" ").toLocaleLowerCase()
  return words.every((word) => text.includes(word))
}
