import { type ReactNode } from "react"

export type IconName = "home" | "search" | "sos" | "history" | "user" | "pin" | "truck" | "bell" | "chevron" | "phone" | "chat" | "star" | "shield" | "route" | "clock" | "car" | "wrench" | "fuel" | "menu" | "calendar" | "wallet" | "chart" | "fleet" | "users" | "settings" | "check" | "alert" | "arrow" | "close" | "more" | "filter" | "plus" | "document" | "building" | "logout"

const paths: Record<IconName, ReactNode> = {
  home: (
    <>
      <path d="m3 10 9-7 9 7" />
      <path d="M5 9v11h14V9M9 20v-6h6v6" />
    </>
  ),

  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),

  sos: (
    <>
      <path d="M12 3 2.8 19h18.4L12 3Z" />
      <path d="M12 9v4m0 3v.1" />
    </>
  ),

  history: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5m4-1v5l3 2" />
    </>
  ),

  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c.8-5 3.5-7 8-7s7.2 2 8 7" />
    </>
  ),

  pin: (
    <>
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),

  truck: (
    <>
      <path d="M3 6h11v11H3zM14 10h4l3 4v3h-7z" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="18" cy="18" r="2" />
    </>
  ),

  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7M10 19h4" />
    </>
  ),

  chevron: <path d="m9 18 6-6-6-6" />,

  phone: <path d="M7 3 4 5c0 8 7 15 15 15l2-3-5-3-2 2c-3-1-5-3-6-6l2-2-3-5Z" />,

  chat: (
    <>
      <path d="M21 11a8 8 0 0 1-9 8c-2 0-4-.6-5.5-1.7L3 19l1.3-4A8 8 0 1 1 21 11Z" />
      <path d="M8 11h.1M12 11h.1M16 11h.1" />
    </>
  ),

  star: (
    <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" />
  ),

  shield: (
    <>
      <path d="M12 3 4 6v6c0 5 3 8 8 10 5-2 8-5 8-10V6l-8-3Z" />
      <path d="m8.5 12 2.2 2.2 4.8-5" />
    </>
  ),

  route: (
    <>
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="6" r="2" />
      <path d="M8 18h3c4 0 2-7 6-7h1" />
    </>
  ),

  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),

  car: (
    <>
      <path d="m5 11 2-5h10l2 5M3 12h18v6H3z" />
      <circle cx="7" cy="18" r="1.5" />
      <circle cx="17" cy="18" r="1.5" />
    </>
  ),

  wrench: (
    <path d="M14 6a4 4 0 0 0-5 5L3 17l4 4 6-6a4 4 0 0 0 5-5l-3 3-3-3 2-4Z" />
  ),

  fuel: (
    <>
      <path d="M5 3h9v18H5zM5 8h9" />
      <path d="M14 6h2l3 3v8c0 2 2 2 2 0V8" />
    </>
  ),

  menu: <path d="M4 7h16M4 12h16M4 17h16" />,

  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M7 3v4m10-4v4M3 10h18" />
    </>
  ),

  wallet: (
    <>
      <path d="M3 6h17v14H3z" />
      <path d="M3 6 16 3v3m1 7h4v4h-4a2 2 0 0 1 0-4Z" />
    </>
  ),

  chart: (
    <>
      <path d="M4 20V10m6 10V4m6 16v-7m5 7H2" />
    </>
  ),

  fleet: (
    <>
      <path d="M3 7h10v9H3zM13 10h4l3 3v3h-7z" />
      <circle cx="6" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </>
  ),

  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19c.5-4 2.5-6 6-6s5.5 2 6 6" />
      <path d="M16 5a3 3 0 0 1 0 6m1 2c2 .5 3.5 2.5 4 5" />
    </>
  ),

  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 13.5v-3l2-1-2-4-2.3 1a8 8 0 0 0-2.7-1.5L13.5 2h-3L10 5a8 8 0 0 0-2.7 1.5L5 5.5l-2 4 2 1v3l-2 1 2 4 2.3-1A8 8 0 0 0 10 19l.5 3h3l.5-3a8 8 0 0 0 2.7-1.5l2.3 1 2-4-2-1Z" />
    </>
  ),

  check: <path d="m5 12 4 4L19 6" />,

  alert: (
    <>
      <path d="M12 3 2.8 20h18.4L12 3Z" />
      <path d="M12 9v5m0 3v.1" />
    </>
  ),

  arrow: <path d="m5 12 14 0m-5-5 5 5-5 5" />,

  close: <path d="m6 6 12 12M18 6 6 18" />,

  more: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),

  filter: <path d="M4 6h16M7 12h10m-7 6h4" />,

  plus: <path d="M12 5v14M5 12h14" />,

  document: (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M14 3v5h5M9 13h6m-6 4h6" />
    </>
  ),

  building: (
    <>
      <path d="M4 21V5l8-3 8 3v16M8 8h2m4 0h2M8 12h2m4 0h2M8 16h2m4 0h2M9 21v-3h6v3" />
    </>
  ),

  logout: (
    <>
      <path d="M10 4H4v16h6m5-4 4-4-4-4m4 4H9" />
    </>
  ),
}

