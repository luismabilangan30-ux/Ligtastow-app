import { useState } from "react"
import { Icon, Logo, Button, Badge, Avatar, MapCanvas, PhoneFrame, BottomNav, type IconName } from "../components/ui"

function OperatorApp() {
  const [accepted, setAccepted] = useState(false)
  const [online, setOnline] = useState(true)
  return (
    <PhoneFrame>
      <main className="operator-page">
        <header className="operator-head">
          <Logo />
          <button className="icon-btn elevated">
            <Icon name="bell" />
          </button>
        </header>
        <div className="operator-welcome">
          <div>
            <small>GOOD MORNING</small>
            <h1>Roberto Garcia</h1>
            <p>Viray Towing Services</p>
          </div>
          <Avatar initials="RG" tone="dark" />
        </div>
        <button
          className={`availability ${online ? "online" : ""}`}
          onClick={() => setOnline(!online)}
        >
          <span>
            <i />
            <strong>{online ? "You’re available" : "You’re offline"}</strong>
            <small>
              {online ? "Receiving nearby requests" : "Tap to go online"}
            </small>
          </span>
          <b>{online ? "ON" : "OFF"}</b>
        </button>
        <div className="driver-metrics">
          <div>
            <Icon name="truck" />
            <span>
              <small>TODAY’S JOBS</small>
              <strong>3</strong>
            </span>
          </div>
          <div>
            <Icon name="wallet" />
            <span>
              <small>EARNINGS</small>
              <strong>₱4,820</strong>
            </span>
          </div>
          <div>
            <Icon name="star" />
            <span>
              <small>RATING</small>
              <strong>4.9</strong>
            </span>
          </div>
        </div>
        <div className="assigned-truck">
          <span className="choice-icon">
            <Icon name="truck" />
          </span>
          <div>
            <small>ASSIGNED TRUCK</small>
            <strong>Isuzu N-Series Flatbed</strong>
            <span>TOW 001 · Ready for service</span>
          </div>
          <Badge tone="success">Verified</Badge>
        </div>
        <div className="section-heading compact">
          <strong>{accepted ? "Active job" : "Nearby requests"}</strong>
          <span>Metro Manila</span>
        </div>
        <section className="incoming-card">
          <div className="incoming-top">
            <Badge tone={accepted ? "success" : "brand"}>
              {accepted ? "ACCEPTED" : "NEW REQUEST"}
            </Badge>
            <span>
              <Icon name="clock" size={15} />{" "}
              {accepted ? "Navigate now" : "00:24"}
            </span>
          </div>
          <div className="incoming-route">
            <div>
              <i />
              <span>
                <small>PICKUP · 2.4 KM AWAY</small>
                <strong>Aurora Boulevard, Cubao</strong>
              </span>
            </div>
            <div>
              <i />
              <span>
                <small>DESTINATION</small>
                <strong>Quezon Avenue</strong>
              </span>
            </div>
          </div>
          <div className="request-facts">
            <span>
              <Icon name="car" />
              <small>
                VEHICLE<strong>Toyota Vios</strong>
              </small>
            </span>
            <span>
              <Icon name="wrench" />
              <small>
                INCIDENT<strong>Engine failure</strong>
              </small>
            </span>
            <span>
              <Icon name="wallet" />
              <small>
                EST. PAY<strong>₱1,685</strong>
              </small>
            </span>
          </div>
          {!accepted ? (
            <div className="request-actions">
              <Button variant="secondary">Decline</Button>
              <Button onClick={() => setAccepted(true)}>Accept job</Button>
            </div>
          ) : (
            <>
              <Button icon="route">Navigate to motorist</Button>
              <div className="contact-row">
                <Button variant="secondary" icon="phone">
                  Call Juan
                </Button>
                <Button variant="secondary" icon="chat">
                  Message
                </Button>
              </div>
            </>
          )}
        </section>
        <div className="safety-note">
          <Icon name="shield" />
          <span>
            <strong>Drive safely</strong>
            <small>Only update your job status while parked.</small>
          </span>
        </div>
      </main>
      <BottomNav />
    </PhoneFrame>
  )
}

