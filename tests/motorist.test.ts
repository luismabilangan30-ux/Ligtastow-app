import assert from "node:assert/strict"
import { test } from "node:test"
import {
  initialVehicles,
  makeBooking,
  matchesQuery,
  newDraft,
  quoteFor,
  readVehicles,
  validateStep,
  validateVehicle,
} from "../src/motorist/model.ts"
import { parseRoute } from "../src/motorist/navigation.ts"

test("vehicle registration rejects duplicate plates even with spacing and case differences", () => {
  const duplicate = { ...initialVehicles[0], id: "new", plate: "abc-1234" }
  assert.match(
    validateVehicle(duplicate, initialVehicles).plate,
    /already saved/,
  )
  assert.deepEqual(validateVehicle(initialVehicles[0], initialVehicles), {})
})
test("vehicle registration validates empty fields, year, type and invalid registration", () => {
  const invalid = {
    id: "new",
    make: " ",
    model: "",
    color: "",
    type: "Spaceship",
    year: "1800",
    plate: "??",
  }
  assert.deepEqual(Object.keys(validateVehicle(invalid, [])).sort(), [
    "color",
    "make",
    "model",
    "plate",
    "type",
    "year",
  ])
})
test("vehicle storage preserves intentional deletion and safely handles malformed data", () => {
  assert.deepEqual(readVehicles("[]"), [])
  assert.deepEqual(readVehicles("{broken"), initialVehicles)
  assert.deepEqual(readVehicles('[{"id":"missing-fields"}]'), initialVehicles)
  assert.deepEqual(
    readVehicles(JSON.stringify([initialVehicles[0], initialVehicles[0]])),
    initialVehicles,
  )
  assert.deepEqual(
    readVehicles(JSON.stringify(initialVehicles)),
    initialVehicles,
  )
})
test("review cannot submit a removed vehicle or incomplete incident", () => {
  const draft = newDraft(initialVehicles, "Pickup street")
  assert.throws(() => makeBooking(draft, []), /vehicle/)
  assert.throws(() => makeBooking(draft, initialVehicles), /incident/)
  draft.incident = "Other"
  assert.throws(() => makeBooking(draft, initialVehicles), /Describe/)
})
test("tow validates distinct addresses; roadside service needs no destination", () => {
  const tow = {
    ...newDraft(initialVehicles, " Cubao street "),
    destination: "cubao street",
  }
  assert.match(validateStep(3, tow, initialVehicles)!, /different/)
  assert.equal(
    validateStep(
      3,
      { ...tow, service: "Jump Start", destination: "" },
      initialVehicles,
    ),
    undefined,
  )
  assert.match(
    validateStep(3, { ...tow, pickup: " " }, initialVehicles)!,
    /pickup/,
  )
})
test("booking snapshots selected vehicle, service, provider, route, notes and quote", () => {
  const vehicles = initialVehicles.map((vehicle) => ({ ...vehicle }))
  const draft = {
    ...newDraft(vehicles, "Test pickup, Cubao", "Jump Start", "motor-trust"),
    incident: "Battery problem",
    notes: " Parked by the gate ",
    destination: "",
  }
  const booking = makeBooking(draft, vehicles)
  assert.equal(booking.service, "Jump Start")
  assert.equal(booking.providerName, "Motor Trust Towing")
  assert.equal(booking.destination, "Assistance at pickup")
  assert.equal(booking.notes, "Parked by the gate")
  assert.equal(booking.quote.total, 845)
  assert.equal(booking.quote.travel, 0)
  vehicles[0].plate = "XYZ 9999"
  assert.equal(booking.vehicle.plate, "ABC 1234")
  assert.equal(quoteFor("Tow Truck", "viray").total, 1685)
})
test("unknown providers cannot pass final confirmation", () => {
  const draft = {
    ...newDraft(initialVehicles, "Test pickup street"),
    incident: "Engine failure",
    providerId: "missing",
  }
  assert.throws(() => makeBooking(draft, initialVehicles), /provider/)
})
test("search matches all words across provider name and location, ignoring case", () => {
  assert.equal(
    matchesQuery("  MOTOR  ortigas ", "Motor Trust Towing", "Ortigas Center"),
    true,
  )
  assert.equal(
    matchesQuery("battery", "Jump Start", "Restart a drained battery"),
    true,
  )
  assert.equal(
    matchesQuery("motor cubao", "Motor Trust Towing", "Ortigas Center"),
    false,
  )
})
test("navigation handles invalid hashes and bounds booking steps", () => {
  assert.deepEqual(parseRoute("#/unknown"), { screen: "home" })
  assert.deepEqual(parseRoute("#/booking/999"), { screen: "booking", step: 5 })
  assert.deepEqual(parseRoute("#/booking/invalid"), {
    screen: "booking",
    step: 1,
  })
  assert.deepEqual(parseRoute("#/vehicle/%broken"), { screen: "home" })
  assert.deepEqual(parseRoute("#/receipt/LT-123"), {
    screen: "receipt",
    id: "LT-123",
  })
})
