import { useRef, useEffect } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import { getMapboxToken, type GeoPosition } from "./mapUtils"

// Default center: Metro Manila, Philippines
const MANILA_CENTER: [number, number] = [121.0, 14.6]
const DEFAULT_ZOOM = 12

export interface MapboxMapProps {
  center?: [number, number]
  zoom?: number
  showUserLocation?: boolean
  pickup?: [number, number] | null
  destination?: [number, number] | null
  operator?: [number, number] | null
  route?: { type: "LineString"; coordinates: [number, number][] } | null
  onMapClick?: (pos: GeoPosition) => void
  className?: string
  tracking?: boolean
  interactive?: boolean
}

export default function MapboxMap({
  center,
  zoom = DEFAULT_ZOOM,
  showUserLocation = false,
  pickup,
  destination,
  operator,
  route,
  onMapClick,
  className = "",
  tracking = false,
  interactive = true,
}: MapboxMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<{
    pickup?: mapboxgl.Marker
    destination?: mapboxgl.Marker
    operator?: mapboxgl.Marker
  }>({})

  const token = getMapboxToken()

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || !token) return

    mapboxgl.accessToken = token

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: center ?? MANILA_CENTER,
      zoom,
      interactive,
      attributionControl: false,
    })

    map.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
      "bottom-right",
    )

    if (showUserLocation) {
      map.addControl(
        new mapboxgl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: true,
          showAccuracyCircle: false,
        }),
        "bottom-right",
      )
    }

    if (!interactive) {
      map.scrollZoom.disable()
      map.boxZoom.disable()
      map.dragRotate.disable()
      map.dragPan.disable()
      map.keyboard.disable()
      map.doubleClickZoom.disable()
      map.touchZoomRotate.disable()
    }

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Handle map click
  useEffect(() => {
    const map = mapRef.current
    if (!map || !onMapClick) return
    const handler = (e: mapboxgl.MapMouseEvent) => {
      onMapClick({ lng: e.lngLat.lng, lat: e.lngLat.lat })
    }
    map.on("click", handler)
    return () => { map.off("click", handler) }
  }, [onMapClick])

  // Pickup marker
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (markersRef.current.pickup) {
      markersRef.current.pickup.remove()
      markersRef.current.pickup = undefined
    }
    if (pickup) {
      const el = document.createElement("div")
      el.className = "mapbox-marker-pickup"
      el.innerHTML = `<svg width="28" height="36" viewBox="0 0 28 36"><path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.3 21.7 0 14 0z" fill="#22c55e"/><circle cx="14" cy="14" r="6" fill="#fff"/></svg>`
      markersRef.current.pickup = new mapboxgl.Marker({ element: el, anchor: "bottom" })
        .setLngLat(pickup)
        .addTo(map)
    }
  }, [pickup])

  // Destination marker
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (markersRef.current.destination) {
      markersRef.current.destination.remove()
      markersRef.current.destination = undefined
    }
    if (destination) {
      const el = document.createElement("div")
      el.className = "mapbox-marker-destination"
      el.innerHTML = `<svg width="28" height="36" viewBox="0 0 28 36"><path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.3 21.7 0 14 0z" fill="#ef4444"/><circle cx="14" cy="14" r="6" fill="#fff"/></svg>`
      markersRef.current.destination = new mapboxgl.Marker({ element: el, anchor: "bottom" })
        .setLngLat(destination)
        .addTo(map)
    }
  }, [destination])

  // Operator marker
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (markersRef.current.operator) {
      markersRef.current.operator.remove()
      markersRef.current.operator = undefined
    }
    if (operator) {
      const el = document.createElement("div")
      el.className = "mapbox-marker-operator"
      el.innerHTML = `<svg width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="#3b82f6" stroke="#fff" stroke-width="3"/><text x="16" y="21" text-anchor="middle" fill="#fff" font-size="14" font-weight="bold">🚛</text></svg>`
      markersRef.current.operator = new mapboxgl.Marker({ element: el })
        .setLngLat(operator)
        .addTo(map)
    }
  }, [operator])

  // Route line
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const addRoute = () => {
      if (map.getSource("route")) {
        map.removeLayer("route-line")
        map.removeSource("route")
      }
      if (route) {
        map.addSource("route", {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: route },
        })
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#3b82f6",
            "line-width": 5,
            "line-opacity": 0.8,
          },
        })
      }
    }

    if (map.isStyleLoaded()) {
      addRoute()
    } else {
      map.on("style.load", addRoute)
      return () => { map.off("style.load", addRoute) }
    }
  }, [route])

  // Fit bounds when pickup + destination exist
  useEffect(() => {
    const map = mapRef.current
    if (!map || !pickup) return
    if (destination) {
      const bounds = new mapboxgl.LngLatBounds()
      bounds.extend(pickup)
      bounds.extend(destination)
      if (operator) bounds.extend(operator)
      map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 800 })
    } else {
      // Single pickup pin: fly to it so user can see and adjust
      map.flyTo({ center: pickup, zoom: 15, duration: 800 })
    }
  }, [pickup, destination, operator])

  // Re-center on single point change
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (center && !pickup && !destination) {
      map.flyTo({ center, zoom, duration: 600 })
    }
  }, [center, zoom, pickup, destination])

  if (!token) return null

  return (
    <div
      ref={containerRef}
      className={`mapbox-container ${tracking ? "mapbox-tracking" : ""} ${className}`}
      role="application"
      aria-label="Map"
    />
  )
}
