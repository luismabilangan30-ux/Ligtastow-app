import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"
import { Badge, Button, Icon, PhoneFrame } from "../components/ui"
import { hasMapbox, forwardGeocode, getRoute, reverseGeocode, getCurrentPosition, resetSearchSession, type GeoPosition, type GeocodingResult } from "../components/mapUtils"
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

  // Address autocomplete state
  const [pickupSuggestions, setPickupSuggestions] = useState<GeocodingResult[]>([])
  const [destSuggestions, setDestSuggestions] = useState<GeocodingResult[]>([])
  const [activeField, setActiveField] = useState<"pickup" | "destination">("pickup")
  const [locating, setLocating] = useState(false)
  const proximityRef = useRef<GeoPosition | undefined>(undefined)
  const pickupDebounce = useRef<ReturnType<typeof setTimeout>>(undefined)
  const destDebounce = useRef<ReturnType<typeof setTimeout>>(undefined)
  const blurTimeout = useRef<ReturnType<typeof setTimeout>>(undefined)
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
  // ── Address autocomplete ──────────────────────────────────
  // Grab user's GPS once on mount for proximity-biased suggestions
  useEffect(() => {
    if (hasMapbox() && !proximityRef.current) {
      void getCurrentPosition().then(pos => { proximityRef.current = pos }).catch(() => {})
    }
  }, [])

  const searchAddress = useCallback((query: string, field: "pickup" | "destination") => {
    const setSuggestions = field === "pickup" ? setPickupSuggestions : setDestSuggestions
    const debounceRef = field === "pickup" ? pickupDebounce : destDebounce
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!hasMapbox() || query.trim().length < 3) {
      setSuggestions([])
      return
    }
    debounceRef.current = setTimeout(() => {
      void forwardGeocode(query, proximityRef.current).then(setSuggestions)
    }, 350)
  }, [])

  const selectSuggestion = useCallback((result: GeocodingResult, field: "pickup" | "destination") => {
    const coords: [number, number] = result.center
    resetSearchSession()
    if (field === "pickup") {
      change({ pickup: result.address, pickupCoords: coords })
      setPickupSuggestions([])
    } else {
      change({ destination: result.address, destinationCoords: coords })
      setDestSuggestions([])
    }
  }, [change])

  // ── Use my location (GPS) ───────────────────────────────
  const useMyLocation = useCallback(async () => {
    setLocating(true)
    try {
      const pos = await getCurrentPosition()
      proximityRef.current = pos
      const address = await reverseGeocode(pos)
      change({
        pickup: address || `${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`,
        pickupCoords: [pos.lng, pos.lat],
      })
      setPickupSuggestions([])
    } catch {
      setError("Could not get your location. Please enable GPS and try again.")
    } finally {
      setLocating(false)
    }
  }, [change])

  // ── Tap map to pin location ─────────────────────────────
  const handleMapClick = useCallback(async (pos: GeoPosition) => {
    const coords: [number, number] = [pos.lng, pos.lat]
    const address = hasMapbox() ? await reverseGeocode(pos) : ""
    const label = address || `${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`
    if (activeField === "pickup") {
      change({ pickup: label, pickupCoords: coords })
      setPickupSuggestions([])
    } else {
      change({ destination: label, destinationCoords: coords })
      setDestSuggestions([])
    }
  }, [activeField, change])

  // Geocode addresses and compute route when leaving step 3
  const computeRoute = async () => {
    if (!hasMapbox()) return
    setRouteLoading(true)
    try {
      // Use existing coords if already set (from GPS, map pin, or autocomplete)
      // Only geocode the text address as a fallback
      let pickupCoords = draft.pickupCoords
      let destCoords = draft.destinationCoords

      if (!pickupCoords) {
        const results = await forwardGeocode(draft.pickup, proximityRef.current)
        pickupCoords = results[0]?.center as [number, number] | undefined
      }
      if (!destCoords && isTow(draft.service) && draft.destination) {
        const results = await forwardGeocode(draft.destination, proximityRef.current)
        destCoords = results[0]?.center as [number, number] | undefined
      }

      const updates: Partial<Draft> = {}
      if (pickupCoords && !draft.pickupCoords) updates.pickupCoords = pickupCoords
      if (destCoords && !draft.destinationCoords) updates.destinationCoords = destCoords

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
              <IllustrativeMap
                tracking
                showUserLocation
                pickup={draft.pickupCoords ?? null}
                destination={draft.destinationCoords ?? null}
                onMapClick={handleMapClick}
              />
              {hasMapbox() && (
                <p className="map-pin-hint">
                  <Icon name="pin" size={13} /> Tap the map to set your {activeField === "pickup" ? "pickup" : "destination"} pin
                </p>
              )}

              {/* Pickup address with autocomplete */}
              <div className="address-field">
                <label className="field">
                  <span>Pickup address</span>
                  <div className="address-input-row">
                    <input
                      value={draft.pickup}
                      maxLength={180}
                      onFocus={() => setActiveField("pickup")}
                      onChange={(event) => {
                        update({ pickup: event.target.value, pickupCoords: undefined })
                        searchAddress(event.target.value, "pickup")
                      }}
                      onBlur={() => { blurTimeout.current = setTimeout(() => setPickupSuggestions([]), 200) }}
                      placeholder="Search for a street, landmark, or city"
                      autoComplete="off"
                    />
                    {hasMapbox() && (
                      <button
                        type="button"
                        className="gps-btn"
                        onClick={useMyLocation}
                        disabled={locating}
                        aria-label="Use my current location"
                        title="Use my current location"
                      >
                        {locating ? <span className="gps-spinner" /> : <Icon name="pin" size={16} />}
                      </button>
                    )}
                  </div>
                </label>
                {pickupSuggestions.length > 0 && (
                  <ul className="address-suggestions" role="listbox">
                    {pickupSuggestions.map((result, i) => (
                      <li key={i} role="option">
                        <button
                          type="button"
                          className="address-suggestion"
                          onMouseDown={() => {
                            if (blurTimeout.current) clearTimeout(blurTimeout.current)
                          }}
                          onClick={() => selectSuggestion(result, "pickup")}
                        >
                          <Icon name="pin" size={14} />
                          <span>
                            <strong>{result.name}</strong>
                            <small>{result.address}</small>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Destination address with autocomplete (tow services only) */}
              {isTow(draft.service) ? (
                <div className="address-field">
                  <label className="field">
                    <span>Destination address</span>
                    <input
                      value={draft.destination}
                      maxLength={180}
                      onFocus={() => setActiveField("destination")}
                      onChange={(event) => {
                        update({ destination: event.target.value, destinationCoords: undefined })
                        searchAddress(event.target.value, "destination")
                      }}
                      onBlur={() => { blurTimeout.current = setTimeout(() => setDestSuggestions([]), 200) }}
                      placeholder="Search for service center, street, or city"
                      autoComplete="off"
                    />
                  </label>
                  {destSuggestions.length > 0 && (
                    <ul className="address-suggestions" role="listbox">
                      {destSuggestions.map((result, i) => (
                        <li key={i} role="option">
                          <button
                            type="button"
                            className="address-suggestion"
                            onMouseDown={() => {
                              if (blurTimeout.current) clearTimeout(blurTimeout.current)
                            }}
                            onClick={() => selectSuggestion(result, "destination")}
                          >
                            <Icon name="pin" size={14} />
                            <span>
                              <strong>{result.name}</strong>
                              <small>{result.address}</small>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <div className="info-note">
                  <Icon name="pin" />
                  <span>
                    {draft.service} is provided at the pickup address. No
                    destination is needed.
                  </span>
                </div>
              )}

              {draft.pickupCoords && (
                <p className="page-copy address-confirmed">
                  <Icon name="check" size={13} /> Pickup location pinned — tap the map to adjust
                </p>
              )}
              {!draft.pickupCoords && hasMapbox() && draft.pickup.trim().length >= 3 && (
                <p className="page-copy address-hint">
                  <Icon name="pin" size={13} /> Select a suggestion, use GPS, or tap the map to pin your exact location
                </p>
              )}
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
