import { useState, useEffect, useRef } from "react"
import { Avatar, Badge, BottomNav, Icon, MapCanvas, PhoneFrame } from "../components/ui"
import { bookingStages, isActive, progressLabel, type Actor, type DispatchBooking, type WorkspaceControls } from "../shared/dispatch"
import { money, vehicleName } from "../motorist/model"
import { ConfirmDialog, IllustrativeMap } from "../motorist/components"
import { forwardGeocode, getRoute, hasMapbox, type RouteStep } from "../components/mapUtils"
import type { DispatchClient } from "../shared/useDispatch"
import { useOperatorBroadcast } from "../shared/useTracking"
import "./operator.css"

type OperatorScreen = "home" | "requests" | "job" | "history" | "profile"

export default function OperatorApp({ actor, api, workspaceControls }: { actor: Actor; api: DispatchClient; workspaceControls?: WorkspaceControls }) {
  const [screen, setScreen] = useState<OperatorScreen>("home")
  const [notice, setNotice] = useState("")

  const myJob = api.bookings.find(b => b.status === "assigned" && b.operatorId === actor.id)
  const requests = api.bookings.filter(b => b.status === "searching" && !b.declinedOperatorIds.includes(actor.id))
  const completed = api.bookings.filter(b => b.status === "completed" || b.status === "cancelled")

  // Broadcast GPS location while working on an active job
  useOperatorBroadcast(myJob?.id)

  const act = async (booking: DispatchBooking, action: string, extra?: Record<string, unknown>) => {
    const saved = await api.command(booking, { action: action as "accept", ...extra })
    if (saved) {
      if (action === "accept") { setScreen("job"); setNotice("Job accepted! Navigate to pickup.") }
      else if (action === "decline") setNotice("Offer declined.")
      else if (action === "advance") setNotice(`Updated: ${progressLabel(saved)}.`)
      else setNotice("Saved.")
    }
    return saved
  }

  const navigate = (s: OperatorScreen) => { setScreen(s); setNotice("") }

  return (
    <div className="showcase-bg motorist-shell">
      {screen === "home" && <OperatorHome actor={actor} api={api} myJob={myJob} requests={requests} completed={completed} notice={notice} navigate={navigate} />}
      {screen === "requests" && <OperatorRequests actor={actor} requests={requests} act={act} pending={api.pending} notice={notice} navigate={navigate} />}
      {screen === "job" && <OperatorJob actor={actor} job={myJob} act={act} pending={api.pending} notice={notice} navigate={navigate} />}
      {screen === "history" && <OperatorHistory actor={actor} bookings={completed} navigate={navigate} />}
      {screen === "profile" && <OperatorProfile actor={actor} api={api} navigate={navigate} workspaceControls={workspaceControls} />}
    </div>
  )
}

/* ── Home / Dashboard ──────────────────────────────────────────────── */