export function Icon({
  name,

  size = 20,

  filled = false,
}: {
  name: IconName

  size?: number

  filled?: boolean
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="logo">
      <span className="logo-mark">
        <Icon name="truck" size={22} />
      </span>
      {!compact && (
        <span>
          Ligtas<span>Tow</span>
        </span>
      )}
    </div>
  )
}

export function Button({
  children,

  variant = "primary",

  icon,

  onClick,

  className = "",
}: {
  children?: ReactNode

  variant?: "primary" | "secondary" | "ghost" | "danger"

  icon?: IconName

  onClick?: () => void

  className?: string
}) {
  return (
    <button
      type="button"
      className={`btn btn-${variant} ${className}`}
      onClick={() => onClick?.()}
    >
      {icon && <Icon name={icon} />}
      <span>{children}</span>
    </button>
  )
}

export function Badge({
  children,

  tone = "neutral",
}: {
  children: ReactNode

  tone?: "success" | "warning" | "brand" | "info" | "neutral"
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function Avatar({
  initials,

  tone = "dark",
}: {
  initials: string

  tone?: "dark" | "orange" | "green"
}) {
  return <span className={`avatar avatar-${tone}`}>{initials}</span>
}

export function MapCanvas({
  tracking = false,
  decorative = false,
}: {
  tracking?: boolean
  decorative?: boolean
}) {
  return (
    <div className={`map-canvas ${tracking ? "tracking-map" : ""}`}>
      <div className="road road-a" />
      <div className="road road-b" />
      <div className="road road-c" />
      <div className="road road-d" />
      <span className="map-label label-a">Aurora Blvd</span>
      <span className="map-label label-b">EDSA</span>
      <span className="map-label label-c">New Manila</span>
      {tracking && (
        <>
          <div className="route-line" />
          <span className="pin pickup">
            <Icon name="pin" size={18} />
          </span>
          <span className="pin destination">
            <Icon name="pin" size={18} />
          </span>
        </>
      )}
      <span className="truck-marker t1">
        <Icon name="truck" size={17} />
      </span>
      {!tracking && (
        <>
          <span className="truck-marker t2">
            <Icon name="truck" size={17} />
          </span>
          <span className="truck-marker t3">
            <Icon name="truck" size={17} />
          </span>
        </>
      )}
      <span className="current-dot">
        <i />
      </span>
      {!decorative && (
        <button className="map-locate" aria-label="Use current location">
          <Icon name="route" />
        </button>
      )}
    </div>
  )
}

export function PhoneFrame({
  children,

  title,

  left,

  right,
}: {
  children: ReactNode

  title?: string

  left?: ReactNode

  right?: ReactNode
}) {
  return (
    <div className="phone-frame">
      <div className="phone-status">
        <span>9:41</span>
        <span className="phone-island" />
        <span>5G&nbsp; ◉</span>
      </div>
      {title && (
        <div className="mobile-titlebar">
          {left ?? (
            <button className="icon-btn">
              <Icon name="chevron" />
            </button>
          )}
          <strong>{title}</strong>
          {right === undefined ? (
            <button className="icon-btn">
              <Icon name="bell" />
            </button>
          ) : (
            right
          )}
        </div>
      )}
      {children}
    </div>
  )
}

export function BottomNav({
  active = "home",

  onNavigate = () => {},

  onSos = () => {},
}: {
  active?: string

  onNavigate?: (screen: MotoristScreen) => void

  onSos?: () => void
}) {
  return (
    <nav className="bottom-nav">
      {[
        ["home", "Home"],

        ["search", "Search"],
      ].map(([i, l]) => (
        <button
          key={l}
          className={active === i ? "active" : ""}
          onClick={() => onNavigate(i as MotoristScreen)}
        >
          <Icon name={i as IconName} />
          <span>{l}</span>
        </button>
      ))}
      <button className="sos-nav" onClick={onSos} aria-label="Emergency SOS">
        <span>
          <Icon name="sos" size={23} />
        </span>
        <small>SOS</small>
      </button>
      {[
        ["history", "History", "history"],

        ["profile", "Profile", "user"],
      ].map(([screen, label, icon]) => (
        <button
          key={label}
          className={active === screen ? "active" : ""}
          onClick={() => onNavigate(screen as MotoristScreen)}
        >
          <Icon name={icon as IconName} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}

type MotoristScreen = "home" | "search" | "history" | "profile"
