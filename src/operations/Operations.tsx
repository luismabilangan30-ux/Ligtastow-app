import { useState } from "react"
import { Icon } from "../components/ui"
import { money, providers, vehicleName } from "../motorist/model"
import { ConfirmDialog } from "../motorist/components"
import {
  bookingStages,
  isActive,
  progressLabel,
  type Actor,
  type BookingCommand,
  type DispatchBooking,
} from "../shared/dispatch"
import type { DispatchClient } from "../shared/useDispatch"

export default function Operations({
  actor,
  api,
}: {
  actor: Actor
  api: DispatchClient
}) {
  const [filter, setFilter] = useState("Active")
  const [query, setQuery] = useState("")
  const [cancel, setCancel] = useState<DispatchBooking>()
  const [reason, setReason] = useState("")
  const [reasonError, setReasonError] = useState("")
  const [notice, setNotice] = useState("")
  const operator = actor.role === "operator"
  const provider = providers.find((p) => p.id === actor.providerId)
  const title = operator
    ? "Your dispatch board"
    : actor.role === "company"
      ? "Company dispatch"
      : "Operations overview"
  const shown = api.bookings.filter(
    (b) =>
      (filter === "All" ||
        (filter === "Active"
          ? isActive(b)
          : b.status === filter.toLowerCase())) &&
      `${b.id} ${b.service} ${b.pickup} ${b.providerName} ${b.operatorName ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase().trim()),
  )
  const act = async (
    booking: DispatchBooking,
    command: Omit<BookingCommand, "expectedVersion">,
  ) => {
    const saved = await api.command(booking, command)
    if (saved)
      setNotice(
        command.action === "decline"
          ? "Offer declined. Your dispatcher can see the update."
          : `Saved: ${progressLabel(saved)}.`,
      )
    return saved
  }
  return (
    <main className="operations-page">
      <header className="operations-heading">
        <div>
          <p className="ops-eyebrow">
            {provider?.name ?? "LIGTASTOW · ALL PROVIDERS"}
          </p>
          <h1>{title}</h1>
          <p>
            {actor.name}
            {actor.truck
              ? ` · ${actor.truck}`
              : " · Dispatch and booking oversight"}
          </p>
        </div>
        <span className="ops-live">
          <span /> Updates every 3 seconds
        </span>
      </header>
      <p className="ops-demo">
        {actor.userId ? "Signed-in development workspace · Changes are saved online. Use test data. GPS, payments and real roadside service are not connected." : "Local development workspace · Use sample data. No real operators, GPS or payments are connected."}
      </p>
      <div className="ops-metrics">
        {[
          [
            "Awaiting operator",
            api.bookings.filter((b) => b.status === "searching").length,
            "clock",
          ],
          [
            "In progress",
            api.bookings.filter((b) => b.status === "assigned").length,
            "truck",
          ],
          [
            "Completed",
            api.bookings.filter((b) => b.status === "completed").length,
            "check",
          ],
        ].map(([label, count, icon]) => (
          <div key={label}>
            <Icon name={icon as "clock" | "truck" | "check"} />
            <strong>{count}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      {notice && (
        <p className="ops-notice" role="status">
          {notice}
        </p>
      )}
      {!operator && (
        <section className="ops-fleet">
          <h2>Operator availability</h2>
          <div>
            {api.operators.map((person) => {
              const current = api.bookings.find(
                (b) => b.operatorId === person.id && isActive(b),
              )
              return (
                <article key={person.id}>
                  <span className="ops-avatar">
                    {person.name
                      .split(" ")
                      .map((word) => word[0])
                      .join("")}
                  </span>
                  <div>
                    <strong>{person.name}</strong>
                    <small>{person.truck}</small>
                  </div>
                  <span className={current ? "ops-busy" : "ops-available"}>
                    {current ? "On a job" : "Available"}
                  </span>
                </article>
              )
            })}
          </div>
          <p>
            Demo roster. Availability reflects active assignments; online
            presence and fleet editing are pending.
          </p>
        </section>
      )}
      <section className="ops-bookings">
        <div className="ops-list-heading">
          <h2>{operator ? "Offers & jobs" : "Bookings"}</h2>
          <label>
            Search bookings
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ID, pickup, provider or operator"
            />
          </label>
        </div>
        <div className="ops-filters" aria-label="Booking filter">
          {[
            "Active",
            "Searching",
            "Assigned",
            "Completed",
            "Cancelled",
            "All",
          ].map((value) => (
            <button
              key={value}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {value === "Searching" ? "Waiting" : value}
            </button>
          ))}
        </div>
        {!shown.length && (
          <div className="ops-empty">
            <Icon name="truck" size={32} />
            <h3>
              {api.loading ? "Loading bookings…" : "No matching bookings"}
            </h3>
            <p>
              {operator
                ? "New requests for your provider appear here. Create a sample request in the Motorist workspace to try the flow."
                : "Bookings appear here when a motorist submits a request."}
            </p>
          </div>
        )}
        <div className="ops-card-grid">
          {shown.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              actor={actor}
              operators={api.operators}
              allBookings={api.bookings}
              disabled={api.pending || api.loading}
              act={act}
              cancel={() => {
                setCancel(booking)
                setReason("")
                setReasonError("")
              }}
            />
          ))}
        </div>
      </section>
      {cancel && (
        <ConfirmDialog
          title="Cancel this booking?"
          confirmLabel={api.pending ? "Saving…" : "Cancel booking"}
          onCancel={() => setCancel(undefined)}
          onConfirm={() => {
            if (!reason.trim()) {
              setReasonError("Enter a reason for the booking record.")
              return
            }
            const latest =
              api.bookings.find((b) => b.id === cancel.id) ?? cancel
            void act(latest, { action: "cancel", reason }).then((saved) => {
              if (saved) setCancel(undefined)
            })
          }}
        >
          <p>
            This ends the development booking. No fee or refund is processed.
          </p>
          <label className="field">
            Reason
            <textarea
              value={reason}
              maxLength={300}
              onChange={(e) => {
                setReason(e.target.value)
                setReasonError("")
              }}
            />
          </label>
          {reasonError && <p role="alert">{reasonError}</p>}
          {api.error && <p role="alert">{api.error}</p>}
        </ConfirmDialog>
      )}
    </main>
  )
}

function BookingCard({
  booking,
  actor,
  operators,
  allBookings,
  disabled,
  act,
  cancel,
}: {
  booking: DispatchBooking
  actor: Actor
  operators: Actor[]
  allBookings: DispatchBooking[]
  disabled: boolean
  act: (
    booking: DispatchBooking,
    command: Omit<BookingCommand, "expectedVersion">,
  ) => Promise<DispatchBooking | undefined>
  cancel: () => void
}) {
  const [operatorId, setOperatorId] = useState("")
  const manager = actor.role !== "operator"
  const eligible = operators.filter(
    (a) =>
      a.providerId === booking.providerId &&
      !booking.declinedOperatorIds.includes(a.id) &&
      !allBookings.some((b) => b.operatorId === a.id && isActive(b)),
  )
  const busy = allBookings.some((b) => b.operatorId === actor.id && isActive(b))
  const next = bookingStages(booking.service)[booking.stage + 1]
  return (
    <article className="ops-booking">
      <div className="ops-card-top">
        <span className={`ops-status status-${booking.status}`}>
          {progressLabel(booking)}
        </span>
        <small>
          {new Date(booking.createdAt).toLocaleString("en-PH", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </small>
      </div>
      <h3>{booking.service}</h3>
      <p className="ops-id">{booking.id}</p>
      <dl>
        <div>
          <dt>Pickup</dt>
          <dd>{booking.pickup}</dd>
        </div>
        <div>
          <dt>Destination</dt>
          <dd>{booking.destination}</dd>
        </div>
        <div>
          <dt>Vehicle</dt>
          <dd>
            {vehicleName(booking.vehicle)} · {booking.vehicle.plate}
          </dd>
        </div>
        <div>
          <dt>Incident</dt>
          <dd>{booking.incident}</dd>
        </div>
        <div>
          <dt>Provider</dt>
          <dd>{booking.providerName}</dd>
        </div>
        <div>
          <dt>Operator</dt>
          <dd>{booking.operatorName ?? "Awaiting assignment"}</dd>
        </div>
      </dl>
      {booking.notes && <p className="ops-notes">{booking.notes}</p>}
      <div className="ops-fare">
        <span>Sample fare · No payment collected</span>
        <strong>{money(booking.quote.total)}</strong>
      </div>
      {booking.cancellationReason && (
        <p className="ops-notes">Cancellation: {booking.cancellationReason}</p>
      )}
      {booking.rating && <p>Motorist rating: {booking.rating}/5</p>}
      <div className="ops-actions">
        {!manager && booking.status === "searching" && (
          <>
            <button
              className="btn btn-primary"
              disabled={disabled || busy}
              onClick={() => void act(booking, { action: "accept" })}
            >
              {busy ? "Finish your current job first" : "Accept request"}
            </button>
            <button
              className="btn btn-secondary"
              disabled={disabled}
              onClick={() => void act(booking, { action: "decline" })}
            >
              Decline offer
            </button>
          </>
        )}
        {!manager &&
          booking.status === "assigned" &&
          booking.operatorId === actor.id && (
            <button
              className="btn btn-primary"
              disabled={disabled}
              onClick={() => void act(booking, { action: "advance" })}
            >
              {next ? `Mark: ${next}` : "Complete service"}
            </button>
          )}
        {manager && booking.status === "searching" && (
          <>
            <label>
              Assign operator
              <select
                value={operatorId}
                onChange={(e) => setOperatorId(e.target.value)}
              >
                <option value="">Choose an available operator</option>
                {eligible.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {a.truck}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="btn btn-primary"
              disabled={disabled || !eligible.some((a) => a.id === operatorId)}
              onClick={() =>
                void act(booking, { action: "assign", operatorId })
              }
            >
              Assign job
            </button>
            {!eligible.length && (
              <p>
                No eligible operators remain. Review the request or cancel it
                with a reason.
              </p>
            )}
          </>
        )}
        {manager && isActive(booking) && (
          <button
            className="btn btn-ghost"
            disabled={disabled}
            onClick={cancel}
          >
            Cancel with reason
          </button>
        )}
      </div>
      <details className="ops-audit">
        <summary>Activity log · {booking.events.length} events</summary>
        <ol>
          {booking.events.map((event) => (
            <li key={event.id}>
              <strong>{event.detail}</strong>
              <small>
                {event.actorName} · {new Date(event.at).toLocaleString("en-PH")}
              </small>
            </li>
          ))}
        </ol>
      </details>
    </article>
  )
}
