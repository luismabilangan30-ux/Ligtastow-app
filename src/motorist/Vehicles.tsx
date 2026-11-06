import { useState, type FormEvent } from "react"
import { Button, Icon } from "../components/ui"
import { ConfirmDialog, EmptyState, Page, VehicleSummary } from "./components"
import {
  validateVehicle,
  vehicleName,
  vehicleTypes,
  type Vehicle,
} from "./model"

export function Vehicles({
  vehicles,
  add,
  edit,
  remove,
  back,
  cloud = false,
  pending = false,
  error = "",
}: {
  vehicles: Vehicle[]
  add: () => void
  edit: (id: string) => void
  remove: (id: string) => Promise<boolean>
  back: () => void
  cloud?: boolean
  pending?: boolean
  error?: string
}) {
  const [deleting, setDeleting] = useState<Vehicle>()
  return (
    <Page title="My vehicles" back={back}>
      <p className="page-copy">
        Saved {cloud ? "in your account" : "on this browser"}. Choose a vehicle when requesting assistance.
      </p>
      <div className="choice-list">
        {vehicles.map((vehicle) => (
          <article className="vehicle-management" key={vehicle.id}>
            <div className="vehicle-choice">
              <VehicleSummary vehicle={vehicle} />
            </div>
            <div className="row-actions">
              <Button variant="secondary" onClick={() => edit(vehicle.id)}>
                Edit {vehicle.make}
              </Button>
              <button
                className="text-btn danger-text"
                onClick={() => setDeleting(vehicle)}
              >
                Delete {vehicle.make}
              </button>
            </div>
          </article>
        ))}
      </div>
      {!vehicles.length && (
        <EmptyState title="No saved vehicles">
          Add your vehicle to begin a request.
        </EmptyState>
      )}
      <Button icon="plus" onClick={add} className="full-width spaced">
        Add vehicle
      </Button>
      {deleting && (
        <ConfirmDialog
          pending={pending}
          title="Delete vehicle?"
          confirmLabel="Delete vehicle"
          onCancel={() => setDeleting(undefined)}
          onConfirm={() => {
            void remove(deleting.id).then(saved => { if (saved) setDeleting(undefined) })
          }}
        >
          <p>
            Remove {vehicleName(deleting)} ({deleting.plate}) from {cloud ? "your account" : "this browser"}?
            Existing booking records keep their vehicle details.
          </p>
          {error && <p className="field-error" role="alert">{error}</p>}
        </ConfirmDialog>
      )}
    </Page>
  )
}

export default function VehicleEditor({
  vehicle,
  vehicles,
  save,
  back,
  cloud = false,
  pending = false,
}: {
  vehicle?: Vehicle
  vehicles: Vehicle[]
  save: (vehicle: Vehicle) => void | Promise<void>
  back: () => void
  cloud?: boolean
  pending?: boolean
}) {
  const [form, setForm] = useState<Vehicle>(() =>
    vehicle
      ? { ...vehicle }
      : {
          id: crypto.randomUUID(),
          make: "",
          model: "",
          year: "",
          type: "Sedan",
          color: "",
          plate: "",
        },
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [discard, setDiscard] = useState(false)
  const [dirty, setDirty] = useState(false)
  const change = (key: keyof Vehicle, value: string) => {
    setForm((previous) => ({ ...previous, [key]: value }))
    setDirty(true)
    setErrors((previous) => ({ ...previous, [key]: "" }))
  }
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending) return
    const found = validateVehicle(form, vehicles)
    setErrors(found)
    if (Object.keys(found).length) {
      event.currentTarget
        .querySelector<HTMLInputElement | HTMLSelectElement>(
          `[name="${Object.keys(found)[0]}"]`,
        )
        ?.focus()
      return
    }
    void save({
      ...form,
      make: form.make.trim(),
      model: form.model.trim(),
      color: form.color.trim(),
      plate: form.plate.trim().toUpperCase(),
    })
  }
  return (
    <Page
      title={vehicle ? "Edit vehicle" : "Add vehicle"}
      back={() => { if (!pending) dirty ? setDiscard(true) : back() }}
    >
      <h1>Your vehicle details</h1>
      <p className="page-copy">
        All fields are required. Use the plate or temporary registration shown
        on your vehicle.
      </p>
      <form noValidate onSubmit={submit} className="vehicle-form">
        {([
          ["make", "Make", "Toyota"],
          ["model", "Model", "Vios"],
          ["year", "Model year", "2019"],
          ["color", "Color", "Black"],
          ["plate", "Plate / temporary registration", "ABC 1234"],
        ] as const).map(([key, label, placeholder]) => (
          <label className="field" key={key}>
            <span>{label}</span>
            <input
              name={key}
              disabled={pending}
              value={form[key]}
              placeholder={placeholder}
              required
              maxLength={key === "year" ? 4 : key === "plate" ? 12 : 50}
              inputMode={key === "year" ? "numeric" : "text"}
              autoComplete="off"
              aria-invalid={!!errors[key]}
              aria-describedby={errors[key] ? `${key}-error` : undefined}
              onChange={(event) => change(key, event.target.value)}
            />
            {errors[key] && (
              <small id={`${key}-error`} className="field-error">
                {errors[key]}
              </small>
            )}
          </label>
        ))}
        <label className="field">
          <span>Vehicle type</span>
          <select
            name="type"
            disabled={pending}
            value={form.type}
            onChange={(event) => change("type", event.target.value)}
          >
            {vehicleTypes.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>
        <button className="btn btn-primary full-width spaced" type="submit" disabled={pending}>
          <Icon name="check" />
          {pending ? "Saving…" : cloud ? "Save vehicle to account" : "Save demo vehicle"}
        </button>
      </form>
      {discard && (
        <ConfirmDialog
          title="Discard vehicle changes?"
          confirmLabel="Discard changes"
          onCancel={() => setDiscard(false)}
          onConfirm={back}
        >
          <p>Your unsaved changes will be lost.</p>
        </ConfirmDialog>
      )}
    </Page>
  )
}
