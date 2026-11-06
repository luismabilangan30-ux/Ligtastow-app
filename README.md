# LigtasTow development application

A React + TypeScript application with Supabase sign-in and a transactional PostgreSQL API for motorist, operator, company dispatch and central operations workspaces. A separate local fixture demo is retained. Development bookings can be submitted, assigned, progressed, completed, cancelled and rated. Maps and fares remain demonstrations; no real roadside service, payments, calls, messages or GPS sharing occur.

## Run locally

Supabase project `pgfpftflyggnmqrveubk` was supplied on October 31, 2026, with Singapore reported as the selected region. Follow [the setup guide](docs/SUPABASE_SETUP.md): `.env.example` documents browser settings, and `.env.server.example` documents the private database connection and CA certificate. The user reported applying the first migration. Latest hosted verification and remaining setup are recorded in `SESSION_HANDOFF.md` and [November 4 QA](docs/QA-2026-11-04.md).

Use Node 22.12+ or Node 24 and pnpm. The original toolchain declaration is in `.mise.toml`.

```powershell
pnpm install --frozen-lockfile
pnpm run db:check
pnpm run dev --host 127.0.0.1
```

Open http://127.0.0.1:8443/. If the port is occupied, stop the existing project server first or set `PORT` to a free port. On sandboxed Windows hosts, the preview process may need permission to run outside the sandbox so the browser can reach localhost.

The root URL opens sign-in. `/api/v2` verifies Supabase sessions and stores account/booking data in PostgreSQL. New accounts receive motorist access only; provider and staff records require explicit provisioning. No provider is seeded automatically. The API permits only loopback access. Production builds contain the UI only: `pnpm run preview` does not start either API. `pnpm run api:cloud` starts the separate authenticated API on 8444; `api:demo` starts the independent fixture API on that port. See [v2 API details](docs/CLOUD_API.md).

For the existing fixture demo, open `http://127.0.0.1:8443/?demo=1#/home` in development. Its `/api/v1` records remain in `.local/dispatch-v1.json`. Use the **Workspace** selector to try each sample role: submit as Motorist, switch to the matching operator to accept/progress, then return to Motorist to rate. Company/central workspaces can assign or cancel with a reason. This public fixture selector cannot grant account access, and its data is not imported into signed-in accounts.

```powershell
pnpm run typecheck
pnpm test
pnpm run build
```

The 37-test suite uses Node's built-in test runner and TypeScript stripping. PGlite executes the SQL migration, policy and transaction-adapter tests in an in-memory PostgreSQL engine. HTTP tests need localhost sockets, and storage tests need temporary-file replacement, so sandboxed Windows hosts may require permission to run tests outside the sandbox. PGlite does not verify hosted email, network transactions or live sign-in. The existing formatter can damage one-line TypeScript object types and `keyof` arrays; inspect its changes and always typecheck.

## Working flows

- Add, edit and delete vehicles with required-field, year and duplicate-registration validation. Add a vehicle during booking and return with it selected.
- Search services by name/description and providers by name/area; see an empty state when no result matches.
- Select a service, vehicle, incident, notes, pickup, towing destination and provider. Review the actual selections and the service/provider-specific sample fare before confirmation.
- Use browser Back/Forward or in-app Back to move through steps without losing the current draft. Closing a draft asks for confirmation.
- Submit through the API; receive and accept/decline offers in an authorized operator workspace. Only the assigned operator can progress and complete service. One active request per motorist and one active job per operator are enforced on the server.
- Company dispatch manages assignment/cancellation for its provider; Central admin oversees both. Filter/search bookings, view the demo roster and inspect activity logs.
- Cancel with a reason, review booking history, view a demo receipt, and save/update a service rating.
- Filter saved example addresses or enter a custom pickup address.
- View booking-derived notifications and mark them read.
- Sign in, create an account, confirm email, recover a password and sign out through Supabase. Signed-in profile/vehicle/preferences persist online; profile email is Auth-managed and read-only. The demo retains optional unverified email and session-only profile edits.
- Toggle in-app booking updates with a keyboard-accessible switch. Turning updates off hides the notification feed while keeping requests available in History.

## Storage and limits

Signed-in profiles, vehicles, in-app notification preferences, bookings and events are stored in PostgreSQL. The API verifies the account and memberships on every request. Saved vehicle deletion retains vehicle snapshots in past bookings. Account deletion/retention is not implemented yet. No sample local records are copied into an account.

