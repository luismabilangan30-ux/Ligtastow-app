/**
 * Distance-based fare calculation for LigtasTow.
 *
 * Pricing structure (PHP):
 * - Base fare: fixed per service type
 * - Per-km charge: varies by service (towing charges more per km)
 * - Platform fee: fixed percentage
 * - Provider adjustment: per-provider modifier
 *
 * Uses Mapbox Directions API distance when available,
 * falls back to the original flat-rate pricing.
 */

import type { Service } from "../motorist/model"

export interface FareBreakdown {
  base: number
  travel: number
  fee: number
  provider: number
  total: number
  distanceKm?: number
  durationMin?: number
}

/** Per-km rates by service type */
const PER_KM_RATES: Record<string, number> = {
  "Tow Truck": 45,      // ₱45/km — heavy vehicle transport
  "Emergency Tow": 55,  // ₱55/km — priority surcharge
  "Jump Start": 20,     // ₱20/km — operator travel only
  "Flat Tire": 20,      // ₱20/km — operator travel only
  "Fuel Refill": 15,    // ₱15/km — operator travel only
}

/** Base fares by service type */
const BASE_FARES: Record<string, number> = {
  "Tow Truck": 800,
  "Emergency Tow": 1000,
  "Jump Start": 500,
  "Flat Tire": 600,
  "Fuel Refill": 400,
}

/** Platform fee percentage */
const PLATFORM_FEE_RATE = 0.05 // 5%

/** Minimum platform fee */
const MIN_PLATFORM_FEE = 50

/**
 * Calculate fare based on route distance.
 * @param service - service type
 * @param distanceMeters - route distance in meters (from Mapbox Directions)
 * @param durationSeconds - route duration in seconds
 * @param providerAdjustment - per-provider price modifier
 */
export function calculateFare(
  service: Service,
  distanceMeters: number,
  durationSeconds: number,
  providerAdjustment: number = 0,
): FareBreakdown {
  const distanceKm = distanceMeters / 1000
  const durationMin = Math.round(durationSeconds / 60)

  const base = BASE_FARES[service] ?? 800
  const perKm = PER_KM_RATES[service] ?? 30
  const travel = Math.round(distanceKm * perKm)
  const subtotal = base + travel + providerAdjustment
  const fee = Math.max(MIN_PLATFORM_FEE, Math.round(subtotal * PLATFORM_FEE_RATE))
  const total = subtotal + fee

  return {
    base,
    travel,
    fee,
    provider: providerAdjustment,
    total,
    distanceKm: Math.round(distanceKm * 10) / 10,
    durationMin,
  }
}

/**
 * Format distance for display
 */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(1)} km`
}

/**
 * Format duration for display
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}
