import { useEffect, useRef, type ReactNode } from "react"
import {
  Avatar,
  Badge,
  Button,
  Icon,
  MapCanvas,
  PhoneFrame,
} from "../components/ui"
import { money, type Quote, type Vehicle, vehicleName } from "./model"

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
export function IllustrativeMap({ tracking = false }: { tracking?: boolean }) {
  return (
    <div
      className="illustrative-map"
      role="img"
      aria-label="Illustrative map. GPS and routing are not connected."
    >
      <MapCanvas tracking={tracking} decorative />
      <span className="map-demo-label">Illustrative map · GPS unavailable</span>
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
        <strong>Sample fare</strong>
        <Badge>Demo</Badge>
      </div>
      {[
        ["Service base", quote.base],
        ["Sample travel charge", quote.travel],
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
          <small>DEMO TOTAL</small>
          <b>No payment will be collected.</b>
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
        <small>Sample provider · availability unverified</small>
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