function OperatorHome({ actor, api, myJob, requests, completed, notice, navigate }: {
  actor: Actor; api: DispatchClient; myJob?: DispatchBooking; requests: DispatchBooking[]
  completed: DispatchBooking[]; notice: string; navigate: (s: OperatorScreen) => void
}) {
  const completedToday = completed.filter(b => b.status === "completed" && new Date(b.updatedAt).toDateString() === new Date().toDateString()).length
  return (
    <PhoneFrame>
      <div className="home-map operator-home-map">
        <IllustrativeMap showUserLocation />
        <div className="mobile-top">
          <button className="profile-chip" onClick={() => navigate("profile")}>
            <Avatar initials={actor.name.split(/\s+/).map(w => w[0]).join("").slice(0, 2)} tone="dark" />
            <span>
              <small>On duty</small>
              <strong>{actor.name.split(/\s+/)[0]}</strong>
            </span>
          </button>
          {requests.length > 0 && (
            <button className="icon-btn elevated op-request-badge" onClick={() => navigate("requests")} aria-label={`${requests.length} incoming requests`}>
              <Icon name="bell" />
              <span className="badge-count">{requests.length}</span>
            </button>
          )}
        </div>
      </div>
      <div className="home-sheet">
        <div className="grabber" />
        {!actor.userId && <p className="demo-notice">Local mode · Dispatch connects to the motorist workspace.</p>}

        {/* Truck assignment card */}
        <div className="op-truck-card">
          <Icon name="truck" size={24} />
          <div>
            <strong>{actor.truck ?? "No truck assigned"}</strong>
            <small>{actor.name} · {myJob ? "On a job" : "Available"}</small>
          </div>
          <Badge tone={myJob ? "warning" : "success"}>{myJob ? "Busy" : "Free"}</Badge>
        </div>

        {/* Active job quick access */}
        {myJob && (
          <button className="op-active-job-link" onClick={() => navigate("job")}>
            <div>
              <small>ACTIVE JOB</small>
              <strong>{myJob.service} · {progressLabel(myJob)}</strong>
            </div>
            <Icon name="chevron" />
          </button>
        )}

        {/* Incoming requests */}
        {requests.length > 0 && (
          <>
            <div className="op-section-heading">
              <div><small>INCOMING</small><strong>New requests</strong></div>
              <Badge tone="brand">{requests.length}</Badge>
            </div>
            <button className="op-view-requests" onClick={() => navigate("requests")}>
              <Icon name="bell" />
              <span>View {requests.length} incoming request{requests.length > 1 ? "s" : ""}</span>
              <Icon name="chevron" />
            </button>
          </>
        )}

        {/* Quick stats */}
        <div className="op-section-heading" style={{ marginTop: 20 }}>
          <strong>Today's summary</strong>
        </div>
        <div className="op-stats">
          <div className="op-stat-card">
            <Icon name="check" size={18} />
            <strong>{completedToday}</strong>
            <small>Completed</small>
          </div>
          <div className="op-stat-card">
            <Icon name="clock" size={18} />
            <strong>{requests.length}</strong>
            <small>Pending</small>
          </div>
          <div className="op-stat-card">
            <Icon name="truck" size={18} />
            <strong>{myJob ? 1 : 0}</strong>
            <small>Active</small>
          </div>
        </div>

        {notice && <p className="op-notice" role="status">{notice}</p>}
      </div>
      <OperatorNav active="home" navigate={navigate} requests={requests.length} hasJob={!!myJob} />
    </PhoneFrame>
  )
}

/* ── Incoming Requests ─────────────────────────────────────────────── */

function OperatorRequests({ actor, requests, act, pending, notice, navigate }: {
  actor: Actor; requests: DispatchBooking[]; act: (b: DispatchBooking, action: string) => Promise<DispatchBooking | undefined>
  pending: boolean; notice: string; navigate: (s: OperatorScreen) => void
}) {
  return (
    <PhoneFrame title="Incoming requests" left={<button className="icon-btn" onClick={() => navigate("home")} aria-label="Back"><Icon name="chevron" /></button>} right={null}>
      <main className="operator-page">
        {notice && <p className="op-notice" role="status">{notice}</p>}
        {requests.length === 0 ? (
          <div className="op-empty">
            <Icon name="check" size={36} />
            <h2>No pending requests</h2>
            <p>New requests from motorists will appear here. Stay available!</p>
          </div>
        ) : (
          requests.map(booking => (
            <RequestCard key={booking.id} booking={booking} act={act} pending={pending} />
          ))
        )}
      </main>
      <OperatorNav active="requests" navigate={navigate} requests={requests.length} />
    </PhoneFrame>
  )
}

