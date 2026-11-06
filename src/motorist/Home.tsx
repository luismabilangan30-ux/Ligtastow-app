import { Avatar, Badge, BottomNav, Icon, PhoneFrame } from "../components/ui"
import { providers, money, quoteFor } from "./model"
import type { Booking, Screen, Service } from "./model"
import { IllustrativeMap } from "./components"
import { profileInitials, type MotoristProfile } from "./profileModel"

export default function MotoristHome({
  profile,
  startBooking,

  pickup,
  activeBooking,

  navigate,
  providerOptions = providers,
  cloud = false,
}: {
  profile: MotoristProfile
  startBooking: (service?: Service, providerId?: string) => void

  pickup: string
  activeBooking: Booking | undefined

  navigate: (screen: Screen) => void
  providerOptions?: typeof providers
  cloud?: boolean
}) {
  return (
    <PhoneFrame>
      <div className="home-map">
        <IllustrativeMap />
        <div className="mobile-top">
          <button className="profile-chip" onClick={() => navigate("profile")}>
            <Avatar initials={profileInitials(profile.name)} />
            <span>
              <small>Welcome back</small>
              <strong>{profile.name.split(/\s+/)[0]}</strong>
            </span>
          </button>
          <button
            className="icon-btn elevated"
            onClick={() => navigate("notifications")}
            aria-label="Notifications"
          >
            <Icon name="bell" />
          </button>
        </div>
        <button
          className="location-search"
          onClick={() => navigate("location")}
        >
          <Icon name="search" />
          <span>
            <small>YOUR LOCATION</small>
            <strong>{pickup}</strong>
          </span>
          <Icon name="chevron" />
        </button>
      </div>
      <div className="home-sheet">
        <div className="grabber" />
        <p className="demo-notice">
          {cloud ? "Development account · Requests are saved online. No real service or payments." : "Local demo · Requests connect to the operator workspace. No real service or payments."}
        </p>
        {cloud && !providerOptions.length && <p className="demo-notice">No providers are enabled for testing yet. You can add your vehicle and update your profile.</p>}
        {activeBooking && (
          <button
            className="active-booking-link"
            onClick={() =>
              navigate(
                activeBooking.status === "searching" ? "searching" : "tracking",
              )
            }
          >
            Resume {activeBooking.service}
            <Icon name="chevron" />
          </button>
        )}
        <div className="section-heading">
          <div>
            <small>ROADSIDE ASSISTANCE</small>
            <strong>How can we help?</strong>
          </div>
          <Badge tone="success">Demo providers</Badge>
        </div>
        <div className="service-grid">
          <button
            className="service-card primary-service"
            onClick={() => startBooking("Tow Truck")}
          >
            <span>
              <Icon name="truck" size={26} />
            </span>
            <strong>Tow Truck</strong>
            <small>Try a request</small>
          </button>
          <button
            className="service-card"
            onClick={() => startBooking("Jump Start")}
          >
            <span>
              <Icon name="wrench" size={24} />
            </span>
            <strong>Jump Start</strong>
            <small>Try a request</small>
          </button>
          <button
            className="service-card"
            onClick={() => startBooking("Flat Tire")}
          >
            <span>
              <Icon name="car" size={24} />
            </span>
            <strong>Flat Tire</strong>
            <small>Try a request</small>
          </button>
          <button
            className="service-card"
            onClick={() => startBooking("Fuel Refill")}
          >
            <span>
              <Icon name="fuel" size={24} />
            </span>
            <strong>Fuel Refill</strong>
            <small>Try a request</small>
          </button>
        </div>
        <div className="section-heading compact">
          <strong>Sample partners</strong>
          <button onClick={() => navigate("search")}>See all</button>
        </div>
        <div className="partner-scroll">
          {providerOptions.map((p) => (
            <button
              className="partner-card"
              key={p.id}
              onClick={() => startBooking("Tow Truck", p.id)}
            >
              <Avatar initials={p.initials} tone="orange" />
              <div className="partner-main">
                <strong>{p.name}</strong>
                <span>
                  <Icon name="shield" size={13} /> Demo provider
                </span>
                <small>{p.area}</small>
              </div>
              <div className="partner-meta">
                <b>
                  <Icon name="star" size={12} filled /> {p.rating}
                </b>
                <strong>{money(quoteFor("Tow Truck", p.id).total)}</strong>
                <small>sample total</small>
              </div>
            </button>
          ))}
        </div>
      </div>
      <BottomNav
        active="home"
        onNavigate={navigate}
        onSos={() => startBooking("Emergency Tow")}
      />
    </PhoneFrame>
  )
}
