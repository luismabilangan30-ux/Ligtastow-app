import { databaseConfig, localEnvironment, postgresDatabase } from "./database.ts"

let database: ReturnType<typeof postgresDatabase> | undefined
try {
  const env = localEnvironment(process.cwd())
  try { databaseConfig(env) }
  catch {
    console.error("Configuration invalid. Recopy the complete Session pooler URI (port 5432) into .env.server.local and URL-encode its password. Check DATABASE_CA_FILE if set.")
    process.exitCode = 1
  }
  if (!process.exitCode) {
    database = postgresDatabase(env)
    const result = await database.transaction(async client => {
      const { rows: [row] } = await client.query(`select
        to_regclass('public.profiles') is not null as profiles,
        to_regclass('public.bookings') is not null as bookings,
        to_regclass('app_private.booking_requests') is not null as request_ledger,
        current_user = 'service_role' as runtime_role,
        not has_table_privilege('anon','public.profiles','SELECT') as anonymous_profiles_blocked,
        not has_table_privilege('authenticated','public.bookings','INSERT,UPDATE,DELETE') as direct_booking_writes_blocked,
        not has_table_privilege('authenticated','public.provider_memberships','INSERT,UPDATE,DELETE') as direct_role_writes_blocked,
        not has_table_privilege('service_role','public.booking_events','UPDATE,DELETE') as audit_mutation_blocked,
        exists (select 1 from pg_trigger where tgname='ligtastow_profile_created' and not tgisinternal) as signup_profile_trigger`)
      const { rows } = await client.query(`select relname, relrowsecurity from pg_class
        where oid in (to_regclass('public.profiles'),to_regclass('public.vehicles'),to_regclass('public.bookings'),
          to_regclass('public.providers'),to_regclass('public.provider_memberships'),to_regclass('public.operators'),
          to_regclass('public.booking_declines'),to_regclass('public.booking_events'),to_regclass('public.booking_ratings'),
          to_regclass('app_private.central_admins'),to_regclass('app_private.booking_requests'))`)
      const { rows: [counts] } = await client.query(`select (select count(*)::int from public.profiles) as profiles,
        (select count(*)::int from public.vehicles) as vehicles,
        (select count(*)::int from public.providers where active) as active_providers,
        (select count(*)::int from public.provider_memberships where active) as active_memberships,
        (select count(*)::int from public.bookings) as bookings`)
      const { rows: [authAccess] } = await client.query("select has_table_privilege(current_user,'auth.users','SELECT') as allowed")
      if (authAccess.allowed) {
        const { rows: [authCounts] } = await client.query(`select
          count(*) filter (where email_confirmed_at is not null)::int as confirmed_accounts,
          count(*) filter (where last_sign_in_at is not null)::int as accounts_with_sign_in
          from auth.users`)
        Object.assign(counts, authCounts)
      }
      return { checks: { ...row, all_application_tables_have_rls: rows.length === 11 && rows.every(item => item.relrowsecurity) }, counts }
    })
    console.log(JSON.stringify({ connected: true, tlsVerified: true, schema: result.checks, counts: result.counts }))
    if (!Object.values(result.checks).every(Boolean)) process.exitCode = 1
  }
} catch (error) {
  const code = (error as { code?: string }).code ?? "UNKNOWN"
  const hints: Record<string, string> = {
    "28P01": "Database password was rejected. Verify it locally; do not share it in chat.",
    ENOTFOUND: "Database hostname could not be resolved. Verify the URI and network access.",
    ETIMEDOUT: "Connection timed out. Check network access and whether the Supabase project is active.",
    SELF_SIGNED_CERT_IN_CHAIN: "Save the Supabase database CA certificate and set DATABASE_CA_FILE to its path.",
    UNABLE_TO_VERIFY_LEAF_SIGNATURE: "Save the Supabase database CA certificate and set DATABASE_CA_FILE to its path.",
    "42501": "The database login cannot assume the required runtime role or read the schema.",
  }
  console.error(JSON.stringify({ connected: false, code: /^[A-Z0-9_]{1,50}$/.test(code) ? code : "UNKNOWN", hint: hints[code] ?? "Connection or schema check failed. Check the dashboard and local server configuration." }))
  process.exitCode = 1
} finally { await database?.close() }