const navItems: [IconName, string][] = [
  ["home", "Overview"],
  ["calendar", "Bookings"],
  ["route", "Live dispatch"],
  ["fleet", "Fleet"],
  ["users", "Operators"],
  ["wallet", "Pricing"],
  ["star", "Feedback"],
  ["chart", "Analytics"],
  ["document", "Reports"],
  ["settings", "Settings"],
]

function MiniChart() {
  return (
    <div className="mini-chart">
      <svg viewBox="0 0 600 180" preserveAspectRatio="none">
        <defs>
          <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f04424" stopOpacity=".22" />
            <stop offset="1" stopColor="#f04424" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          className="area"
          d="M0 150 C45 130 50 110 90 120 S150 155 190 104 S245 60 280 83 S340 130 380 92 S420 45 460 65 S530 115 600 30 V180 H0Z"
        />
        <path
          className="line"
          d="M0 150 C45 130 50 110 90 120 S150 155 190 104 S245 60 280 83 S340 130 380 92 S420 45 460 65 S530 115 600 30"
        />
      </svg>
      <div className="chart-labels">
        <span>Mar 10</span>
        <span>Mar 11</span>
        <span>Mar 12</span>
        <span>Mar 13</span>
        <span>Mar 14</span>
        <span>Mar 15</span>
        <span>Mar 16</span>
      </div>
    </div>
  )
}