function RequestCard({ booking, act, pending }: {
  booking: DispatchBooking; act: (b: DispatchBooking, action: string) => Promise<DispatchBooking | undefined>; pending: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="op-request-card">
      <div className="op-request-header">
        <div className="op-request-service">
          <Icon name={booking.service === "Tow Truck" || booking.service === "Emergency Tow" ? "truck" : "wrench"} size={22} />
          <div>
            <strong>{booking.service}</strong>
            <small>{booking.providerName}</small>
          </div>
        </div>
        <Badge tone="brand">New</Badge>
      </div>
      <div className="op-request-route">
        <div><Icon name="pin" size={16} /><span><small>PICKUP</small><strong>{booking.pickup}</strong></span></div>
        {booking.destination && <div><Icon name="pin" size={16} /><span><small>DESTINATION</small><strong>{booking.destination}</strong></span></div>}
      </div>
      <div className="op-request-facts">
        <span><Icon name="car" size={14} /> {vehicleName(booking.vehicle)}</span>
        <span><Icon name="wrench" size={14} /> {booking.incident}</span>
        <span><Icon name="wallet" size={14} /> {money(booking.quote.total)}</span>
      </div>
      {booking.notes && <p className="op-request-notes">"{booking.notes}"</p>}
      {expanded && (
        <div className="op-request-detail">
          <div className="op-detail-row"><span>Vehicle</span><strong>{vehicleName(booking.vehicle)} · {booking.vehicle.plate}</strong></div>
          <div className="op-detail-row"><span>Color</span><strong>{booking.vehicle.color}</strong></div>
          <div className="op-detail-row"><span>Type</span><strong>{booking.vehicle.type}</strong></div>
          <div className="op-detail-row"><span>Fare</span><strong>{money(booking.quote.total)}</strong></div>
        </div>
      )}
      <button className="op-expand-btn" onClick={() => setExpanded(!expanded)}>
        {expanded ? "Show less" : "View details"} <Icon name="chevron" size={14} />
      </button>
      <div className="op-request-actions">
        <button className="btn btn-primary op-accept-btn" disabled={pending} onClick={() => void act(booking, "accept")}>
          <Icon name="check" size={18} /> Accept job
        </button>
        <button className="btn btn-secondary op-decline-btn" disabled={pending} onClick={() => void act(booking, "decline")}>
          Decline
        </button>
      </div>
    </div>
  )
}

/* ── Active Job ────────────────────────────────────────────────────── */

function OperatorJob({ actor, job, act, pending, notice, navigate }: {
  actor: Actor; job?: DispatchBooking; act: (b: DispatchBooking, action: string) => Promise<DispatchBooking | undefined>
  pending: boolean; notice: string; navigate: (s: OperatorScreen) => void
}) {
  return (
    <PhoneFrame title="Active job" left={<button className="icon-btn" onClick={() => navigate("home")} aria-label="Back"><Icon name="chevron" /></button>} right={null}>
      <main className="operator-page">
        {notice && <p className="op-notice" role="status">{notice}</p>}
        {!job ? (
          <div className="op-empty">
            <Icon name="truck" size={36} />
            <h2>No active job</h2>
            <p>Accept a request to start your next job.</p>
            <button className="btn btn-primary" onClick={() => navigate("requests")}>View requests</button>
          </div>
        ) : (
          <JobProgress job={job} act={act} pending={pending} />
        )}
      </main>
      <OperatorNav active="job" navigate={navigate} hasJob={!!job} />
    </PhoneFrame>
  )
}

