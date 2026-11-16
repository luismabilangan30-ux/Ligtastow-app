import { useEffect, useRef, useState } from "react"
import {
  subscribeToOperator,
  startBroadcasting,
  stopBroadcasting,
  estimateETA,
  type OperatorLocation,
} from "./tracking"
import type { GeoPosition } from "../components/mapUtils"

/**
 * Hook for the motorist: subscribes to live operator location.
 * Returns the latest operator position and ETA.
 */
export function useOperatorTracking(
  bookingId: string | undefined,
  pickupPosition?: GeoPosition | null,
): {
  operatorPosition: [number, number] | null
  eta: number | null
  lastUpdate: number | null
} {
  const [position, setPosition] = useState<OperatorLocation | null>(null)

  useEffect(() => {
    if (!bookingId) return
    const unsubscribe = subscribeToOperator(bookingId, (loc) => {
      setPosition(loc)
    })
    return () => {
      unsubscribe()
      setPosition(null)
    }
  }, [bookingId])

  const operatorPosition: [number, number] | null = position
    ? [position.lng, position.lat]
    : null

  const eta =
    position && pickupPosition
      ? estimateETA(position, pickupPosition)
      : null

  return {
    operatorPosition,
    eta,
    lastUpdate: position?.timestamp ?? null,
  }
}

/**
 * Hook for the operator: broadcasts GPS location while a job is active.
 * Automatically starts/stops broadcasting when bookingId changes.
 */
export function useOperatorBroadcast(bookingId: string | undefined): void {
  const activeBookingRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (bookingId && bookingId !== activeBookingRef.current) {
      activeBookingRef.current = bookingId
      startBroadcasting(bookingId)
    }
    if (!bookingId && activeBookingRef.current) {
      stopBroadcasting()
      activeBookingRef.current = undefined
    }
    return () => {
      stopBroadcasting()
      activeBookingRef.current = undefined
    }
  }, [bookingId])
}
