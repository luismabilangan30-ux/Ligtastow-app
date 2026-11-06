import { useEffect, useState } from "react"
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
          <small>DEMO TOTAL</small>
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
  return (
    <Page
      title={searching ? "Finding your operator" : "Demo tracking"}
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
            Development dispatch · Updates come from the operator workspace. No real roadside service is dispatched.
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
                Your request is waiting with {booking.providerName}. Select an operator from that provider in the Workspace menu to accept it.
              </p>
            </>
          ) : (
            <>
              <IllustrativeMap tracking />
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
                      "Phone calls are unavailable in this demo. No call was placed.",
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
          </Button> : <p className="demo-notice">Service has started. Ask the company dispatcher to review cancellation.</p>}
          <p className="page-copy spaced">
            Location sharing is off. No real GPS updates are sent.
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
          <p>This ends your demo request. No cancellation fee is charged.</p>
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
        {cloud ? "Account booking history · Saved online for your signed-in account." : "Local booking history · Saved on this computer by the development API."}
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
              ? "View demo receipt"
              : booking.status === "cancelled"
                ? "View cancellation"
                : "Track active booking"}
          </Button>
        </article>
      ))}
      {!shown.length && (
        <EmptyState title="No bookings here yet">
          Your {filter === "All" ? "demo" : filter.toLowerCase()} requests will
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
          : "Demo receipt"
      }
      back={back}
    >
      {!booking ? (
        <EmptyState title="Booking unavailable">
          Check the local dispatch connection or open a record from History.
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
                No payment or cancellation fee was collected.
              </p>
            </>
          ) : (
            <>
              <Fare quote={booking.quote} />
              <p className="demo-notice">
                Demo record only. This is not proof of payment.
              </p>
              <h2>
                {booking.rating
                  ? "Your service rating"
                  : "Rate this demo service"}
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
