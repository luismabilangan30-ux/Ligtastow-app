import { useRef, useState, type FormEvent } from "react"
import { Badge, Button, Icon, PhoneFrame } from "../components/ui"
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
  const errorRef = useRef<HTMLDivElement>(null)
  const vehicle = vehicles.find((item) => item.id === draft.vehicleId)
  const provider = providerOptions.find((item) => item.id === draft.providerId)
  const quote = quoteFor(draft.service, draft.providerId)
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
          <p className="demo-notice">
            {cloud ? "Development booking · Use test details. Requests are saved online and shared with the selected provider team. No real service or payment." : "Local demo · Use sample details. Submitted bookings are stored on this computer and shared with the demo workspaces."}
          </p>
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
                Addresses are saved as text for this demo. Distance, travel time
                and service coverage have not been calculated.
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
              <h2 className="subhead">Choose a sample provider</h2>
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
                      {money(quoteFor(draft.service, item.id).total)} sample
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
              <Fare quote={quote} />
              <p className="page-copy spaced">
                This is sample pricing. It is not based on the entered route,
                actual provider availability, tolls or fuel costs.
              </p>
            </>
          )}
        </main>
        <div className="sticky-action">
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Connecting…" : step === 5
              ? `Confirm demo booking · ${money(quote.total)}`
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
