import { useCallback, useEffect, useRef, useState } from "react"
import { bookingStages, progressLabel, type DispatchBooking } from "../shared/dispatch"
import { Badge, BottomNav, Button, Icon } from "../components/ui"
import {
  ConfirmDialog,
  EmptyState,
  Fare,
  IllustrativeMap,
  Page,
  ProviderHeader,
} from "./components"
import { useOperatorTracking } from "../shared/useTracking"
import { hasMapbox, getRoute, watchPosition, type GeoPosition } from "../components/mapUtils"
import {
  isTow,
  money,
  vehicleName,
  type Booking,
  type Screen,
  type Service,
} from "./model"

type Navigate = (screen: Screen, options?: { id?: string }) => void
export function BookingDetails({ booking }: { booking: Booking }) {
  return (
    <div className="search-summary">
      <div>
        <Icon name="car" />
        <span>
          <small>VEHICLE</small>
          <strong>
            {vehicleName(booking.vehicle)} · {booking.vehicle.plate}
          </strong>
        </span>
      </div>
      <div>
        <Icon name="route" />
        <span>
          <small>{booking.service.toUpperCase()}</small>
          <strong>
            {booking.pickup} → {booking.destination}
          </strong>
        </span>
      </div>
      <div>
        <Icon name="wrench" />
        <span>
          <small>INCIDENT</small>
          <strong>{booking.incident}</strong>
          {booking.notes && (
            <small className="booking-notes">{booking.notes}</small>
          )}
        </span>
      </div>
      <div>
        <Icon name="wallet" />
        <span>
          <small>ESTIMATED TOTAL</small>
          <strong>{money(booking.quote.total)}</strong>
        </span>
      </div>
    </div>
  )
}
export function ActiveBooking({
  booking,
  back,
  cancel,
  pending,
  error: apiError,
  navigate,
  notify,
}: {
  booking: DispatchBooking | undefined
  back: () => void
  cancel: (reason: string) => Promise<boolean>
  pending: boolean
  error: string
  navigate: Navigate
  notify: (message: string) => void
}) {
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState("No longer need assistance")
  const [otherReason, setOtherReason] = useState("")
  const [error, setError] = useState("")
  const searching = booking?.status === "searching"
  const statuses = bookingStages(booking?.service ?? "Tow Truck")

  // Live operator tracking
  const activeBookingId = booking?.status === "assigned" ? booking.id : undefined
  const { operatorPosition, eta } = useOperatorTracking(activeBookingId)

  // Track motorist's own GPS for map pin + route line
  const [motoristPosition, setMotoristPosition] = useState<[number, number] | null>(null)
  useEffect(() => {
    const stop = watchPosition(
      (pos) => setMotoristPosition([pos.lng, pos.lat]),
    )
    return stop
  }, [])

  // Compute route line from operator to motorist (throttled)
  const [routeLine, setRouteLine] = useState<{ type: "LineString"; coordinates: [number, number][] } | null>(null)
  const routeThrottle = useRef<ReturnType<typeof setTimeout>>(undefined)
  const lastRouteKey = useRef("")

  useEffect(() => {
    if (!operatorPosition || !motoristPosition || !hasMapbox()) {
      setRouteLine(null)
      return
    }
    // Throttle: recompute only if operator moved significantly or every 20s
    const key = `${operatorPosition[0].toFixed(3)},${operatorPosition[1].toFixed(3)}`
    if (key === lastRouteKey.current) return
    if (routeThrottle.current) clearTimeout(routeThrottle.current)
    routeThrottle.current = setTimeout(() => {
      lastRouteKey.current = key
      void getRoute(
        { lng: operatorPosition[0], lat: operatorPosition[1] },
        { lng: motoristPosition[0], lat: motoristPosition[1] },
      ).then((result) => {
        if (result) setRouteLine(result.geometry as { type: "LineString"; coordinates: [number, number][] })
      })
    }, 2000) // 2s debounce after operator moves
    return () => { if (routeThrottle.current) clearTimeout(routeThrottle.current) }
  }, [operatorPosition, motoristPosition])
  return (
    <Page
      title={searching ? "Finding your operator" : "Live tracking"}
      back={back}
    >
      {!booking ? (
        <EmptyState title="No active booking">
          Start a request from Home.
          <Button onClick={() => navigate("home")}>Go home</Button>
        </EmptyState>
      ) : (
        <>
          <p className="demo-notice">
            Your request has been submitted. You'll receive updates as your operator responds.
          </p>
          {searching ? (
            <>
              <div className="radar">
                <i />
                <i />
                <i />
                <span>
                  <Icon name="truck" size={25} />
                </span>
              </div>
              <h1>Waiting for your operator</h1>
              <p className="page-copy">
                Your request is waiting with {booking.providerName}. An available operator will be assigned shortly.
              </p>
            </>
          ) : (
            <>
              <IllustrativeMap
                tracking
                operator={operatorPosition}
                pickup={motoristPosition}
                route={routeLine}
                showUserLocation
              />

              {/* Live tracking status card */}
              <div className="tracking-card">
                <div className="tracking-header">
                  <span className={`tracking-dot ${operatorPosition ? "live" : ""}`} />
                  <strong>{operatorPosition ? "Live tracking" : "Waiting for operator GPS"}</strong>
                </div>
                {eta !== null && (
                  <div className="tracking-eta">
                    <Icon name="clock" size={18} />
                    <span>
                      <strong>~{eta} min</strong>
                      <small>estimated arrival</small>
                    </span>
                  </div>
                )}
                {operatorPosition && (
                  <p className="tracking-detail">
                    <Icon name="truck" size={14} /> {booking.operatorName} is on the way
                  </p>
                )}
              </div>

              <h1>{progressLabel(booking)}</h1>
              <p className="page-copy">
                {booking.operatorName} · {booking.providerName}
              </p>
              <div className="row-actions">
                <Button
                  variant="secondary"
                  icon="phone"
                  onClick={() =>
                    notify(
                      "Phone calls are not available yet. Use the operator's listed number directly.",
                    )
                  }
                >
                  Call
                </Button>
                <Button
                  variant="secondary"
                  icon="chat"
                  onClick={() =>
                    notify("Chat is unavailable until messaging is connected.")
                  }
                >
                  Message
                </Button>
              </div>
            </>
          )}
          <BookingDetails booking={booking} />
          {!searching && (
            <>
              <section className="timeline-card">
                <h2>Booking progress</h2>
                {statuses.map((status, index) => (
                  <div
                    className={`timeline-row ${
                      index < booking.stage
                        ? "complete"
                        : index === booking.stage
                          ? "active"
                          : ""
                    }`}
                    key={status}
                  >
                    <span>
                      {index < booking.stage ? (
                        <Icon name="check" size={13} />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <div>
                      <strong>{status}</strong>
                      <small>
                        {index < booking.stage
                          ? "Complete"
                          : index === booking.stage
                            ? "Current stage"
                            : "Upcoming"}
                      </small>
                    </div>
                  </div>
                ))}
              </section>
              <p className="page-copy">Progress updates automatically while this page is open. Only the assigned operator can advance the service.</p>
            </>
          )}
          {booking.stage < 4 ? <Button
            className="full-width"
            variant="ghost"
            onClick={() => setCancelling(true)}
          >
            Cancel request
          </Button> : <p className="demo-notice">Service has started. Contact the company dispatcher for cancellation.</p>}
          <p className="page-copy spaced">
            {operatorPosition
              ? "Your operator's location is being tracked in real time."
              : "Operator location will appear here once GPS is available."}
          </p>
        </>
      )}
      {cancelling && (
        <ConfirmDialog
          title="Cancel this request?"
          confirmLabel={pending ? "Saving…" : "Confirm cancellation"}
          onCancel={() => setCancelling(false)}
          onConfirm={() => {
            if (reason === "Other" && !otherReason.trim()) {
              setError("Please enter a cancellation reason.")
              return
            }
            if (!pending) void cancel(reason === "Other" ? otherReason.trim() : reason).then((saved) => { if (saved) setCancelling(false) })
          }}
        >
          <p>Are you sure you want to cancel this request? A cancellation reason is required.</p>
          <label className="field">
            <span>Cancellation reason</span>
            <select
              value={reason}
              onChange={(event) => {
                setReason(event.target.value)
                setError("")
              }}
            >
              {[
                "No longer need assistance",
                "Booked another provider",
                "Incorrect request details",
                "Other",
              ].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          {reason === "Other" && (
            <label className="field">
              <span>Tell us why</span>
              <textarea
                value={otherReason}
                maxLength={300}
                onChange={(event) => {
                  setOtherReason(event.target.value)
                  setError("")
                }}
              />
            </label>
          )}
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          {apiError && <p className="field-error" role="alert">{apiError}</p>}
        </ConfirmDialog>
      )}
    </Page>
  )
}
export function History({
  bookings,
  navigate,
  back,
  startBooking,
  cloud = false,
}: {
  bookings: Booking[]
  navigate: Navigate
  back: () => void
  startBooking: (service?: Service) => void
  cloud?: boolean
}) {
  const [filter, setFilter] = useState("All")
  const shown = bookings.filter(
    (booking) =>
      filter === "All" ||
      (filter === "Ongoing"
        ? ["searching", "assigned"].includes(booking.status)
        : booking.status === filter.toLowerCase()),
  )
  return (
    <Page
      title="My bookings"
      back={back}
      footer={
        <BottomNav
          active="history"
          onNavigate={navigate}
          onSos={() => startBooking("Emergency Tow")}
        />
      }
    >
      <p className="demo-notice">
        {cloud ? "Booking history" : "Local booking history · Saved on this device."}
      </p>
      <div className="segmented">
        {["All", "Ongoing", "Completed", "Cancelled"].map((value) => (
          <button
            className={filter === value ? "active" : ""}
            key={value}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {value}
          </button>
        ))}
      </div>
      {shown.map((booking) => (
        <article className="booking-record" key={booking.id}>
          <div>
            <Badge tone={booking.status === "completed" ? "success" : "brand"}>
              {booking.status.toUpperCase()}
            </Badge>
            <small>{booking.id}</small>
          </div>
          <h3>
            {booking.providerName} · {booking.service}
          </h3>
          <p>
            {booking.pickup} → {booking.destination}
          </p>
          <div>
            <strong>
              {new Date(booking.createdAt).toLocaleDateString("en-PH")}
            </strong>
            <b>{money(booking.quote.total)}</b>
          </div>
          <Button
            variant="secondary"
            onClick={() =>
              navigate(
                booking.status === "searching"
                  ? "searching"
                  : booking.status === "assigned"
                    ? "tracking"
                    : "receipt",
                { id: booking.id },
              )
            }
          >
            {booking.status === "completed"
              ? "View receipt"
              : booking.status === "cancelled"
                ? "View cancellation"
                : "Track active booking"}
          </Button>
        </article>
      ))}
      {!shown.length && (
        <EmptyState title="No bookings here yet">
          Your {filter === "All" ? "" : filter.toLowerCase() + " "}requests will
          appear here.
          <Button onClick={() => startBooking()}>Request assistance</Button>
        </EmptyState>
      )}
    </Page>
  )
}
export function Receipt({
  booking,
  back,
  rate,
}: {
  booking?: Booking
  back: () => void
  rate: (stars: number) => void
}) {
  const [stars, setStars] = useState(booking?.rating ?? 0)
  useEffect(() => setStars(booking?.rating ?? 0), [booking?.id, booking?.rating])
  return (
    <Page
      title={
        booking?.status === "cancelled"
          ? "Cancellation details"
          : "Receipt"
      }
      back={back}
    >
      {!booking ? (
        <EmptyState title="Booking unavailable">
          This booking is no longer available. Open a record from History instead.
        </EmptyState>
      ) : (
        <>
          <Badge tone={booking.status === "completed" ? "success" : "neutral"}>
            {booking.status}
          </Badge>
          <h1>{booking.id}</h1>
          <ProviderHeader name={booking.providerName} />
          <BookingDetails booking={booking} />
          {booking.status === "cancelled" ? (
            <>
              <h2>Reason for cancellation</h2>
              <p className="page-copy">{booking.cancellationReason}</p>
              <p className="demo-notice">
                No charges were applied for this cancelled request.
              </p>
            </>
          ) : (
            <>
              <Fare quote={booking.quote} distanceKm={booking.quote.distanceKm} durationMin={booking.quote.durationMin} />
              <p className="demo-notice">
                Digital receipt. Payment integration coming soon.
              </p>
              <h2>
                {booking.rating
                  ? "Your service rating"
                  : "Rate this service"}
              </h2>
              <div
                className="rating-options"
                role="group"
                aria-label="Service rating"
              >
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    aria-label={`${value} ${value === 1 ? "star" : "stars"}`}
                    aria-pressed={stars === value}
                    onClick={() => setStars(value)}
                  >
                    <Icon name="star" size={27} filled={value <= stars} />
                  </button>
                ))}
              </div>
              <button
                className="btn btn-primary full-width"
                disabled={!stars}
                onClick={() => rate(stars)}
              >
                {booking.rating ? "Update rating" : "Save rating"}
              </button>
            </>
          )}
        </>
      )}
    </Page>
  )
}
