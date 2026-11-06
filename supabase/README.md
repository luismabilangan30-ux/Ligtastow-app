# Supabase database and development runtime

November 4 update: the user applied the migration, and a read-only hosted connection check now succeeds with verified TLS. All 11 application tables have RLS enabled; signup profile creation, restricted anonymous/client writes and append-only runtime audit grants were verified. Verified Supabase sessions, persistent account UI and a transactional PostgreSQL adapter are implemented and tested locally. The database was empty at this check (no profiles, active providers, active memberships or bookings). Real sign-in and provider/staff provisioning are the next steps. See [runtime contract](../docs/CLOUD_API.md) and [setup guide](../docs/SUPABASE_SETUP.md).

On November 5, the hosted vehicle save was verified and a separate confirmed account was provisioned as the Viray operator. The motorist can select Viray Towing Services and the operator can read the Viray queue with Viray Test Truck 01. The application rejected the original motorist's attempt to use that workspace. The user saw the first assignment, and Supabase recorded creation and acceptance under the operator test account using its two workspaces. Testing dispatch between the two distinct accounts is still pending.

On November 6, a hosted check found two completed Viray bookings. Both had been created and accepted under the operator test account. Service completion passed. The signed-in header now shows the account email to help testers verify the two identities before repeating the dispatch check.

Target project: [pgfpftflyggnmqrveubk](https://supabase.com/dashboard/project/pgfpftflyggnmqrveubk). The user reported choosing Singapore (`ap-southeast-1`). The URL and reported region are recorded in `project.json`; dashboard access and the saved settings have not been verified.

## Implemented locally

`migrations/202610310001_dispatch_foundation.sql` creates the application tables, indexes, access policies and an Auth signup trigger. Supabase supplies the existing `auth.users` table, `auth.uid()` function and platform database roles.

| Area | Tables |
| --- | --- |
| Accounts | profiles, vehicles |
| Providers and staff | providers, provider_memberships, operators |
| Dispatch | bookings, booking_declines, booking_events, booking_ratings |
| Internal-only data | app_private.central_admins, app_private.booking_requests |

Profiles are created on signup and for existing Auth users. User-editable metadata supplies only a display name; it cannot assign staff permissions. Provider memberships and central access require trusted administrative provisioning. No live companies, staff memberships or admin accounts are seeded by the migration.

RLS limits reads to the relevant motorist, eligible/assigned operator, provider dispatcher or central administrator. Users can edit their own permitted profile fields and vehicles. Direct client booking, rating, assignment, audit and membership writes are denied, including from central-admin UI sessions: those commands go through the authenticated API. Helper functions use an empty search path, qualified identifiers and the verified `auth.uid()` context.

Unique indexes enforce one active booking per motorist and one active assignment per operator. Composite foreign keys keep operators and declines within the selected provider. Monetary columns store integer centavos with a generated total. Registration uniqueness ignores spacing/hyphens/case. Ratings require completed bookings. The server role has insert/read access to the audit and creation ledger, with no update/delete grants for those records.

## Run and test

```powershell
pnpm run test:db
pnpm test
pnpm run typecheck
pnpm run build
pnpm run api:demo
pnpm run db:check
pnpm run api:cloud
```

The database tests execute the migration using PGlite and a small test-only Supabase Auth contract. They test actual SQL permissions, constraints and queries, not string matching. They do not verify Supabase's hosted Auth service, dashboard options, connection pooling, TLS, or true concurrent network transactions.

`api:demo` starts an independent Node HTTP server on 127.0.0.1:8444, configurable through DISPATCH_PORT. It retains fixture identities and loopback-only checks, refuses NODE_ENV=production and uses `.local/standalone-dispatch-v1.json` to avoid competing writes with Vite's original demo store. `api:cloud` starts `/api/v2` with Supabase sessions/PostgreSQL on the same default port; run only one standalone entry point per port. Neither serves frontend assets. The browser app uses Vite's embedded APIs.

## Hosted migration and remaining implementation

The user reported applying this migration in SQL Editor. Do not rerun it blindly. It creates objects in a transaction and deliberately fails on conflicting existing tables/schemas; do not drop existing objects to make it run. It is a versioned migration, not a repeatedly executable setup script.

Verify existing tables/policies with the read-only connection check before proceeding. If CLI tooling will manage later migrations, reconcile migration history before pushing; manual SQL Editor execution does not populate the CLI migration ledger automatically.

Remaining work:

1. Public Project URL/publishable key are saved in `.env.local` and verified through a read-only Auth settings request (HTTP 200). Email confirmation is required. No private credentials belong in chat.
2. Complete real sign-in testing. Hosted connection/schema verification passed and the CA certificate is configured locally. The development runtime connects as the owner and uses `SET LOCAL ROLE service_role`; choose dedicated runtime login credentials before production.
3. Run true concurrent network acceptance tests against an explicitly isolated hosted test dataset. Adapter rollback/lifecycle/idempotency tests currently use PGlite.
4. Provision agreed development providers and staff memberships. The API resolves memberships server-side; no fixture header grants hosted access.
5. Verify confirmation/recovery redirects and profile/vehicle reloads across real test accounts. Configure SMTP for external testers.
6. Define retention/account deletion, backups/restore, migration rollout and API/frontend hosting. Existing dispatch references deliberately prevent deleting profiles with historical records until a retention policy is implemented.

Local QA: [November 4 report](../docs/QA-2026-11-04.md). Nothing was deployed, committed or pushed.
