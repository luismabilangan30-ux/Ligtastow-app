import { useEffect, useRef, lazy, Suspense, type ReactNode } from "react"
import {
  Avatar,
  Badge,
  Button,
  Icon,
  MapCanvas,
  PhoneFrame,
} from "../components/ui"
import { hasMapbox, type GeoPosition } from "../components/mapUtils"
import "../components/mapbox.css"
import { money, type Quote, type Vehicle, vehicleName } from "./model"

const LazyMapboxMap = lazy(() => import("../components/MapboxMap"))

export function Page({
  title,
  back,
  children,
  footer,
}: {
  title: string
  back: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <PhoneFrame
      title={title}
      right={null}
      left={
        <button className="icon-btn" onClick={back} aria-label="Back">
          <Icon name="chevron" />
        </button>
      }
    >
      <main className="motorist-page" tabIndex={-1}>
        {children}
      </main>
      {footer}
    </PhoneFrame>
  )
}
export function IllustrativeMap({
  tracking = false,
  pickup,
  destination,
  operator,
  route,
  showUserLocation = false,
  onMapClick,
}: {
  tracking?: boolean
  pickup?: [number, number] | null
  destination?: [number, number] | null
  operator?: [number, number] | null
  route?: { type: "LineString"; coordinates: [number, number][] } | null
  showUserLocation?: boolean
  onMapClick?: (pos: GeoPosition) => void
}) {
  if (hasMapbox()) {
    return (
      <Suspense fallback={<div className="illustrative-map" role="img" aria-label="Loading map…" />}>
        <LazyMapboxMap
          tracking={tracking}
          pickup={pickup}
          destination={destination}
          operator={operator}
          route={route}
          showUserLocation={showUserLocation}
          onMapClick={onMapClick}
          interactive={!tracking || !!pickup}
        />
      </Suspense>
    )
  }
  return (
    <div
      className="illustrative-map"
      role="img"
      aria-label="Map view"
    >
      <MapCanvas tracking={tracking} decorative />
      <span className="map-demo-label">Map preview</span>
    </div>
  )
}
export function EmptyState({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="empty-state">
      <Icon name="search" size={28} />
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  )
}
export function VehicleSummary({ vehicle }: { vehicle: Vehicle }) {
  return (
    <>
      <span className="choice-icon">
        <Icon name="car" />
      </span>
      <span>
        <strong>{vehicleName(vehicle)}</strong>
        <small>
          {vehicle.type} · {vehicle.color} · {vehicle.plate}
        </small>
      </span>
    </>
  )
}
export function Fare({ quote }: { quote: Quote }) {
  return (
    <div className="fare-card">
      <div className="fare-title">
        <strong>Estimated fare</strong>
        <Badge>Estimate</Badge>
      </div>
      {[
        ["Service base", quote.base],
        ["Travel charge", quote.travel],
        ["Provider adjustment", quote.provider],
        ["Platform fee", quote.fee],
      ].map(([label, amount]) => (
        <div className="fare-row" key={label}>
          <span>{label}</span>
          <strong>{money(Number(amount))}</strong>
        </div>
      ))}
      <div className="fare-total">
        <span>
          <small>ESTIMATED TOTAL</small>
          <b>Final amount may vary.</b>
        </span>
        <strong>{money(quote.total)}</strong>
      </div>
    </div>
  )
}
export function ProviderHeader({ name }: { name: string }) {
  return (
    <div className="selected-provider">
      <Avatar
        initials={name === "Viray Towing Services" ? "VT" : "MT"}
        tone="orange"
      />
      <span>
        <strong>{name}</strong>
        <small>Verified provider · availability subject to confirmation</small>
      </span>
    </div>
  )
}
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  onConfirm,
  onCancel,
  pending = false,
}: {
  title: string
  children: ReactNode
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  pending?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const dialog = ref.current!
    dialog.showModal()
    return () => {
      dialog.close()
      previous?.focus()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className="confirm-dialog"
      aria-labelledby="dialog-title"
      onCancel={(event) => {
        event.preventDefault()
        if (!pending) onCancel()
      }}
    >
      <h2 id="dialog-title">{title}</h2>
      {children}
      <div className="dialog-actions">
        <button className="btn btn-secondary" autoFocus onClick={onCancel} disabled={pending}>
          Keep it
        </button>
        <button className="btn btn-danger" onClick={onConfirm} disabled={pending}>
          {pending ? "Saving…" : confirmLabel}
        </button>
      </div>
    </dialog>
  )
}
