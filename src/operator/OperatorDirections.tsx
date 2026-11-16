import { useEffect, useState } from "react"
import { Icon } from "../components/ui"
import { forwardGeocode, getRoute, hasMapbox, type GeoPosition, type RouteInfo } from "../components/mapUtils"
import { IllustrativeMap } from "../motorist/components"
import type { DispatchBooking } from "../shared/dispatch"
import { estimateETA } from "../shared/tracking"

type Pin = [number, number]

function useBookingPin(address: string, saved: Pin | undefined, attempt: number) {
  const lng = saved?.[0]
  const lat = saved?.[1]
  const [pin, setPin] = useState<Pin | null | undefined>(saved)

  useEffect(() => {
    if (lng !== undefined && lat !== undefined) {
      setPin([lng, lat])
      return
    }
    if (!address || !hasMapbox()) {
      setPin(null)
      return
    }
    let active = true
    setPin(undefined)
    void forwardGeocode(address).then(
      results => { if (active) setPin(results[0]?.center ?? null) },
      () => { if (active) setPin(null) },
    )
    return () => { active = false }
  }, [address, lng, lat, attempt])
  return pin
}

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

export default function OperatorDirections({ job, toShop, position }: {
  job: DispatchBooking
  toShop: boolean
  position: GeoPosition | null
}) {
  const [attempt, setAttempt] = useState(0)
  const pickup = useBookingPin(job.pickup, job.pickupCoords, attempt)
  const shop = useBookingPin(toShop ? job.destination : "", toShop ? job.destinationCoords : undefined, attempt)
  const originLng = toShop ? pickup?.[0] : position?.lng
  const originLat = toShop ? pickup?.[1] : position?.lat
  const target = toShop ? shop : pickup
  const [route, setRoute] = useState<RouteInfo | null | undefined>(undefined)
  const targetLng = target?.[0]
  const targetLat = target?.[1]

  useEffect(() => {
    if (!hasMapbox() || originLng === undefined || originLat === undefined || targetLng === undefined || targetLat === undefined) return
    let active = true
    void getRoute({ lng: originLng, lat: originLat }, { lng: targetLng, lat: targetLat }).then(
      result => { if (active) setRoute(result) },
      () => { if (active) setRoute(null) },
    )
    return () => { active = false }
  }, [originLng, originLat, targetLng, targetLat, attempt])

  const directionsUnavailable = pickup === null || (toShop && shop === null) || route === null
  const steps = route?.steps.filter(step => step.instruction)
  const pickupEta = !toShop && position && pickup
    ? estimateETA(position, { lng: pickup[0], lat: pickup[1] })
    : null

  return (
    <>
      <div className="op-job-map">
        <IllustrativeMap showUserLocation pickup={pickup} destination={shop} route={route?.geometry} />
      </div>
      {route && (
        <div className="op-route-summary">
          <span><Icon name="route" size={14} /> {fmtDist(route.distance)}</span>
          <span><Icon name="clock" size={14} /> {fmtTime(route.duration)}</span>
        </div>
      )}
      <div className="op-tracking-card">
        <span className={`tracking-dot ${position ? "live" : ""}`} />
        <div>
          <strong>{position ? "GPS broadcasting" : "Acquiring GPS…"}</strong>
          <small>{position ? "Motorist can see your location" : "Enable location access"}</small>
        </div>
        {pickupEta !== null && <span className="op-eta-badge">~{pickupEta} min</span>}
      </div>
      <section className="op-directions">
        <h3><Icon name="route" size={16} /> {toShop ? "Directions to auto shop" : "Directions to pickup"}</h3>
        <p>{toShop ? job.destination : job.pickup}</p>
        {steps?.length ? (
          <ol className="op-directions-list">
            {steps.map((step, index) => (
              <li key={index} className={`op-direction-step ${index === 0 ? "current" : ""}`}>
                <span className="op-direction-icon">{maneuverIcon(step.maneuver)}</span>
                <span className="op-direction-text">
                  <span>{step.instruction}</span>
                  {step.distance > 0 && <small>{fmtDist(step.distance)}</small>}
                </span>
              </li>
            ))}
          </ol>
        ) : !hasMapbox() ? (
          <p>Map directions are unavailable.</p>
        ) : directionsUnavailable || route ? (
          <div role="status">
            <p>Turn-by-turn directions are unavailable.</p>
            <button type="button" className="btn btn-secondary" onClick={() => { setRoute(undefined); setAttempt(value => value + 1) }}>
              Retry directions
            </button>
          </div>
        ) : (
          <p role="status">{!toShop && !position ? "Waiting for your location…" : "Loading directions…"}</p>
        )}
      </section>
    </>
  )
}