In fixture demo mode, vehicles use `localStorage` under `ligtastow.vehicles.v1`. Malformed records are handled safely, and failed writes show a warning. Delete records through My vehicles to remove them from this browser.

Submitted bookings, vehicle/address snapshots, notes, ratings, assignment and activity logs persist in `.local/dispatch-v1.json`, shared by the demo workspaces on this computer. `.local/` is excluded from Git; because this checkout is inside OneDrive, external folder sync may copy it. Use sample data only. Stop the server and archive this exact file if you want a fresh demonstration. The file adapter supports one development process and is not a production database.

Unsubmitted drafts, pickup defaults and notification-read state remain in memory and reset on reload/close or workspace changes. Only the fixture demo also resets profile/preferences. Public fixture identities are not credentials. Push delivery, payment configuration, staff provisioning, production hosting, backup/retention and real-device tests remain.

Fare amounts are sample arithmetic, not route-based quotes. Provider availability, accreditation and vehicle compatibility are not verified. The app requests no device permissions. Android support remains the existing PWA; this work does not create an APK or AAB. Real-device installation, cutouts and offline cold starts require separate testing.

## Code map

| File | Responsibility |
| --- | --- |
| `src/App.tsx` | Workspace selection and shared API connection |
| `src/auth/CloudApp.tsx` / `AuthForm.tsx` / `client.ts` | Verified-account UI, Supabase session lifecycle and cloud requests |
| `server/postgresDispatch.ts` / `database.ts` | Transactional account/dispatch adapter, pool and TLS configuration |
| `server/cloudHttp.ts` / `cloudRuntime.ts` | Bearer-token verification, membership resolution and authenticated HTTP routes |
| `tests/cloud.test.ts` | SQL-backed cloud account/lifecycle/rollback and HTTP security checks |
| `src/components/ui.tsx` | Existing shared visual primitives |
| `src/motorist/MotoristApp.tsx` | State, storage, notifications and screen composition |
| `src/motorist/model.ts` | Domain types, sample catalog, validation and booking snapshots |
| `src/motorist/navigation.ts` | Hash routes and browser history |
| `src/motorist/Home.tsx` | Original map-led home layout |
| `src/motorist/BookingFlow.tsx` | Five-step request form |
| `src/motorist/Vehicles.tsx` | Vehicle manager and editor |
| `src/motorist/Browse.tsx` | Search, pickup location and settings explanations |
| `src/motorist/Profile.tsx` | Profile display/editor and in-app notification preference |
| `src/motorist/profileModel.ts` | Profile validation, normalization and initials |
| `src/motorist/BookingStatus.tsx` | API-driven tracking, history, cancellation, receipts and ratings |
| `src/motorist/components.tsx` | Shared motorist page, map, fare and confirmation components |
| `src/motorist/motorist.css` | Scoped motorist styles and responsive overrides |
| `src/legacy/PrototypeSurfaces.tsx` | Original inactive operator/admin/public component bodies, retained without redesign |
| `tests/motorist.test.ts` | Domain validation, snapshots, search and route tests |
| `tests/profile.test.ts` | Profile validation and normalization tests |
| `src/operations/Operations.tsx` | Operator, company and central dispatch interfaces |
| `src/shared/dispatch.ts` | Shared booking/command contracts, stages and demo identities |
| `src/shared/useDispatch.ts` | API requests, polling, retries and mutation state |
| `server/dispatchService.ts` | Role rules, lifecycle, version conflicts, idempotency and file persistence |
| `server/http.ts` / `server/vitePlugin.ts` | Development HTTP adapter and Vite integration |
| `tests/dispatch.test.ts` | Authorization, lifecycle, concurrency, persistence and HTTP integration tests |

The shared bottom navigation has optional no-op callbacks only for compatibility with the archived prototype. Every rendered motorist navigation passes real handlers. The original inactive surfaces remain in `src/legacy`; the new operations interfaces use the shared API. The public site is not mounted.

See `SESSION_HANDOFF.md` for continuation context, `docs/CLOUD_API.md` for v2, `docs/DISPATCH_API.md` for the retained v1 contract, and `docs/QA-2026-11-04.md` for the latest checks. Earlier QA documents remain as historical records.
