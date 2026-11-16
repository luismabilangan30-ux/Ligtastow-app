/**
 * Real-time operator location tracking via Supabase Realtime Channels.
 *
 * - Operator broadcasts their GPS position every 10 seconds.
 * - Motorist subscribes to their assigned operator's channel to see live location.
 * - Uses Supabase Realtime "Broadcast" (no database table needed — in-memory pub/sub).
 */
import { supabase } from "../auth/client"
import type { GeoPosition } from "../components/mapUtils"

export type OperatorLocation = GeoPosition & {
  heading?: number
  speed?: number
  timestamp: number
}

/** Channel name for a specific booking's operator tracking */
function trackingChannel(bookingId: string): string {
  return `tracking:${bookingId}`
}

/* ------------------------------------------------------------------ */
/*  Operator side: broadcast position                                 */
/* ------------------------------------------------------------------ */

let watchCleanup: (() => void) | null = null

/**
 * Start broadcasting operator location for a booking.
 * Call this when the operator accepts/is assigned a job.
 */
export function startBroadcasting(bookingId: string): void {
  if (!supabase || !navigator.geolocation) return
  stopBroadcasting()

  const channel = supabase.channel(trackingChannel(bookingId))
  channel.subscribe()

  const watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const payload: OperatorLocation = {
        lng: pos.coords.longitude,
        lat: pos.coords.latitude,
        heading: pos.coords.heading ?? undefined,
        speed: pos.coords.speed ?? undefined,
        timestamp: Date.now(),
      }
      void channel.send({
        type: "broadcast",
        event: "location",
        payload,
      })
    },
    undefined,
    { enableHighAccuracy: true, maximumAge: 5_000 },
  )

  watchCleanup = () => {
    navigator.geolocation.clearWatch(watchId)
    void supabase!.removeChannel(channel)
  }
}

/**
 * Stop broadcasting operator location.
 * Call this when the job is completed or cancelled.
 */
export function stopBroadcasting(): void {
  if (watchCleanup) {
    watchCleanup()
    watchCleanup = null
  }
}

/* ------------------------------------------------------------------ */
/*  Motorist side: subscribe to operator location                     */
/* ------------------------------------------------------------------ */

/**
 * Subscribe to live operator location updates for a booking.
 * Returns an unsubscribe function.
 */
export function subscribeToOperator(
  bookingId: string,
  onLocation: (location: OperatorLocation) => void,
): () => void {
  if (!supabase) return () => {}

  const channel = supabase
    .channel(trackingChannel(bookingId))
    .on("broadcast", { event: "location" }, (message) => {
      const payload = message.payload as OperatorLocation
      if (payload && typeof payload.lng === "number" && typeof payload.lat === "number") {
        onLocation(payload)
      }
    })
    .subscribe()

  return () => {
    void supabase!.removeChannel(channel)
  }
}

/* ------------------------------------------------------------------ */
/*  ETA helper                                                        */
/* ------------------------------------------------------------------ */

/** Rough ETA in minutes based on straight-line distance and assumed 30 km/h city speed */
export function estimateETA(operator: GeoPosition, destination: GeoPosition): number {
  const R = 6371 // Earth radius in km
  const dLat = ((destination.lat - operator.lat) * Math.PI) / 180
  const dLng = ((destination.lng - operator.lng) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((operator.lat * Math.PI) / 180) *
      Math.cos((destination.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  // Multiply by 1.4 for road winding factor, 30 km/h average city speed
  return Math.max(1, Math.round((dist * 1.4) / 30 * 60))
}
