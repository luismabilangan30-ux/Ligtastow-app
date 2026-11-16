/** Lightweight mapbox utilities — no mapbox-gl import */

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined

/** Check if Mapbox is configured */
export function hasMapbox(): boolean {
  return !!MAPBOX_TOKEN
}

export function getMapboxToken(): string {
  return MAPBOX_TOKEN ?? ""
}

export interface GeoPosition {
  lng: number
  lat: number
}

export function getCurrentPosition(): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported"))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({ lng: pos.coords.longitude, lat: pos.coords.latitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  })
}

export function watchPosition(
  onUpdate: (pos: GeoPosition) => void,
  onError?: (err: GeolocationPositionError) => void,
): () => void {
  if (!navigator.geolocation) return () => {}
  const id = navigator.geolocation.watchPosition(
    (pos) => onUpdate({ lng: pos.coords.longitude, lat: pos.coords.latitude }),
    onError,
    { enableHighAccuracy: true },
  )
  return () => navigator.geolocation.clearWatch(id)
}

export interface GeocodingResult {
  name: string
  address: string
  center: [number, number]
}

export async function forwardGeocode(
  query: string,
  proximity?: GeoPosition,
): Promise<GeocodingResult[]> {
  if (!MAPBOX_TOKEN) return []
  const params = new URLSearchParams({
    access_token: MAPBOX_TOKEN,
    country: "PH",
    limit: "5",
    language: "en",
  })
  if (proximity) params.set("proximity", `${proximity.lng},${proximity.lat}`)
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params}`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json()
  return (data.features ?? []).map((f: any) => ({
    name: f.text,
    address: f.place_name,
    center: f.center as [number, number],
  }))
}

export async function reverseGeocode(
  pos: GeoPosition,
): Promise<string> {
  if (!MAPBOX_TOKEN) return ""
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${pos.lng},${pos.lat}.json?access_token=${MAPBOX_TOKEN}&country=PH&limit=1&language=en`
  const res = await fetch(url)
  if (!res.ok) return ""
  const data = await res.json()
  return data.features?.[0]?.place_name ?? ""
}

export interface RouteStep {
  instruction: string
  distance: number   // meters
  duration: number   // seconds
  maneuver: string   // e.g. "turn-right", "straight", "arrive"
}

export interface RouteInfo {
  geometry: { type: "LineString"; coordinates: [number, number][] }
  distance: number
  duration: number
  steps: RouteStep[]
}

export async function getRoute(
  origin: GeoPosition,
  destination: GeoPosition,
): Promise<RouteInfo | null> {
  if (!MAPBOX_TOKEN) return null
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?access_token=${MAPBOX_TOKEN}&geometries=geojson&overview=full&steps=true&language=en`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = await res.json()
  const route = data.routes?.[0]
  if (!route) return null
  const steps: RouteStep[] = (route.legs ?? []).flatMap((leg: any) =>
    (leg.steps ?? []).map((s: any) => ({
      instruction: s.maneuver?.instruction ?? "",
      distance: s.distance ?? 0,
      duration: s.duration ?? 0,
      maneuver: s.maneuver?.type ?? "",
    }))
  )
  return {
    geometry: route.geometry,
    distance: route.distance,
    duration: route.duration,
    steps,
  }
}
