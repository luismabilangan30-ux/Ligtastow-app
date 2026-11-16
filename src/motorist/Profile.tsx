import { useState, type FormEvent } from "react"
import {
  Avatar,
  BottomNav,
  Button,
  Icon,
  type IconName,
} from "../components/ui"
import { ConfirmDialog, Page } from "./components"
import {
  cleanProfile,
  profileInitials,
  validateProfile,
  type MotoristProfile,
} from "./profileModel"
import type { Screen, Service, Vehicle } from "./model"
import type { WorkspaceControls } from "../shared/dispatch"

type Navigate = (screen: Screen, options?: { id?: string }) => void

export default function Profile({
  profile,
  vehicles,
  showUpdates,
  navigate,
  back,
  startBooking,
  cloud = false,
  workspaceControls,
}: {
  profile: MotoristProfile
  vehicles: Vehicle[]
  showUpdates: boolean
  navigate: Navigate
  back: () => void
  startBooking: (service?: Service) => void
  cloud?: boolean
  workspaceControls?: WorkspaceControls
}) {
  const settings = [
    [
      "car",
      "My vehicles",
      `${vehicles.length} saved ${cloud ? "in your account" : "on this browser"}`,
      "vehicles",
    ],
    ["wallet", "Payment methods", "Payments are not connected", "payments"],
    ["shield", "Safety & privacy", "Data and permissions", "privacy"],
    [
      "bell",
      "Notification settings",
      `In-app updates ${showUpdates ? "on" : "off"}`,
      "notifications",
    ],
    ["document", "Help & support", "About LigtasTow", "support"],
  ]
  return (
    <Page
      title="My profile"
      back={back}
      footer={
        <BottomNav
          active="profile"
          onNavigate={navigate}
          onSos={() => startBooking("Emergency Tow")}
        />
      }
    >
      <div className="profile-hero">
        <Avatar initials={profileInitials(profile.name)} />
        <h2>{profile.name}</h2>
        {profile.email && <p className="profile-contact">{profile.email}</p>}
        {profile.phone && <p className="profile-contact">{profile.phone}</p>}
        <p>{cloud ? "Motorist" : "Guest motorist · Sign in for full access"}</p>
        <Button variant="secondary" onClick={() => navigate("edit-profile")}>
          Edit profile
        </Button>
      </div>
      <h2>Account</h2>
      <div className="settings-list">
        {settings.map(([icon, title, description, destination]) => (
          <button
            key={title}
            onClick={() =>
              destination === "vehicles"
                ? navigate("vehicles")
                : navigate("settings", { id: destination })
            }
          >
            <Icon name={icon as IconName} />
            <span>
              <strong>{title}</strong>
              <small>{description}</small>
            </span>
            <Icon name="chevron" />
          </button>
        ))}
      </div>
      <p className="page-copy spaced">
        {cloud ? "Your profile, vehicles and notification preference are saved to your account." : "Profile edits and notification preferences are saved locally. Sign in to sync across devices."}
      </p>
      {workspaceControls && workspaceControls.workspaces.length > 1 && (
        <>
          <h2>Workspace</h2>
          <div className="workspace-selector">
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
        </>
      )}
      {workspaceControls && (
        <div className="profile-signout">
          <button
            className="btn secondary"
            onClick={workspaceControls.signOut}
            disabled={workspaceControls.signingOut}
          >
            <Icon name="logout" size={16} />
            {workspaceControls.signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </Page>
  )
}

export function ProfileEditor({
  profile,
  save,
  back,
  cloud = false,
  pending = false,
}: {
  profile: MotoristProfile
  save: (profile: MotoristProfile) => void | Promise<void>
  back: () => void
  cloud?: boolean
  pending?: boolean
}) {
  const [form, setForm] = useState({ ...profile })
  const [errors, setErrors] =
    useState<Partial<Record<keyof MotoristProfile, string>>>({})
  const [discard, setDiscard] = useState(false)
  const profileFields: Array<keyof MotoristProfile> = ["name", "email", "phone"]
  const dirty = profileFields.some(
    (key) => profile[key] !== form[key],
  )
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending) return
    const found = validateProfile(form)
    setErrors(found)
    const first = Object.keys(found)[0]
    if (first) {
      event.currentTarget
        .querySelector<HTMLInputElement>(`[name="${first}"]`)
        ?.focus()
      return
    }
    void save(cleanProfile(form))
  }
  return (
    <Page title="Edit profile" back={() => { if (!pending) dirty ? setDiscard(true) : back() }}>
      <h1>Your details</h1>
      <p className="demo-notice">
        {cloud ? "Your name and mobile number are saved to your account. Email is managed by sign-in." : "Your details are saved locally on this device. Sign in to sync them."}
      </p>
      <form noValidate onSubmit={submit}>
        {([
          ["name", "Full name", "text", "Required"],
          ["email", "Email address", "email", "Optional · not verified"],
          [
            "phone",
            "Mobile number",
            "tel",
            "Optional · Philippine mobile number",
          ],
        ] as const).map(([key, label, type, hint]) => (
          <div className="field" key={key}>
            <label htmlFor={`profile-${key}`}>{label}</label>
            <input
              id={`profile-${key}`}
              name={key}
              disabled={pending}
              readOnly={cloud && key === "email"}
              type={type}
              required={key === "name"}
              value={form[key]}
              maxLength={key === "name" ? 80 : key === "email" ? 254 : 25}
              autoComplete="off"
              aria-invalid={!!errors[key]}
              aria-describedby={`profile-${key}-hint${
                errors[key] ? ` profile-${key}-error` : ""
              }`}
              onChange={(event) => {
                setForm((previous) => ({
                  ...previous,
                  [key]: event.target.value,
                }))
                setErrors((previous) => ({ ...previous, [key]: undefined }))
              }}
            />
            <small id={`profile-${key}-hint`}>{cloud && key === "email" ? "Verified sign-in email · read only" : hint}</small>
            {errors[key] && (
              <small
                id={`profile-${key}-error`}
                className="field-error"
                role="alert"
              >
                {errors[key]}
              </small>
            )}
          </div>
        ))}
        <button className="btn btn-primary full-width spaced" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save profile"}
        </button>
      </form>
      {discard && (
        <ConfirmDialog
          title="Discard profile changes?"
          confirmLabel="Discard changes"
          onCancel={() => setDiscard(false)}
          onConfirm={back}
        >
          <p>Your saved profile will stay as it is.</p>
        </ConfirmDialog>
      )}
    </Page>
  )
}

export function NotificationPreferences({
  enabled,
  change,
  back,
  cloud = false,
  pending = false,
}: {
  enabled: boolean
  change: (enabled: boolean) => void
  back: () => void
  cloud?: boolean
  pending?: boolean
}) {
  return (
    <Page title="Notification settings" back={back}>
      <h1>Booking updates</h1>
      <p className="page-copy">
        Choose whether to show booking updates in Notifications. {cloud ? "This preference is saved to your account." : "This preference lasts for this session."}
      </p>
      <div className="preference-card">
        <div>
          <strong id="booking-updates-label">In-app booking updates</strong>
          <p id="booking-updates-help">
            Your bookings remain available in History when updates are hidden.
          </p>
        </div>
        <button
          className="preference-switch"
          disabled={pending}
          role="switch"
          aria-checked={enabled}
          aria-labelledby="booking-updates-label"
          aria-describedby="booking-updates-help"
          onClick={() => change(!enabled)}
        >
          <span />
        </button>
      </div>
      <p className="preference-status" role="status">
        Booking updates are {enabled ? "on" : "off"}.
      </p>
      <p className="demo-notice">
        Push alerts and SMS notifications are coming soon. This control manages in-app notification display.
      </p>
    </Page>
  )
}