function JobProgress({ job, act, pending }: {
  job: DispatchBooking; act: (b: DispatchBooking, action: string) => Promise<DispatchBooking | undefined>; pending: boolean
}) {
  const stages = bookingStages(job.service)
  const nextStage = stages[job.stage + 1]
  const isLast = job.stage === stages.length - 1

  // Track own GPS position for ETA display
  const [myPosition, setMyPosition] = useState<{ lng: number; lat: number } | null>(null)
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(
    job.pickupCoords ? { lng: job.pickupCoords[0], lat: job.pickupCoords[1] } : null,
  )
  const geocodedRef = useRef("")

  useEffect(() => {
    if (!navigator.geolocation) return
    const id = navigator.geolocation.watchPosition(
      (pos) => setMyPosition({ lng: pos.coords.longitude, lat: pos.coords.latitude }),
      undefined,
      { enableHighAccuracy: true, maximumAge: 10_000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])

  // Use stored coords from booking, fall back to geocoding
  useEffect(() => {
    if (job.pickupCoords) {
      setPickupCoords({ lng: job.pickupCoords[0], lat: job.pickupCoords[1] })
      return
    }
    if (!job.pickup || geocodedRef.current === job.pickup) return
    geocodedRef.current = job.pickup
    if (!hasMapbox()) return
    void forwardGeocode(job.pickup).then((results) => {
      if (results[0]) {
        setPickupCoords({ lng: results[0].center[0], lat: results[0].center[1] })
      }
    })
  }, [job.pickup, job.pickupCoords])

  // Compute ETA to pickup using geocoded coordinates
  const etaMinutes = myPosition && pickupCoords ? (() => {
    // Haversine distance → ETA at ~30 km/h city speed
    const R = 6371
    const dLat = (pickupCoords.lat - myPosition.lat) * Math.PI / 180
    const dLng = (pickupCoords.lng - myPosition.lng) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(myPosition.lat * Math.PI / 180) * Math.cos(pickupCoords.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2
    const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return Math.max(1, Math.round(dist * 1.4 / 30 * 60))
  })() : null

  // Compute route line + directions from operator to motorist's pickup
  const [routeLine, setRouteLine] = useState<{ type: "LineString"; coordinates: [number, number][] } | null>(null)
  const [routeSteps, setRouteSteps] = useState<RouteStep[]>([])
  const [routeDistance, setRouteDistance] = useState<number | null>(null)
  const [routeDuration, setRouteDuration] = useState<number | null>(null)
  const routeThrottle = useRef<ReturnType<typeof setTimeout>>(undefined)
  const lastRouteKey = useRef("")

  useEffect(() => {
    if (!myPosition || !pickupCoords || !hasMapbox()) {
      setRouteLine(null)
      setRouteSteps([])
      setRouteDistance(null)
      setRouteDuration(null)
      return
    }
    const key = `${myPosition.lng.toFixed(3)},${myPosition.lat.toFixed(3)}`
    if (key === lastRouteKey.current) return
    if (routeThrottle.current) clearTimeout(routeThrottle.current)
    routeThrottle.current = setTimeout(() => {
      lastRouteKey.current = key
      void getRoute(myPosition, pickupCoords).then((result) => {
        if (result) {
          setRouteLine(result.geometry as { type: "LineString"; coordinates: [number, number][] })
          setRouteSteps(result.steps.filter(s => s.instruction))
          setRouteDistance(result.distance)
          setRouteDuration(result.duration)
        }
      })
    }, 2000)
    return () => { if (routeThrottle.current) clearTimeout(routeThrottle.current) }
  }, [myPosition, pickupCoords])

  // Pickup pin for map
  const pickupPin: [number, number] | null = pickupCoords
    ? [pickupCoords.lng, pickupCoords.lat]
    : null

  // Format helpers
  const fmtDist = (m: number) => m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`
  const fmtTime = (s: number) => {
    const min = Math.round(s / 60)
    return min < 60 ? `${min} min` : `${Math.floor(min / 60)}h ${min % 60}m`
  }
  const maneuverIcon = (m: string) => {
    if (m.includes("left")) return "↰"
    if (m.includes("right")) return "↱"
    if (m.includes("arrive")) return "⬤"
    if (m.includes("depart")) return "▶"
    if (m.includes("roundabout") || m.includes("rotary")) return "↻"
    if (m.includes("merge")) return "⤵"
    if (m.includes("fork")) return "⑂"
    if (m.includes("uturn") || m.includes("u-turn")) return "↩"
    return "↑"
  }

  return (
    <>
      {/* Map — fully interactive */}
      <div className="op-job-map">
        <IllustrativeMap showUserLocation pickup={pickupPin} route={routeLine} />
      </div>

      {/* Route summary bar */}
      {routeDistance !== null && routeDuration !== null && (
        <div className="op-route-summary">
          <span><Icon name="route" size={14} /> {fmtDist(routeDistance)}</span>
          <span><Icon name="clock" size={14} /> {fmtTime(routeDuration)}</span>
        </div>
      )}

      {/* GPS Tracking Status */}
      <div className="op-tracking-card">
        <span className={`tracking-dot ${myPosition ? "live" : ""}`} />
        <div>
          <strong>{myPosition ? "GPS broadcasting" : "Acquiring GPS…"}</strong>
          <small>{myPosition ? "Motorist can see your location" : "Enable location access"}</small>
        </div>
        {etaMinutes !== null && (
          <span className="op-eta-badge">~{etaMinutes} min</span>
        )}
      </div>

      {/* Motorist info */}
      <div className="op-motorist-card">
        <Avatar initials="M" tone="orange" />
        <div>
          <strong>Motorist</strong>
          <small>{vehicleName(job.vehicle)} · {job.vehicle.color} · {job.vehicle.plate}</small>
        </div>
      </div>

      {/* Route */}
      <div className="op-job-route">
        <div><Icon name="pin" size={16} /><span><small>PICKUP</small><strong>{job.pickup}</strong></span></div>
        {job.destination && <div><Icon name="pin" size={16} /><span><small>DROP-OFF</small><strong>{job.destination}</strong></span></div>}
      </div>

      {/* Turn-by-turn directions */}
      {routeSteps.length > 0 && (
        <div className="op-directions">
          <h3><Icon name="route" size={16} /> Directions to pickup</h3>
          <ol className="op-directions-list">
            {routeSteps.map((s, i) => (
              <li key={i} className={`op-direction-step ${i === 0 ? "current" : ""}`}>
                <span className="op-direction-icon">{maneuverIcon(s.maneuver)}</span>
                <span className="op-direction-text">
                  <span>{s.instruction}</span>
                  {s.distance > 0 && <small>{fmtDist(s.distance)}</small>}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Service + fare */}
      <div className="op-job-info">
        <div><span>Service</span><strong>{job.service}</strong></div>
        <div><span>Incident</span><strong>{job.incident}</strong></div>
        <div><span>Fare</span><strong>{money(job.quote.total)}</strong></div>
      </div>

      {/* Progress timeline */}
      <div className="op-timeline">
        <h3>Progress</h3>
        {stages.map((stage, i) => {
          const done = i <= job.stage
          const current = i === job.stage
          return (
            <div key={stage} className={`op-timeline-row ${done ? "done" : ""} ${current ? "current" : ""}`}>
              <div className="op-timeline-dot">{done ? <Icon name="check" size={12} /> : <span>{i + 1}</span>}</div>
              <span>{stage}</span>
            </div>
          )
        })}
      </div>

      {/* Contact row */}
      <div className="op-contact-row">
        <button className="btn btn-secondary"><Icon name="phone" size={16} /> Call motorist</button>
        <button className="btn btn-secondary"><Icon name="chat" size={16} /> Message</button>
      </div>

      {/* Main action */}
      <div className="op-job-action">
        <button className="btn btn-primary op-advance-btn" disabled={pending} onClick={() => void act(job, "advance")}>
          {isLast ? (
            <><Icon name="check" size={20} /> Complete service</>
          ) : (
            <><Icon name="chevron" size={20} /> {nextStage}</>
          )}
        </button>
      </div>
    </>
  )
}

/* ── History ────────────────────────────────────────────────────────── */

function OperatorHistory({ actor, bookings, navigate }: {
  actor: Actor; bookings: DispatchBooking[]; navigate: (s: OperatorScreen) => void
}) {
  const [filter, setFilter] = useState<"all" | "completed" | "cancelled">("all")
  const shown = bookings.filter(b => filter === "all" || b.status === filter)
  return (
    <PhoneFrame title="Job history" left={<button className="icon-btn" onClick={() => navigate("home")} aria-label="Back"><Icon name="chevron" /></button>} right={null}>
      <main className="operator-page">
        <div className="op-history-filters">
          {(["all", "completed", "cancelled"] as const).map(f => (
            <button key={f} className={`op-filter-btn ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
              {f === "all" ? "All" : f === "completed" ? "Completed" : "Cancelled"}
            </button>
          ))}
        </div>
        {shown.length === 0 ? (
          <div className="op-empty">
            <Icon name="clock" size={36} />
            <h2>No jobs yet</h2>
            <p>Your completed and cancelled jobs will appear here.</p>
          </div>
        ) : (
          shown.map(booking => (
            <div key={booking.id} className="op-history-card">
              <div className="op-history-header">
                <div>
                  <strong>{booking.service}</strong>
                  <small>{new Date(booking.createdAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</small>
                </div>
                <Badge tone={booking.status === "completed" ? "success" : "neutral"}>
                  {booking.status === "completed" ? "Completed" : "Cancelled"}
                </Badge>
              </div>
              <div className="op-history-route">
                <span><Icon name="pin" size={14} /> {booking.pickup}</span>
                {booking.destination && <span><Icon name="pin" size={14} /> {booking.destination}</span>}
              </div>
              <div className="op-history-footer">
                <span>{vehicleName(booking.vehicle)} · {booking.vehicle.plate}</span>
                <strong>{money(booking.quote.total)}</strong>
              </div>
              {booking.rating !== undefined && (
                <div className="op-history-rating">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Icon key={i} name="star" size={14} filled={i < (booking.rating ?? 0)} />
                  ))}
                  <small>Motorist rating</small>
                </div>
              )}
            </div>
          ))
        )}
      </main>
      <OperatorNav active="history" navigate={navigate} />
    </PhoneFrame>
  )
}

