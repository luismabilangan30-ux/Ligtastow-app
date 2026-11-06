import { useEffect, useRef, useState } from "react"
import { Button, Icon } from "../components/ui"
import BookingFlow from "./BookingFlow"
import { ActiveBooking, History, Receipt } from "./BookingStatus"
import { Location, Search, Settings } from "./Browse"
import Profile, { ProfileEditor, NotificationPreferences } from "./Profile"
import { demoProfile } from "./profileModel"
import { EmptyState, Page } from "./components"
import Home from "./Home"
import {
  newDraft,
  providers,
  readVehicles,
  savedPlaces,
  type Booking,
  type Service,
  type Vehicle,
} from "./model"
import { useNavigation } from "./navigation"
import VehicleEditor, { Vehicles } from "./Vehicles"
import "./motorist.css"
import type { DispatchClient } from "../shared/useDispatch"
import type { AccountClient } from "../shared/account"

const vehicleStorageKey = "ligtastow.vehicles.v1"
export default function MotoristApp({ api, account }: { api: DispatchClient; account?: AccountClient }) {
  const { route, navigate, back, bookingStep } = useNavigation()
  const [demoVehicles, setVehicles] = useState<Vehicle[]>(() => {
    if (account) return []
    try {
      return readVehicles(localStorage.getItem(vehicleStorageKey))
    } catch {
      return readVehicles(null)
    }
  })
  const [storageWarning, setStorageWarning] = useState("")
  const [localProfile, setProfile] = useState({ ...demoProfile })
  const [localUpdates, setShowUpdates] = useState(true)
  const vehicles = account?.session.vehicles ?? demoVehicles
  const profile = account?.session.profile ?? localProfile
  const showUpdates = account?.session.bookingUpdates ?? localUpdates
  const providerOptions = account ? account.session.providers.flatMap(item => {
    const sample = providers.find(provider => provider.id === item.id)
    return sample ? [{ ...sample, ...item }] : []
  }) : providers
  const [pickup, setPickup] = useState(savedPlaces[0].address)
  const [draft, setDraft] = useState(() => newDraft(vehicles, pickup))
  const bookings = api.bookings
  const requestId = useRef(crypto.randomUUID())
  const [readUpdates, setReadUpdates] = useState<string[]>([])
  const [toast, setToast] = useState("")
  const [offline, setOffline] = useState(!navigator.onLine)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const active = bookings.find(
    (booking) =>
      booking.status === "searching" || booking.status === "assigned",
  )
  const receipt = bookings.find((booking) => booking.id === route.id)
  const displayedBooking = receipt ?? active
  const bookingScreen = route.screen === "booking" && !active
  const notify = (message: string) => {
    clearTimeout(timer.current)
    setToast(message)
    timer.current = setTimeout(() => setToast(""), 4500)
  }
  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => {
    if ((route.screen === "searching" || route.screen === "tracking") && displayedBooking &&
      (displayedBooking.status === "completed" || displayedBooking.status === "cancelled")) {
      navigate("receipt", { id: displayedBooking.id }, true)
    }
  }, [route.screen, displayedBooking?.id, displayedBooking?.status])
  useEffect(() => {
    const online = () => setOffline(!navigator.onLine)
    window.addEventListener("online", online)
    window.addEventListener("offline", online)
    return () => {
      window.removeEventListener("online", online)
      window.removeEventListener("offline", online)
    }
  }, [])
  useEffect(() => {
    const heading =
      document.querySelector<HTMLElement>(".motorist-shell h1") ??
      document.querySelector<HTMLElement>(".motorist-shell main") ??
      document.querySelector<HTMLElement>(".motorist-shell .phone-frame")
    if (heading) {
      heading.tabIndex = -1
      heading.focus({ preventScroll: true })
    }
    document.querySelector(".motorist-shell main")?.scrollTo(0, 0)
  }, [route.screen, route.step, route.id])
  const saveVehicles = (next: Vehicle[]) => {
    setVehicles(next)
    try {
      localStorage.setItem(vehicleStorageKey, JSON.stringify(next))
      setStorageWarning("")
    } catch {
      setStorageWarning(
        "Browser storage is unavailable. Vehicle changes work for this session but will be lost on reload.",
      )
    }
  }
  const startBooking = (
    service: Service = "Tow Truck",
    providerId?: string,
  ) => {
    if (active) {
      notify(
        "You already have an active request. Complete or cancel it before starting another.",
      )
      navigate(active.status === "searching" ? "searching" : "tracking", { id: active.id })
      return
    }
    if (!providerOptions.length) { notify("No providers are enabled for testing yet. You can still save your profile and vehicles."); return }
    setDraft(newDraft(vehicles, pickup, service, providerId ?? providerOptions[0].id))
    requestId.current = crypto.randomUUID()
    navigate("booking", { step: 1 })
  }
  const notificationKey = (booking: Booking) =>
    `${booking.id}:${booking.status}:${booking.stage}`
  return (
    <div className="showcase-bg motorist-shell">
      {offline && (
        <div className="connection-banner" role="status">
          Offline · Reconnect to save booking changes.
        </div>
      )}
      {storageWarning && (
        <div className="storage-warning" role="alert">
          {storageWarning}
          <button
            onClick={() => setStorageWarning("")}
            aria-label="Dismiss storage warning"
          >
            ×
          </button>
        </div>
      )}
      {route.screen === "home" && (
        <Home
          cloud={!!account}
          providerOptions={providerOptions}
          profile={profile}
          pickup={pickup}
          startBooking={startBooking}
          activeBooking={active}
          navigate={(screen) => navigate(screen, screen === "searching" || screen === "tracking" ? { id: active?.id } : {})}
        />
      )}
      {route.screen === "search" && (
        <Search startBooking={startBooking} navigate={navigate} back={back} providerOptions={providerOptions} />
      )}
      {route.screen === "profile" && (
        <Profile
          cloud={!!account}
          profile={profile}
          showUpdates={showUpdates}
          vehicles={vehicles}
          startBooking={startBooking}
          navigate={navigate}
          back={back}
        />
      )}
      {route.screen === "edit-profile" && (
        <ProfileEditor
          cloud={!!account}
          pending={account?.pending}
          profile={profile}
          back={() => navigate("profile", {}, true)}
          save={async (value) => {
            if (account) { if (!await account.saveProfile(value)) return }
            else setProfile(value)
            navigate("profile", {}, true)
            notify(account ? "Profile saved to your account." : "Profile updated for this demo session.")
          }}
        />
      )}
      {route.screen === "settings" && route.id === "notifications" && (
        <NotificationPreferences
          cloud={!!account}
          pending={account?.pending}
          enabled={showUpdates}
          change={enabled => { if (account) void account.savePreference(enabled); else setShowUpdates(enabled) }}
          back={back}
        />
      )}
      {route.screen === "settings" && route.id !== "notifications" && (
        <Settings section={route.id} back={back} cloud={!!account} />
      )}
      {route.screen === "location" && (
        <Location
          pickup={pickup}
          back={back}
          select={(address) => {
            setPickup(address)
            back()
            notify("Pickup address updated.")
          }}
        />
      )}
      {route.screen === "vehicles" && (
        <Vehicles
          cloud={!!account}
          pending={account?.pending}
          error={account?.error}
          vehicles={vehicles}
          back={back}
          add={() => navigate("vehicle")}
          edit={(id) => navigate("vehicle", { id })}
          remove={async (id) => {
            if (account) { if (!await account.removeVehicle(id)) return false }
            else saveVehicles(vehicles.filter((vehicle) => vehicle.id !== id))
            if (draft.vehicleId === id)
              setDraft((previous) => ({ ...previous, vehicleId: "" }))
            notify(account ? "Vehicle removed from your account." : "Vehicle removed from this browser.")
            return true
          }}
        />
      )}
      {route.screen === "vehicle" && (
        <VehicleEditor
          cloud={!!account}
          pending={account?.pending}
          key={route.id ?? "new"}
          vehicle={vehicles.find((vehicle) => vehicle.id === route.id)}
          vehicles={vehicles}
          back={back}
          save={async (vehicle) => {
            if (account) { if (!await account.saveVehicle(vehicle)) return }
            else saveVehicles(
              vehicles.some((item) => item.id === vehicle.id)
                ? vehicles.map((item) =>
                    item.id === vehicle.id ? vehicle : item,
                  )
                : [...vehicles, vehicle],
            )
            setDraft((previous) => ({ ...previous, vehicleId: vehicle.id }))
            back()
            notify(account ? "Vehicle saved to your account." : "Vehicle saved in the local demo.")
          }}
        />
      )}
      {bookingScreen && (
        <BookingFlow
          cloud={!!account}
          providerOptions={providerOptions}
          step={route.step ?? 1}
          draft={draft}
          vehicles={vehicles}
          change={(changes) =>
            setDraft((previous) => ({ ...previous, ...changes }))
          }
          goStep={bookingStep}
          addVehicle={() => navigate("vehicle")}
          close={() => {
            setDraft(newDraft(vehicles, pickup))
            navigate("home", {}, true)
          }}
          confirm={() => {
            const vehicle = vehicles.find((item) => item.id === draft.vehicleId)
            if (!vehicle) { notify("Choose a saved vehicle."); return }
            void api.create({ draft, vehicle, requestId: requestId.current }).then((booking) => {
              if (!booking) return
              setDraft(newDraft(vehicles, pickup))
              requestId.current = crypto.randomUUID()
              navigate("searching", { id: booking.id }, true)
            })
          }}
          pending={api.pending || api.loading}
        />
      )}
      {(route.screen === "searching" ||
        route.screen === "tracking" ||
        (route.screen === "booking" && active)) && (
        <ActiveBooking
          booking={displayedBooking}
          back={() => navigate("home")}
          cancel={async (reason) => {
            if (!displayedBooking) return false
            const saved = await api.command(displayedBooking, { action: "cancel", reason })
            if (!saved) return false
            navigate("receipt", { id: saved.id }, true)
            return true
          }}
          pending={api.pending}
          error={api.error}
          navigate={navigate}
          notify={notify}
        />
      )}
      {route.screen === "history" && (
        <History
          cloud={!!account}
          bookings={bookings}
          navigate={navigate}
          back={back}
          startBooking={startBooking}
        />
      )}
      {route.screen === "receipt" && (
        <Receipt
          key={route.id}
          booking={receipt}
          back={() => navigate("history")}
          rate={(rating) => {
            if (receipt?.status !== "completed") return
            void api.command(receipt, { action: "rate", rating }).then((saved) => { if (saved) notify("Rating saved to the booking record.") })
          }}
        />
      )}
      {route.screen === "notifications" && (
        <Page title="Notifications" back={back}>
          <div className="page-actions">
            <p>Updates from your booking records.</p>
            <button
              disabled={!showUpdates || bookings.length === 0}
              onClick={() => {
                setReadUpdates(bookings.map(notificationKey))
                notify("All updates marked as read.")
              }}
            >
              Mark all read
            </button>
          </div>
          {!showUpdates ? (
            <EmptyState title="Booking updates are off">
              You can still track requests in History.
              <Button
                variant="secondary"
                onClick={() => navigate("settings", { id: "notifications" })}
              >
                Manage notifications
              </Button>
            </EmptyState>
          ) : bookings.length ? (
            <div className="notification-list">
              {bookings.map((booking) => (
                <button
                  className={
                    readUpdates.includes(notificationKey(booking))
                      ? ""
                      : "unread"
                  }
                  key={booking.id}
                  onClick={() => {
                    setReadUpdates((previous) => [
                      ...previous,
                      notificationKey(booking),
                    ])
                    navigate(
                      booking.status === "searching"
                        ? "searching"
                        : booking.status === "assigned"
                          ? "tracking"
                          : "receipt",
                      { id: booking.id },
                    )
                  }}
                >
                  <span className="choice-icon">
                    <Icon name="truck" />
                  </span>
                  <span>
                    <strong>Booking {booking.status}</strong>
                    <small>
                      {booking.service} · {booking.providerName}
                    </small>
                    <em>{booking.id}</em>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState title="You’re all caught up">
              Updates will appear when you create a booking.
              <Button onClick={() => navigate("home")}>Go home</Button>
            </EmptyState>
          )}
        </Page>
      )}
      {toast && (
        <div className="app-toast" role="status">
          <Icon name="check" size={17} />
          {toast}
        </div>
      )}
    </div>
  )
}
