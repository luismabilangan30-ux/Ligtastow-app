# LigtasTow — Roadside Assistance PWA

A progressive web app connecting Filipino motorists with verified towing and roadside-assistance providers. Built with React, TypeScript, Supabase and PostgreSQL.

**Live app:** [ligtastow-app.vercel.app](https://ligtastow-app.vercel.app)

## Features

### Motorist
- Request tow truck, jump start, flat tire or fuel refill services
- Interactive Mapbox GL map with GPS-based pickup location
- Real-time operator tracking with live ETA
- Distance-based fare estimation with route calculation
- Vehicle management with validation
- Booking history, receipts and service ratings
- In-app notifications for booking updates

### Operator
- Accept/decline incoming service requests
- GPS location broadcasting to motorists
- Step-by-step job progress (en route → arrived → inspection → complete)
- ETA display to pickup location
- Completed job history

### Company Dispatch
- Assign operators to incoming requests
- Monitor all active and completed bookings
- Cancel bookings with documented reasons
- Activity log and operator roster

### Central Admin
- Cross-provider booking oversight
- System-wide metrics dashboard
- Assignment and cancellation authority

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite 8 |
| Maps | Mapbox GL JS (code-split, lazy-loaded) |
| Auth | Supabase Auth (PKCE flow, email/password) |
| Database | PostgreSQL via Supabase (row-level security) |
| Real-time | Supabase Realtime (broadcast channels) |
| Hosting | Vercel (static + serverless functions) |
| PWA | Service worker, offline fallback, installable |

## Run Locally

Requires Node 22+ and pnpm.

```bash
pnpm install --frozen-lockfile
```

Create `.env.local` from `.env.example` and fill in your keys:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
VITE_MAPBOX_TOKEN=pk.your_mapbox_token
```

```bash
pnpm run dev --host 127.0.0.1
```

Open http://127.0.0.1:8443/

## Build & Deploy

```bash
pnpm run typecheck   # Type checking
pnpm test            # Run test suite
pnpm run build       # Production build (frontend + API bundle)
```

Vercel auto-deploys from the `main` branch. Environment variables required on Vercel:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_MAPBOX_TOKEN`
- `DATABASE_URL` (server-side only)
- `DATABASE_CA` (server-side only)

## Architecture

```
src/
├── auth/           # Supabase sign-in, session management
├── components/     # Shared UI, MapboxMap, map utilities
├── motorist/       # Motorist app (home, booking, vehicles, profile)
├── operator/       # Operator app (jobs, requests, tracking)
├── operations/     # Company dispatch and central admin
├── shared/         # Dispatch contracts, tracking, fare calculator
├── pwa/            # PWA install/update prompts
└── App.tsx         # Entry point and workspace router

server/
├── cloudHttp.ts    # Authenticated API routes
├── postgresDispatch.ts  # PostgreSQL booking adapter
└── vercel/handler.ts    # Vercel serverless entry

api/v2/index.mjs    # Pre-bundled serverless function
```

## Database

The PostgreSQL schema (`supabase/migrations/`) includes:
- `profiles` — user profiles with phone validation
- `providers` — towing companies with service areas
- `provider_memberships` — operator/company role assignments
- `operators` — individual operators with truck assignments
- `vehicles` — motorist vehicles with plate validation
- `bookings` — service requests with fare breakdown and stage tracking
- `booking_events` — complete audit trail
- `booking_ratings` — motorist service ratings

Row-level security ensures motorists see only their data, operators see their provider's bookings, and company dispatchers manage their team.

## License

Capstone project — Luis Mabilangan, 2026.