/* ── Profile ───────────────────────────────────────────────────────── */

function OperatorProfile({ actor, api, navigate, workspaceControls }: {
  actor: Actor; api: DispatchClient; navigate: (s: OperatorScreen) => void; workspaceControls?: WorkspaceControls
}) {
  const myJob = api.bookings.find(b => b.status === "assigned" && b.operatorId === actor.id)
  const totalCompleted = api.bookings.filter(b => b.status === "completed").length
  return (
    <PhoneFrame title="Profile" left={<button className="icon-btn" onClick={() => navigate("home")} aria-label="Back"><Icon name="chevron" /></button>} right={null}>
      <main className="operator-page">
        <div className="op-profile-hero">
          <Avatar initials={actor.name.split(/\s+/).map(w => w[0]).join("").slice(0, 2)} tone="dark" />
          <h2>{actor.name}</h2>
          <small>Operator · {actor.providerId}</small>
        </div>

        <div className="op-profile-cards">
          <div className="op-profile-card">
            <Icon name="truck" size={20} />
            <div>
              <strong>Assigned truck</strong>
              <small>{actor.truck ?? "None"}</small>
            </div>
          </div>
          <div className="op-profile-card">
            <Icon name="shield" size={20} />
            <div>
              <strong>Status</strong>
              <small>{myJob ? "On a job" : "Available"}</small>
            </div>
          </div>
          <div className="op-profile-card">
            <Icon name="check" size={20} />
            <div>
              <strong>Jobs completed</strong>
              <small>{totalCompleted}</small>
            </div>
          </div>
        </div>

        <p className="demo-notice" style={{ marginTop: 20 }}>
          Operator profile editing, truck management and availability settings are coming soon.
        </p>
        {workspaceControls && workspaceControls.workspaces.length > 1 && (
          <div className="op-workspace-select" style={{ marginTop: 16 }}>
            <label className="field">
              <span>Switch workspace</span>
              <select
                value={workspaceControls.currentWorkspace}
                onChange={event => workspaceControls.select(event.target.value)}
                disabled={workspaceControls.signingOut}
              >
                {workspaceControls.workspaces.map(item => (
                  <option key={item.key} value={item.key}>
                    {item.actor.role === "motorist" ? "Motorist" : `${item.actor.role === "central" ? "Central admin" : item.actor.role === "operator" ? "Operator" : "Company"} · ${item.actor.name}`}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        {workspaceControls && (
          <button className="signout-button" style={{ marginTop: 16, width: "100%" }} onClick={workspaceControls.signOut} disabled={workspaceControls.signingOut}>
            <Icon name="logout" size={16} /> {workspaceControls.signingOut ? "Signing out…" : "Sign out"}
          </button>
        )}
      </main>
      <OperatorNav active="profile" navigate={navigate} />
    </PhoneFrame>
  )
}

/* ── Bottom Navigation ─────────────────────────────────────────────── */

function OperatorNav({ active, navigate, requests = 0, hasJob = false }: {
  active: OperatorScreen; navigate: (s: OperatorScreen) => void; requests?: number; hasJob?: boolean
}) {
  const tabs: { id: OperatorScreen; label: string; icon: string }[] = [
    { id: "home", label: "Home", icon: "home" },
    { id: "requests", label: "Requests", icon: "bell" },
    { id: "job", label: "Active", icon: "truck" },
    { id: "history", label: "History", icon: "clock" },
    { id: "profile", label: "Profile", icon: "user" },
  ]
  return (
    <nav className="bottom-nav op-bottom-nav" aria-label="Operator navigation">
      {tabs.map(tab => (
        <button key={tab.id} className={`nav-tab ${active === tab.id ? "active" : ""} ${tab.id === "job" ? "op-job-tab" : ""}`}
          onClick={() => navigate(tab.id)} aria-current={active === tab.id ? "page" : undefined}>
          <span className="nav-icon">
            <Icon name={tab.icon as any} size={tab.id === "job" ? 26 : 22} />
            {tab.id === "requests" && requests > 0 && <span className="op-tab-badge">{requests}</span>}
            {tab.id === "job" && hasJob && <span className="op-tab-dot" />}
          </span>
          <span className="nav-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}
