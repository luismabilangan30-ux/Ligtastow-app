import { useEffect, useRef, useState, type FormEvent } from "react"
import { Badge, Button, Icon, PhoneFrame } from "../components/ui"
import { hasMapbox, forwardGeocode, getRoute } from "../components/mapUtils"
import {
  ConfirmDialog,
  EmptyState,
  Fare,
  IllustrativeMap,
  ProviderHeader,
  VehicleSummary,
} from "./components"
import {
  incidents,
  isTow,
  money,
  providers,
  quoteFor,
  validateStep,
  vehicleName,
  type Draft,
  type Vehicle,
} from "./model"

export default function BookingFlow({
  step,
  draft,
  vehicles,
  change,
  goStep,
  addVehicle,
  confirm,
  close,
  pending,
  cloud = false,
  providerOptions = providers,
}: {
  step: number
  draft: Draft
  vehicles: Vehicle[]
  change: (changes: Partial<Draft>) => void
  goStep: (step: number) => void
  addVehicle: () => void
  confirm: () => void
  close: () => void
  pending: boolean
  cloud?: boolean
  providerOptions?: typeof providers
}) {
  const [error, setError] = useState("")
  const [discard, setDiscard] = useState(false)
  const [routeLoading, setRouteLoading] = useState(false)
  const errorRef = useRef<HTMLDivElement>(null)
  const vehicle = vehicles.find((item) => item.id === draft.vehicleId)
  const provider = providerOptions.find((item) => item.id === draft.providerId)
  const quote = quoteFor(draft.service, draft.providerId, draft.routeDistance, draft.routeDuration)
  const titles = [
    "Choose your vehicle",
    "What happened?",
    "Confirm your route",
    "Service & provider",
    "Review your request",
  ]
  const update = (changes: Partial<Draft>) => {
    setError("")
    change(changes)
  }
  // Geocode addresses and compute route when leaving step 3
  const computeRoute = async () => {
    if (!hasMapbox()) return
    setRouteLoading(true)
    try {
      const [pickupResults, destResults] = await Promise.all([
        forwardGeocode(draft.pickup),
        isTow(draft.service) && draft.destination
          ? forwardGeocode(draft.destination)
          : Promise.resolve([]),
      ])
      const pickupCoords = pickupResults[0]?.center as [number, number] | undefined
      const destCoords = destResults[0]?.center as [number, number] | undefined
      const updates: Partial<Draft> = {}
      if (pickupCoords) updates.pickupCoords = pickupCoords
      if (destCoords) updates.destinationCoords = destCoords

      if (pickupCoords && destCoords) {
        const route = await getRoute(
          { lng: pickupCoords[0], lat: pickupCoords[1] },
          { lng: destCoords[0], lat: destCoords[1] },
        )
        if (route) {
          updates.routeDistance = route.distance
          updates.routeDuration = route.duration
        }
      } else if (pickupCoords && !isTow(draft.service)) {
        // Non-tow services: use a nominal 5 km operator travel distance
        updates.routeDistance = 5000
        updates.routeDuration = 600
      }
      if (Object.keys(updates).length) change(updates)
    } catch {
      // Geocoding failed silently — fall back to flat-rate pricing
    } finally {
      setRouteLoading(false)
    }
  }

  // Trigger route computation when step changes to 4
  const prevStepRef = useRef(step)
  useEffect(() => {
    if (step === 4 && prevStepRef.current === 3) {
      void computeRoute()
    }
    prevStepRef.current = step
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  const next = (event: FormEvent) => {
    event.preventDefault()
    if (pending) return
    for (let current = 1; current <= step; current++) {
      const problem = validateStep(current, draft, vehicles)
      if (problem) {
        if (current !== step) goStep(current)
        setError(problem)
        requestAnimationFrame(() => errorRef.current?.focus())
        return
      }
    }
    if (step >= 4 && !provider) { setError("Choose an available provider before continuing."); return }
    if (step === 5) confirm()
    else goStep(step + 1)
  }
  return (
    <PhoneFrame
      title={draft.service}
      right={null}
      left={
        <button
          className="icon-btn"
          aria-label="Close booking"
          onClick={() => setDiscard(true)}
        >
          <Icon name="close" />
        </button>
      }
    >
      <form onSubmit={next} noValidate>
        <main className="booking-page" tabIndex={-1}>
          <div className="stepper" aria-label={`Step ${step} of 5`}>
            {[1, 2, 3, 4, 5].map((number) => (
              <span
                key={number}
                className={number <= step ? "done" : ""}
                aria-current={step === number ? "step" : undefined}
              >
                {number < step ? <Icon name="check" size={13} /> : number}
              </span>
            ))}
          </div>
          <div className="eyebrow">STEP {step} OF 5</div>
          <h1>{titles[step - 1]}</h1>
          {!cloud ? <p className="demo-notice">Local mode · Bookings are stored on this device and shared with the dispatch workspace.</p> : null}
          {error && (
            <div
              className="form-error"
              role="alert"
              tabIndex={-1}
              ref={errorRef}
            >
              {error}
            </div>
          )}
          {step === 1 && (
            <div className="choice-list">
              {vehicles.map((item) => (
                <button
                  type="button"
                  aria-pressed={item.id === draft.vehicleId}
                  className={`vehicle-choice ${
                    item.id === draft.vehicleId ? "selected" : ""
                  }`}
                  key={item.id}
                  onClick={() => update({ vehicleId: item.id })}
                >
                  <VehicleSummary vehicle={item} />
                  <span
                    className={`radio ${
                      item.id === draft.vehicleId ? "checked" : ""
                    }`}
                  >
                    <i />
                  </span>
                </button>
              ))}
              {!vehicles.length && (
                <EmptyState title="Add your first vehicle">
                  We need its details to prepare your request.
                </EmptyState>
              )}
              <button
                type="button"
                className="vehicle-choice"
                onClick={addVehicle}
              >
                <span className="choice-icon">
                  <Icon name="plus" />
                </span>
                <span>
                  <strong>Add another vehicle</strong>
                  <small>Your booking progress will be kept.</small>
                </span>
              </button>
            </div>
          )}
          {step === 2 && (
            <>
              <div className="incident-grid">
                {incidents.map((incident) => (
                  <button
                    type="button"
                    className={`incident-card ${
                      draft.incident === incident ? "selected" : ""
                    }`}
                    key={incident}
                    aria-pressed={draft.incident === incident}
                    onClick={() => update({ incident })}
                  >
                    <Icon name={incident === "Accident" ? "alert" : "wrench"} />
                    <strong>{incident}</strong>
                  </button>
                ))}
              </div>
              <label className="field">
                <span>
                  Tell us more{" "}
                  <small>
                    {draft.incident === "Other"
                      ? "Required for Other"
                      : "Optional"}
                  </small>
                </span>
                <textarea
                  value={draft.notes}
                  maxLength={500}
                  onChange={(event) => update({ notes: event.target.value })}
                  placeholder="Describe the problem and where your vehicle is parked."
                />
                <small>{draft.notes.length}/500 characters</small>
              </label>
              <div className="safety-note">
                <Icon name="shield" />
                <span>
                  <strong>Is anyone injured or in immediate danger?</strong>
                  <small>
                    Contact local emergency services directly. A towing request
                    does not alert emergency responders.
                  </small>
                </span>
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <IllustrativeMap tracking />
              <label className="field">
                <span>Pickup address</span>
                <input
                  value={draft.pickup}
                  maxLength={180}
                  onChange={(event) => update({ pickup: event.target.value })}
                  placeholder="Street, landmark and city"
                />
              </label>
              {isTow(draft.service) ? (
                <label className="field">
                  <span>Destination address</span>
                  <input
                    value={draft.destination}
                    maxLength={180}
                    onChange={(event) =>
                      update({ destination: event.target.value })
                    }
                    placeholder="Service center, street and city"
                  />
                </label>
              ) : (
                <div className="info-note">
                  <Icon name="pin" />
                  <span>
                    {draft.service} is provided at the pickup address. No
                    destination is needed.
                  </span>
                </div>
              )}
              <p className="page-copy spaced">
                Addresses are saved as text. Distance and travel time
                will be calculated once GPS is enabled.
              </p>
            </>
          )}
          {step === 4 && (
            <>
              <div className="recommend-card">
                <Badge tone="brand">{draft.service}</Badge>
                <h2>
                  {isTow(draft.service)
                    ? "Flatbed transport"
                    : "Roadside assistance"}
                </h2>
                <p>
                  Request for {vehicle ? vehicleName(vehicle) : "your vehicle"}.
                  Equipment and vehicle compatibility must be confirmed by a
                  real provider.
                </p>
              </div>
              <h2 className="subhead">Choose a provider</h2>
              <div className="choice-list">
                {providerOptions.map((item) => (
                  <button
                    type="button"
                    className={`provider-choice ${
                      item.id === draft.providerId ? "selected" : ""
                    }`}
                    aria-pressed={item.id === draft.providerId}
                    key={item.id}
                    onClick={() => update({ providerId: item.id })}
                  >
                    <ProviderHeader name={item.name} />
                    <span className="provider-detail">
                      {item.area} ·{" "}
                      {money(quoteFor(draft.service, item.id, draft.routeDistance, draft.routeDuration).total)} est.
                      total
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
          {step === 5 && (
            <>
              <div className="review-card">
                <div className="review-provider">
                  <ProviderHeader
                    name={provider?.name ?? "Select a provider"}
                  />
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() => goStep(4)}
                  >
                    Change
                  </button>
                </div>
                <div className="review-route">
                  <Icon name="route" />
                  <span>
                    <small>PICKUP</small>
                    <strong>{draft.pickup}</strong>
                    <small>
                      {isTow(draft.service)
                        ? "DESTINATION"
                        : "SERVICE LOCATION"}
                    </small>
                    <strong>
                      {isTow(draft.service)
                        ? draft.destination
                        : "Assistance at pickup"}
                    </strong>
                  </span>
                </div>
                <div className="review-facts">
                  <span>
                    <small>VEHICLE</small>
                    <strong>
                      {vehicle ? vehicleName(vehicle) : "No vehicle"}
                    </strong>
                    <strong>{vehicle?.plate}</strong>
                  </span>
                  <span>
                    <small>SERVICE</small>
                    <strong>{draft.service}</strong>
                  </span>
                  <span>
                    <small>INCIDENT</small>
                    <strong>{draft.incident}</strong>
                  </span>
                </div>
                {draft.notes && (
                  <p className="review-notes">
                    <strong>Notes:</strong> {draft.notes}
                  </p>
                )}
              </div>
              <Fare quote={quote} distanceKm={quote.distanceKm} durationMin={quote.durationMin} />
              {routeLoading && <p className="page-copy">Calculating route-based fare…</p>}
              <p className="page-copy spaced">
                Estimated fare based on service type and distance. Final amount may vary depending on actual route conditions.
              </p>
            </>
          )}
        </main>
        <div className="sticky-action">
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Connecting…" : step === 5
              ? `Confirm booking · ${money(quote.total)}`
              : "Continue"}
          </button>
          {step > 1 && (
            <Button
              variant="ghost"
              onClick={() => {
                setError("")
                goStep(step - 1)
              }}
            >
              Back
            </Button>
          )}
        </div>
      </form>
      {discard && (
        <ConfirmDialog
          title="Leave this request?"
          confirmLabel="Discard request"
          onCancel={() => setDiscard(false)}
          onConfirm={close}
        >
          <p>
            Your unfinished request will be discarded. Saved vehicles will
            remain available.
          </p>
        </ConfirmDialog>
      )}
    </PhoneFrame>
  )
}
