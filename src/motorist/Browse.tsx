import { useState } from "react"
import { BottomNav, Button, Icon } from "../components/ui"
import { EmptyState, Page, ProviderHeader } from "./components"
import {
  matchesQuery,
  money,
  providers,
  quoteFor,
  savedPlaces,
  services,
  type Screen,
  type Service,
} from "./model"

type Navigate = (screen: Screen, options?: { id?: string }) => void
export function Search({
  startBooking,
  navigate,
  back,
  providerOptions = providers,
}: {
  startBooking: (service?: Service, providerId?: string) => void
  navigate: Navigate
  back: () => void
  providerOptions?: typeof providers
}) {
  const [query, setQuery] = useState("")
  const shownServices = services.filter(
    (item) =>
      item.name !== "Emergency Tow" &&
      matchesQuery(query, item.name, item.description),
  )
  const shownProviders = providerOptions.filter((item) =>
    matchesQuery(query, item.name, item.area),
  )
  return (
    <Page
      title="Find assistance"
      back={back}
      footer={
        <BottomNav
          active="search"
          onNavigate={navigate}
          onSos={() => startBooking("Emergency Tow")}
        />
      }
    >
      <label className="app-search">
        <Icon name="search" />
        <input
          aria-label="Search services or providers"
          placeholder="Search services or towing companies"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <p className="demo-notice">
        Sample services and providers. Availability is not live.
      </p>
      <p className="search-count" role="status">
        {shownServices.length + shownProviders.length} results
      </p>
      {shownServices.length > 0 && (
        <>
          <h2>Roadside services</h2>
          <div className="service-list">
            {shownServices.map((service) => (
              <button
                key={service.name}
                onClick={() => startBooking(service.name)}
              >
                <span className="choice-icon">
                  <Icon name={service.icon} />
                </span>
                <span>
                  <strong>{service.name}</strong>
                  <small>{service.description}</small>
                </span>
                <Icon name="chevron" />
              </button>
            ))}
          </div>
        </>
      )}
      {shownProviders.length > 0 && (
        <>
          <h2>Sample providers</h2>
          <div className="choice-list">
            {shownProviders.map((provider) => (
              <button
                className="provider-choice"
                key={provider.id}
                onClick={() => startBooking("Tow Truck", provider.id)}
              >
                <ProviderHeader name={provider.name} />
                <span className="provider-detail">
                  {provider.area} ·{" "}
                  {money(quoteFor("Tow Truck", provider.id).total)} sample tow
                </span>
              </button>
            ))}
          </div>
        </>
      )}
      {!shownServices.length && !shownProviders.length && (
        <EmptyState title="No matches found">
          Try a service name, provider name or area.
          <Button variant="secondary" onClick={() => setQuery("")}>
            Clear search
          </Button>
        </EmptyState>
      )}
    </Page>
  )
}

export function Location({
  pickup,
  select,
  back,
}: {
  pickup: string
  select: (address: string) => void
  back: () => void
}) {
  const [query, setQuery] = useState("")
  const [custom, setCustom] = useState(pickup)
  const [error, setError] = useState("")
  const matches = savedPlaces.filter((place) =>
    matchesQuery(query, place.name, place.address),
  )
  return (
    <Page title="Choose location" back={back}>
      <p className="page-copy">
        Choose a saved example or enter your pickup address. Device location is
        not connected.
      </p>
      <label className="app-search">
        <Icon name="search" />
        <input
          aria-label="Search saved places"
          placeholder="Search saved places"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className="settings-list">
        {matches.map((place) => (
          <button key={place.name} onClick={() => select(place.address)}>
            <Icon name="pin" />
            <span>
              <strong>{place.name}</strong>
              <small>{place.address}</small>
            </span>
            <Icon name="chevron" />
          </button>
        ))}
      </div>
      {!matches.length && (
        <EmptyState title="No saved place matches">
          Enter an address below.
        </EmptyState>
      )}
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          if (custom.trim().length < 5)
            setError("Enter an address with at least five characters.")
          else select(custom.trim())
        }}
      >
        <label className="field">
          <span>Pickup address</span>
          <input
            maxLength={180}
            value={custom}
            onChange={(event) => {
              setCustom(event.target.value)
              setError("")
            }}
            aria-invalid={!!error}
            aria-describedby={error ? "address-error" : undefined}
          />
          {error && (
            <small className="field-error" id="address-error" role="alert">
              {error}
            </small>
          )}
        </label>
        <button className="btn btn-primary full-width spaced" type="submit">
          Use this address
        </button>
      </form>
    </Page>
  )
}

export function Settings({
  section,
  back,
  cloud = false,
}: {
  section?: string
  back: () => void
  cloud?: boolean
}) {
  const content: Record<string, [string, string, string]> = {
    payments: [
      "Payment methods",
      "No payment method is required for demo bookings.",
      "GCash, cards and cash collection are not connected. Do not enter payment credentials into this demo.",
    ],
    privacy: [
      "Safety & privacy",
      "Vehicles are saved in this browser’s local storage. Delete them in My vehicles to remove them from this browser.",
      "Submitted bookings, entered addresses, notes, ratings and activity logs are stored in this project’s local development data file and shown to the relevant demo workspaces. Use sample data. Profile edits and notification preferences reset when you reload or switch workspaces. GPS, camera and device notification access are not requested.",
    ],
    notifications: [
      "Notification settings",
      "Booking updates appear in the in-app notifications screen.",
      "Push delivery is not connected and no device notification permission is requested.",
    ],
    support: [
      "Help & support",
      "This is a local demonstration of connected motorist and dispatch workspaces.",
      "Submit a sample request, select the matching operator workspace to accept and progress the job, and return to Motorist to view updates and rate the service. Company and central workspaces can assign or cancel jobs. Real authentication, GPS, payments, phone calls and chat are not connected.",
    ],
  }
  if (cloud) {
    content.privacy = ["Safety & privacy", "Your profile, saved vehicles and booking history are stored in the development account database.", "Booking details and activity are available to the assigned provider team and authorized administrators. Deleting a saved vehicle keeps its snapshot in earlier bookings. This development version has no account-deletion workflow yet. GPS, camera and push notifications are not connected."]
    content.support = ["Help & support", "This development version connects your account to saved profiles, vehicles and dispatch records.", "Use test details. Provider staff access must be assigned by the project owner. Sample prices and maps are illustrative; roadside service, payments, calls and chat are not connected."]
  }
  const [title, lead, body] = content[section ?? "support"] ?? content.support
  return (
    <Page title={title} back={back}>
      <h1>{title}</h1>
      <p className="page-copy">{lead}</p>
      <p className="page-copy spaced">{body}</p>
    </Page>
  )
}
