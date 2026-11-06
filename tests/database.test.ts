import assert from "node:assert/strict"
import { before, after, test } from "node:test"
import { readFile } from "node:fs/promises"
import { PGlite } from "@electric-sql/pglite"

// Real PostgreSQL semantics in memory. Supabase Auth/JWT delivery and hosted
// configuration are NOT emulated; only the auth.uid contract is supplied here.
const db = new PGlite()
const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const pgError = (code: string) => (error: unknown) => (error as { code?: string }).code === code
const migration = new URL("../supabase/migrations/202610310001_dispatch_foundation.sql", import.meta.url)

before(async () => {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    grant usage on schema auth to authenticated;
  `)
  await db.exec(await readFile(migration, "utf8"))
  for (let n = 1; n <= 10; n++) {
    await db.query("insert into auth.users(id, raw_user_meta_data) values ($1, $2)",
      [uid(n), JSON.stringify({ display_name: `Sample ${n}`, role: "central", provider_id: "viray" })])
  }
  await db.exec(`
    insert into public.providers(id, name, area, active) values
      ('viray', 'Viray sample', 'Cubao', true), ('motor-trust', 'Motor Trust sample', 'Ortigas', true);
    insert into public.provider_memberships(id, user_id, provider_id, role, active) values
      ('${uid(201)}', '${uid(3)}', 'viray', 'operator', true),
      ('${uid(202)}', '${uid(4)}', 'viray', 'operator', true),
      ('${uid(203)}', '${uid(5)}', 'motor-trust', 'operator', true),
      ('${uid(206)}', '${uid(6)}', 'viray', 'company', true),
      ('${uid(207)}', '${uid(7)}', 'motor-trust', 'company', true),
      ('${uid(209)}', '${uid(9)}', 'viray', 'company', false);
    insert into public.operators(id, membership_id, provider_id, display_name, truck_label, active) values
      ('${uid(101)}', '${uid(201)}', 'viray', 'Operator A', 'VT001', true),
      ('${uid(102)}', '${uid(202)}', 'viray', 'Operator B', 'VT002', true),
      ('${uid(103)}', '${uid(203)}', 'motor-trust', 'Operator C', 'MT001', true);
    insert into app_private.central_admins(user_id) values ('${uid(8)}');
    insert into public.bookings(id, motorist_id, provider_id, provider_name_snapshot,
      service, vehicle_snapshot, incident, pickup, destination,
      base_centavos, travel_centavos, provider_centavos, platform_centavos) values
      ('${uid(301)}', '${uid(1)}', 'viray', 'Viray sample', 'Jump Start', '{"plate":"ABC 1234"}',
       'Battery problem', 'Test pickup Cubao', 'Assistance at pickup', 65000, 0, 0, 9500),
      ('${uid(302)}', '${uid(2)}', 'motor-trust', 'Motor Trust sample', 'Jump Start', '{"plate":"XYZ 1234"}',
       'Battery problem', 'Test pickup Ortigas', 'Assistance at pickup', 65000, 0, 10000, 9500);
    insert into public.booking_events(booking_id, booking_version, actor_user_id, actor_name_snapshot, action, detail)
      values ('${uid(301)}', 1, '${uid(1)}', 'Sample 1', 'created', 'Sample request created');
  `)
})
after(async () => { await db.close() })

async function asRole<T>(role: "anon" | "authenticated" | "service_role", user: number, run: () => Promise<T>) {
  await db.exec("begin")
  try {
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [uid(user)])
    await db.exec(`set local role ${role}`)
    return await run()
  } finally {
    await db.exec("rollback")
  }
}
const visible = (user: number) => asRole("authenticated", user, async () =>
  (await db.query<{ id: string }>("select id from public.bookings order by id")).rows.map(b => b.id))

test("database bootstrap ignores role metadata and exposes only the caller's profile", async () => {
  assert.equal((await db.query("select * from public.profiles")).rows.length, 10)
  assert.equal((await db.query("select * from app_private.central_admins")).rows.length, 1)
  await asRole("authenticated", 1, async () => {
    assert.equal((await db.query("select * from public.profiles")).rows.length, 1)
    await db.query("update public.profiles set display_name = 'Changed' where id = $1", [uid(1)])
    assert.equal((await db.query<{ display_name: string }>("select display_name from public.profiles")).rows[0].display_name, "Changed")
    assert.equal((await db.query("update public.profiles set display_name = 'Other' where id = $1 returning id", [uid(2)])).rows.length, 0)
  })
  await assert.rejects(asRole("authenticated", 1, () => db.query(
    "insert into app_private.central_admins(user_id) values ($1)", [uid(1)])), pgError("42501"))
  await assert.rejects(asRole("authenticated", 1, () => db.query(
    "insert into public.provider_memberships(user_id, provider_id, role) values ($1, 'viray', 'company')", [uid(1)])), pgError("42501"))
})

test("database policies isolate motorists, providers, inactive staff and anonymous callers", async () => {
  assert.deepEqual(await visible(1), [uid(301)])
  assert.deepEqual(await visible(2), [uid(302)])
  assert.deepEqual(await visible(3), [uid(301)])
  assert.deepEqual(await visible(6), [uid(301)])
  assert.deepEqual(await visible(7), [uid(302)])
  assert.deepEqual(await visible(8), [uid(301), uid(302)])
  assert.deepEqual(await visible(9), [])
  assert.deepEqual(await visible(10), [])
  await assert.rejects(asRole("anon", 1, () => db.query("select * from public.bookings")), pgError("42501"))
  await asRole("authenticated", 7, async () => {
    assert.equal((await db.query("select * from public.booking_events")).rows.length, 0)
    assert.equal((await db.query("select * from public.operators")).rows.length, 1)
  })
})

test("database visibility follows declines and assignment without leaking another operator's job", async () => {
  await db.query("insert into public.booking_declines(booking_id, operator_id, provider_id) values ($1, $2, 'viray')", [uid(301), uid(101)])
  try {
    assert.deepEqual(await visible(3), [])
    assert.deepEqual(await visible(4), [uid(301)])
    assert.deepEqual(await visible(6), [uid(301)])
    await db.query("update public.bookings set operator_id = $1, stage = 1, status = 'assigned' where id = $2", [uid(102), uid(301)])
    assert.deepEqual(await visible(3), [])
    assert.deepEqual(await visible(4), [uid(301)])
    await asRole("authenticated", 1, async () => {
      const rows = (await db.query<{ id: string }>("select id from public.operators")).rows
      assert.deepEqual(rows.map(o => o.id), [uid(102)])
    })
  } finally {
    await db.query("update public.bookings set operator_id = null, stage = 0, status = 'searching' where id = $1", [uid(301)])
    await db.query("delete from public.booking_declines where booking_id = $1", [uid(301)])
  }
})

test("database grants block direct booking writes, role changes and audit tampering", async () => {
  for (const user of [1, 3, 6, 8]) {
    await assert.rejects(asRole("authenticated", user, () => db.query("update public.bookings set status = 'completed', stage = 5")), pgError("42501"))
  }
  await assert.rejects(asRole("authenticated", 6, () => db.query("update public.provider_memberships set role = 'company'")), pgError("42501"))
  await assert.rejects(asRole("service_role", 8, () => db.query("delete from public.booking_events")), pgError("42501"))
  await assert.rejects(asRole("authenticated", 8, () => db.query("select * from app_private.booking_requests")), pgError("42501"))
})

test("database vehicle ownership and normalized registration uniqueness are enforced", async () => {
  const insert = "insert into public.vehicles(owner_id, make, model, year, type, color, plate) values ($1, 'Toyota', 'Vios', 2019, 'Sedan', 'Black', $2)"
  await asRole("authenticated", 1, async () => {
    await db.query(insert, [uid(1), "ABC 1234"])
    assert.equal((await db.query("select * from public.vehicles")).rows.length, 1)
    await assert.rejects(db.query(insert, [uid(1), "abc-1234"]), pgError("23505"))
  })
  await assert.rejects(asRole("authenticated", 1, () => db.query(insert, [uid(2), "XYZ 1234"])), pgError("42501"))
})

test("database constraints reject duplicate active jobs, cross-provider assignment and invalid rating", async () => {
  const copy = `insert into public.bookings(motorist_id, provider_id, provider_name_snapshot, service, vehicle_snapshot,
    incident, pickup, destination, base_centavos, travel_centavos, provider_centavos, platform_centavos)
    select motorist_id, provider_id, provider_name_snapshot, service, vehicle_snapshot, incident, pickup, destination,
      base_centavos, travel_centavos, provider_centavos, platform_centavos from public.bookings where id = '${uid(301)}'`
  await assert.rejects(asRole("service_role", 8, () => db.exec(copy)), pgError("23505"))
  await assert.rejects(asRole("service_role", 8, () => db.query(
    "update public.bookings set operator_id = $1, status = 'assigned', stage = 1 where id = $2", [uid(103), uid(301)])), pgError("23503"))
  await asRole("service_role", 8, async () => {
    await db.query("update public.bookings set operator_id = $1, status = 'assigned', stage = 1 where id = $2", [uid(101), uid(301)])
    await assert.rejects(db.query(`update public.bookings set provider_id = 'viray', operator_id = $1,
      status = 'assigned', stage = 1 where id = $2`, [uid(101), uid(302)]), pgError("23505"))
  })
  await assert.rejects(asRole("service_role", 8, () => db.query(
    "insert into public.booking_ratings(booking_id, motorist_id, rating) values ($1, $2, 5)", [uid(301), uid(1)])), pgError("23514"))
  await asRole("service_role", 8, async () => {
    await db.query("update public.bookings set operator_id = $1, status = 'completed', stage = 5 where id = $2", [uid(101), uid(301)])
    await db.query("insert into public.booking_ratings(booking_id, motorist_id, rating) values ($1, $2, 5)", [uid(301), uid(1)])
    const total = (await db.query<{ total_centavos: number }>("select total_centavos from public.bookings where id = $1", [uid(301)])).rows[0].total_centavos
    assert.equal(Number(total), 74500)
    await assert.rejects(db.query("update public.booking_ratings set rating = 6"), pgError("23514"))
  })
})