function Dashboard({ central = false }: { central?: boolean }) {
  const [active, setActive] = useState("Overview")
  const [drawer, setDrawer] = useState(false)
  const metrics = central
    ? [
        ["Active bookings", "284", "+12.4%", "brand"],
        ["Partner companies", "48", "+3 this month", "dark"],
        ["Active drivers", "376", "82% online", "green"],
        ["Gross service value", "₱2.84M", "+18.2%", "blue"],
      ]
    : [
        ["Active bookings", "12", "+3 today", "brand"],
        ["Available operators", "8", "of 14 total", "green"],
        ["Avg. response time", "11.4 min", "-1.8 min", "blue"],
        ["Today’s revenue", "₱48,250", "+12.6%", "dark"],
      ]
  const bookings = [
    [
      "LT-240316",
      "Juan Dela Cruz",
      "Aurora Blvd → Quezon Ave",
      "Roberto Garcia",
      "En route",
      "₱1,685",
    ],
    [
      "LT-240315",
      "Mika Santos",
      "Makati Ave → BGC",
      "Unassigned",
      "Pending",
      "₱2,140",
    ],
    [
      "LT-240314",
      "Paolo Reyes",
      "EDSA → Ortigas Center",
      "Luis Mendoza",
      "Arrived",
      "₱1,920",
    ],
    [
      "LT-240313",
      "Ana Cruz",
      "Commonwealth → Cubao",
      "Marco Lim",
      "Loading",
      "₱2,380",
    ],
    [
      "LT-240312",
      "Carlo Garcia",
      "BGC → Makati Ave",
      "Joel Santos",
      "Completed",
      "₱1,540",
    ],
  ]
  return (
    <div className="dashboard">
      <aside className="sidebar">
        <Logo />
        <div className="workspace">
          <span className="company-logo">{central ? "LT" : "VT"}</span>
          <span>
            <small>{central ? "PLATFORM ADMIN" : "PARTNER COMPANY"}</small>
            <strong>{central ? "LigtasTow Central" : "Viray Towing"}</strong>
          </span>
          <Icon name="chevron" />
        </div>
        <nav>
          {navItems.map(([icon, label]) => (
            <button
              className={active === label ? "active" : ""}
              onClick={() => setActive(label)}
              key={label}
            >
              <Icon name={icon} />
              <span>{central && label === "Operators" ? "Users" : label}</span>
              {label === "Bookings" && <b>7</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-help">
          <Icon name="chat" />
          <strong>Need help?</strong>
          <small>Contact LigtasTow support</small>
          <button>Open support</button>
        </div>
        <button className="admin-profile">
          <Avatar initials={central ? "MA" : "RC"} />
          <span>
            <strong>{central ? "Mia Aquino" : "Ramon Cruz"}</strong>
            <small>Administrator</small>
          </span>
          <Icon name="more" />
        </button>
      </aside>
      <main className="dash-main">
        <header className="dash-top">
          <button className="mobile-menu">
            <Icon name="menu" />
          </button>
          <div className="dash-search">
            <Icon name="search" />
            <input placeholder="Search bookings, drivers, customers…" />
          </div>
          <Badge tone="neutral">Demo data</Badge>
          <button className="icon-btn">
            <Icon name="bell" />
            <i />
          </button>
        </header>
        <div className="dash-content">
          <div className="dash-title">
            <div>
              <small>
                {central ? "PLATFORM OPERATIONS" : "MONDAY, 16 MARCH 2026"}
              </small>
              <h1>{active}</h1>
              <p>
                {central
                  ? "Monitor LigtasTow operations across Metro Manila."
                  : "Here’s what’s happening with your operations today."}
              </p>
            </div>
            <div>
              <Button variant="secondary" icon="document">
                Export report
              </Button>
              <Button icon="plus">
                {central ? "Review applications" : "New booking"}
              </Button>
            </div>
          </div>
          {active === "Overview" ? (
            <>
              <div className="metric-grid">
                {metrics.map(([label, value, delta, tone], i) => (
                  <div className="metric-card" key={label}>
                    <span className={`metric-icon ${tone}`}>
                      <Icon
                        name={
                          ["calendar", "users", "clock", "wallet"][
                            i
                          ] as IconName
                        }
                      />
                    </span>
                    <button>
                      <Icon name="more" />
                    </button>
                    <small>{label}</small>
                    <strong>{value}</strong>
                    <span className={tone === "green" ? "positive" : ""}>
                      {delta}
                    </span>
                    <em>vs. last week</em>
                  </div>
                ))}
              </div>
              <div className="dash-grid">
                <section className="panel chart-panel">
                  <div className="panel-head">
                    <div>
                      <strong>Booking volume</strong>
                      <small>Completed and cancelled jobs</small>
                    </div>
                    <button className="select-btn">
                      Last 7 days <Icon name="chevron" size={15} />
                    </button>
                  </div>
                  <div className="chart-summary">
                    <strong>186</strong>
                    <span className="positive">↗ 14.2%</span>
                    <small>Total bookings</small>
                  </div>
                  <MiniChart />
                </section>
                <section className="panel dispatch-panel">
                  <div className="panel-head">
                    <div>
                      <strong>Live dispatch</strong>
                      <small>12 active · 8 available</small>
                    </div>
                    <button className="text-btn">
                      Open map <Icon name="arrow" size={15} />
                    </button>
                  </div>
                  <MapCanvas tracking />
                  <div className="map-stats">
                    <span>
                      <i className="available" /> 8 Available
                    </span>
                    <span>
                      <i className="busy" /> 6 Busy
                    </span>
                    <span>
                      <i className="request" /> 2 Unassigned
                    </span>
                  </div>
                </section>
              </div>
              <section className="panel table-panel">
                <div className="panel-head">
                  <div>
                    <strong>Recent bookings</strong>
                    <small>Live updates from your service area</small>
                  </div>
                  <div>
                    <button className="select-btn">
                      <Icon name="filter" size={15} /> Filter
                    </button>
                    <button className="text-btn">
                      View all <Icon name="arrow" size={15} />
                    </button>
                  </div>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        {[
                          "Booking ID",
                          "Customer",
                          "Route",
                          "Operator",
                          "Status",
                          "Amount",
                          "",
                        ].map((h) => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.map((r, i) => (
                        <tr key={r[0]} onClick={() => setDrawer(true)}>
                          {r.map((c, j) => (
                            <td key={j}>
                              {j === 0 ? (
                                <strong>{c}</strong>
                              ) : j === 4 ? (
                                <Badge
                                  tone={
                                    c === "Completed"
                                      ? "success"
                                      : c === "Pending"
                                        ? "warning"
                                        : c === "En route"
                                          ? "info"
                                          : "brand"
                                  }
                                >
                                  {c}
                                </Badge>
                              ) : (
                                c
                              )}
                            </td>
                          ))}
                          <td>
                            <Icon name="more" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : (
            <EmptyDashboardSection title={active} central={central} />
          )}
        </div>
      </main>
      {drawer && (
        <div className="drawer-backdrop" onClick={() => setDrawer(false)}>
          <aside className="detail-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <div>
                <Badge tone="info">EN ROUTE</Badge>
                <h2>LT-240316</h2>
                <p>Created today at 9:42 AM</p>
              </div>
              <button className="icon-btn" onClick={() => setDrawer(false)}>
                <Icon name="close" />
              </button>
            </div>
            <div className="drawer-map">
              <MapCanvas tracking />
            </div>
            <div className="drawer-section">
              <small>CUSTOMER</small>
              <div className="selected-provider">
                <Avatar initials="JD" />
                <span>
                  <strong>Juan Dela Cruz</strong>
                  <small>2019 Toyota Vios · ABC 1234</small>
                </span>
                <Button variant="secondary" icon="phone">
                  Call
                </Button>
              </div>
            </div>
            <div className="drawer-section">
              <small>ASSIGNED OPERATOR</small>
              <div className="selected-provider">
                <Avatar initials="RG" tone="green" />
                <span>
                  <strong>Roberto Garcia</strong>
                  <small>Flatbed · TOW 001 · 4.9 rating</small>
                </span>
                <button className="text-btn">Reassign</button>
              </div>
            </div>
            <div className="drawer-section">
              <small>ROUTE</small>
              <div className="review-route">
                <Icon name="route" />
                <span>
                  <small>PICKUP</small>
                  <strong>Aurora Boulevard, Cubao</strong>
                  <small>DESTINATION · 7.8 KM</small>
                  <strong>Quezon Avenue, Quezon City</strong>
                </span>
              </div>
            </div>
            <div className="drawer-total">
              <span>
                <small>Estimated fare</small>
                <strong>₱1,685</strong>
              </span>
              <Badge tone="success">GCash · Authorized</Badge>
            </div>
            <Button icon="route">Monitor live booking</Button>
          </aside>
        </div>
      )}
    </div>
  )
}

function EmptyDashboardSection({
  title,
  central,
}: {
  title: string
  central: boolean
}) {
  return (
    <>
      <div className="filter-bar">
        <div className="dash-search">
          <Icon name="search" />
          <input placeholder={`Search ${title.toLowerCase()}…`} />
        </div>
        <button className="select-btn">
          <Icon name="filter" /> All statuses
        </button>
        <button className="select-btn">
          <Icon name="calendar" /> Mar 10 – Mar 16
        </button>
        <Button variant="secondary" icon="plus">
          Add new
        </Button>
      </div>
      <section className="panel module-preview">
        <div className="module-icon">
          <Icon
            name={
              title === "Fleet"
                ? "fleet"
                : title === "Analytics"
                  ? "chart"
                  : title === "Settings"
                    ? "settings"
                    : central
                      ? "shield"
                      : "document"
            }
            size={30}
          />
        </div>
        <div>
          <Badge tone="brand">INTERACTIVE MODULE</Badge>
          <h2>{title} management</h2>
          <p>
            This prototype view demonstrates the shared table, filter, status,
            and action patterns for {title.toLowerCase()}. All records shown are
            demonstration content.
          </p>
        </div>
        <div className="module-list">
          {[
            "Search, filters, and saved views",
            "Role-aware actions and confirmations",
            "Exportable records and audit history",
            "Loading, empty, and error states",
          ].map((x, i) => (
            <span key={x}>
              <i>
                <Icon name="check" size={14} />
              </i>
              {x}
              <Badge tone={i === 0 ? "success" : "neutral"}>
                {i === 0 ? "Ready" : "Included"}
              </Badge>
            </span>
          ))}
        </div>
      </section>
    </>
  )
}

function PublicSite({
  requestTow,
  dashboard,
}: {
  requestTow: () => void
  dashboard: () => void
}) {
  return (
    <div className="public-site">
      <header className="public-nav">
        <Logo />
        <nav>
          <button>Find a tow</button>
          <button>How it works</button>
          <button>Safety</button>
          <button>For companies</button>
        </nav>
        <div>
          <Button variant="ghost" onClick={dashboard}>
            Partner sign in
          </Button>
          <Button onClick={requestTow}>Request a tow</Button>
        </div>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <Badge tone="success">
              <Icon name="shield" size={14} /> VERIFIED METRO MANILA PARTNERS
            </Badge>
            <h1>
              Roadside trouble?
              <br />
              <em>We’ll get you moving.</em>
            </h1>
            <p>
              Book an accredited tow truck, see your fare before confirming, and
              track your operator all the way to you.
            </p>
            <div className="hero-search">
              <div>
                <Icon name="pin" />
                <span>
                  <small>YOUR PICKUP LOCATION</small>
                  <strong>Aurora Boulevard, Cubao</strong>
                </span>
              </div>
              <Button onClick={requestTow}>
                Find a tow truck <Icon name="arrow" />
              </Button>
            </div>
            <div className="trust-row">
              <span>
                <Icon name="shield" /> Verified companies
              </span>
              <span>
                <Icon name="wallet" /> Upfront estimates
              </span>
              <span>
                <Icon name="route" /> Live tracking
              </span>
            </div>
          </div>
          <div className="hero-visual">
            <div className="site-map">
              <MapCanvas tracking />
            </div>
            <div className="float-card driver-float">
              <Avatar initials="RG" tone="dark" />
              <span>
                <small>YOUR OPERATOR</small>
                <strong>Roberto is 8 min away</strong>
                <em>
                  <Icon name="star" size={12} filled /> 4.9 · TOW 001
                </em>
              </span>
            </div>
            <div className="float-card fare-float">
              <span>
                <Icon name="wallet" />
              </span>
              <div>
                <small>ESTIMATED TOTAL</small>
                <strong>₱1,685</strong>
                <em>Transparent pricing</em>
              </div>
            </div>
          </div>
        </section>
        <section className="site-stats">
          <span>
            <strong>48</strong>
            <small>verified partner companies</small>
          </span>
          <span>
            <strong>11.4 min</strong>
            <small>average response time</small>
          </span>
          <span>
            <strong>4.8 / 5</strong>
            <small>average customer rating</small>
          </span>
          <span>
            <strong>24 / 7</strong>
            <small>booking availability</small>
          </span>
        </section>
        <section className="how">
          <div className="section-kicker">SIMPLE, SAFE, TRACKABLE</div>
          <h2>Help is just a few steps away</h2>
          <p>
            Built to keep decisions clear when the roadside feels uncertain.
          </p>
          <div className="how-grid">
            {[
              [
                "pin",
                "Tell us where you are",
                "Share your pickup, destination, vehicle, and what happened.",
              ],
              [
                "truck",
                "Choose trusted help",
                "Compare accredited providers, ETAs, truck types, and fare estimates.",
              ],
              [
                "route",
                "Track every step",
                "See your assigned operator, live location, and service progress.",
              ],
              [
                "shield",
                "Arrive with confidence",
                "Verify your operator, pay securely, and keep a digital receipt.",
              ],
            ].map((x, i) => (
              <article key={x[1]}>
                <b>0{i + 1}</b>
                <span>
                  <Icon name={x[0] as IconName} />
                </span>
                <h3>{x[1]}</h3>
                <p>{x[2]}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

