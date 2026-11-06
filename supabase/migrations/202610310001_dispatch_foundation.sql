-- Supabase supplies auth.users, auth.uid(), anon, authenticated and service_role.
-- Apply once through migration tooling to the empty development project.
begin;

create schema app_private;
revoke all on schema app_private from public, anon, authenticated;
grant usage on schema app_private to authenticated, service_role;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  phone text check (phone is null or phone ~ '^\+639[0-9]{9}$'),
  booking_updates boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.providers (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  area text not null check (char_length(btrim(area)) between 1 and 180),
  active boolean not null default false,
  created_at timestamptz not null default now()
);

-- Application roles are provisioned by trusted server/admin workflows only.
-- Auth user metadata must never grant a role or provider membership.
create table public.provider_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  provider_id text not null references public.providers(id),
  role text not null check (role in ('operator', 'company')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, provider_id),
  unique (id, provider_id, role)
);

create table app_private.central_admins (
  user_id uuid primary key references public.profiles(id),
  active boolean not null default true
);

create table public.operators (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null unique,
  provider_id text not null references public.providers(id),
  membership_role text not null default 'operator' check (membership_role = 'operator'),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  truck_label text not null check (char_length(btrim(truck_label)) between 1 and 80),
  active boolean not null default false,
  unique (id, provider_id),
  foreign key (membership_id, provider_id, membership_role)
    references public.provider_memberships(id, provider_id, role)
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  make text not null check (char_length(btrim(make)) between 1 and 60),
  model text not null check (char_length(btrim(model)) between 1 and 60),
  year integer not null check (year between 1950 and 2100),
  type text not null check (type in ('Sedan', 'SUV', 'Pickup', 'Motorcycle', 'Van')),
  color text not null check (char_length(btrim(color)) between 1 and 40),
  plate text not null check (plate ~ '^[A-Za-z0-9 -]{3,12}$'),
  normalized_plate text generated always as (upper(regexp_replace(plate, '[^A-Za-z0-9]', '', 'g'))) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(normalized_plate) between 3 and 12),
  unique (owner_id, normalized_plate)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  motorist_id uuid not null references public.profiles(id),
  provider_id text not null references public.providers(id),
  provider_name_snapshot text not null check (char_length(btrim(provider_name_snapshot)) between 1 and 120),
  operator_id uuid,
  service text not null check (service in ('Tow Truck', 'Jump Start', 'Flat Tire', 'Fuel Refill', 'Emergency Tow')),
  vehicle_snapshot jsonb not null check (jsonb_typeof(vehicle_snapshot) = 'object'),
  incident text not null check (incident in ('Engine failure', 'Accident', 'Flat tire', 'Battery problem', 'Overheating', 'Other')),
  notes text not null default '' check (char_length(notes) <= 500),
  pickup text not null check (char_length(btrim(pickup)) between 3 and 180),
  destination text not null check (char_length(btrim(destination)) between 3 and 180),
  currency text not null default 'PHP' check (currency = 'PHP'),
  base_centavos bigint not null check (base_centavos between 0 and 1000000000),
  travel_centavos bigint not null check (travel_centavos between 0 and 1000000000),
  provider_centavos bigint not null check (provider_centavos between 0 and 1000000000),
  platform_centavos bigint not null check (platform_centavos between 0 and 1000000000),
  total_centavos bigint generated always as (base_centavos + travel_centavos + provider_centavos + platform_centavos) stored,
  status text not null default 'searching' check (status in ('searching', 'assigned', 'completed', 'cancelled')),
  stage smallint not null default 0 check (stage between 0 and 5),
  version integer not null default 1 check (version > 0),
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, provider_id),
  unique (id, motorist_id),
  foreign key (operator_id, provider_id) references public.operators(id, provider_id),
  check ((stage = 0 and operator_id is null) or (stage between 1 and 5 and operator_id is not null)),
  check ((status = 'searching' and stage = 0) or (status = 'assigned' and stage >= 1) or
         (status = 'completed' and stage = 5) or status = 'cancelled'),
  check ((status = 'cancelled' and cancellation_reason is not null and char_length(btrim(cancellation_reason)) between 1 and 300)
         or (status <> 'cancelled' and cancellation_reason is null)),
  check (incident <> 'Other' or char_length(btrim(notes)) > 0)
);

-- These indexes enforce uniqueness even when independent API processes race.
create unique index one_active_booking_per_motorist on public.bookings(motorist_id)
  where status in ('searching', 'assigned');
create unique index one_active_booking_per_operator on public.bookings(operator_id)
  where status = 'assigned';
create index bookings_provider_created on public.bookings(provider_id, created_at desc);
create index bookings_motorist_created on public.bookings(motorist_id, created_at desc);

create table public.booking_declines (
  booking_id uuid not null,
  operator_id uuid not null,
  provider_id text not null,
  created_at timestamptz not null default now(),
  primary key (booking_id, operator_id),
  foreign key (booking_id, provider_id) references public.bookings(id, provider_id),
  foreign key (operator_id, provider_id) references public.operators(id, provider_id)
);

create table public.booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  booking_version integer not null check (booking_version > 0),
  actor_user_id uuid not null references public.profiles(id),
  actor_name_snapshot text not null,
  action text not null check (action in ('created', 'accept', 'decline', 'assign', 'advance', 'cancel', 'rate')),
  detail text not null check (char_length(detail) between 1 and 1000),
  created_at timestamptz not null default now(),
  unique (booking_id, booking_version)
);

create table public.booking_ratings (
  booking_id uuid primary key,
  motorist_id uuid not null,
  rating smallint not null check (rating between 1 and 5),
  updated_at timestamptz not null default now(),
  foreign key (booking_id, motorist_id) references public.bookings(id, motorist_id)
);

create table app_private.booking_requests (
  motorist_id uuid not null references public.profiles(id),
  request_id text not null check (request_id ~ '^[A-Za-z0-9-]{8,100}$'),
  booking_id uuid not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  primary key (motorist_id, request_id),
  foreign key (booking_id, motorist_id) references public.bookings(id, motorist_id)
);

create function app_private.is_central_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from app_private.central_admins where user_id = auth.uid() and active);
$$;

create function app_private.has_provider_role(target_provider text, allowed_roles text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.provider_memberships
    where user_id = auth.uid() and provider_id = target_provider and role = any(allowed_roles) and active);
$$;

create function app_private.owns_operator(target_operator uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.operators o join public.provider_memberships m on m.id = o.membership_id
    where o.id = target_operator and m.user_id = auth.uid() and m.active and o.active);
$$;

-- Fixed search_path and explicit names protect these read-only definer helpers.
-- They use auth.uid(), never a caller-supplied user ID or role metadata.
create function app_private.can_read_booking(target_booking uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.bookings b where b.id = target_booking and (
    b.motorist_id = auth.uid() or app_private.is_central_admin() or
    app_private.has_provider_role(b.provider_id, array['company']) or
    app_private.owns_operator(b.operator_id) or
    (b.status = 'searching' and exists (
      select 1 from public.operators o join public.provider_memberships m on m.id = o.membership_id
      where o.provider_id = b.provider_id and o.active and m.active and m.user_id = auth.uid()
        and not exists (select 1 from public.booking_declines d where d.booking_id = b.id and d.operator_id = o.id)
    ))
  ));
$$;

create function app_private.create_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, coalesce(nullif(btrim(left(new.raw_user_meta_data ->> 'display_name', 80)), ''), 'Motorist'));
  return new;
end;
$$;
create trigger ligtastow_profile_created after insert on auth.users
  for each row execute function app_private.create_profile();
insert into public.profiles(id, display_name)
  select id, coalesce(nullif(btrim(left(raw_user_meta_data ->> 'display_name', 80)), ''), 'Motorist') from auth.users;

create function app_private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;
create trigger profiles_updated before update on public.profiles for each row execute function app_private.touch_updated_at();
create trigger vehicles_updated before update on public.vehicles for each row execute function app_private.touch_updated_at();

create function app_private.validate_rating() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.bookings where id = new.booking_id and status = 'completed') then
    raise exception 'Ratings require a completed booking' using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger rating_completed_only before insert or update on public.booking_ratings
  for each row execute function app_private.validate_rating();

alter table public.profiles enable row level security;
alter table public.providers enable row level security;
alter table public.provider_memberships enable row level security;
alter table public.operators enable row level security;
alter table public.vehicles enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_declines enable row level security;
alter table public.booking_events enable row level security;
alter table public.booking_ratings enable row level security;
alter table app_private.central_admins enable row level security;
alter table app_private.booking_requests enable row level security;

-- Explicit grants remain required even if the dashboard auto-exposure toggle is on.
revoke all on public.profiles, public.providers, public.provider_memberships,
  public.operators, public.vehicles, public.bookings, public.booking_declines,
  public.booking_events, public.booking_ratings from public, anon, authenticated, service_role;
revoke all on app_private.central_admins, app_private.booking_requests from public, anon, authenticated, service_role;
revoke all on all functions in schema app_private from public, anon, authenticated;
grant execute on function app_private.is_central_admin(), app_private.has_provider_role(text, text[]),
  app_private.owns_operator(uuid), app_private.can_read_booking(uuid) to authenticated;

grant select on public.profiles, public.providers, public.provider_memberships, public.operators,
  public.vehicles, public.bookings, public.booking_declines, public.booking_events, public.booking_ratings to authenticated;
grant update (display_name, phone, booking_updates) on public.profiles to authenticated;
grant insert (owner_id, make, model, year, type, color, plate) on public.vehicles to authenticated;
grant update (make, model, year, type, color, plate) on public.vehicles to authenticated;
grant delete on public.vehicles to authenticated;

-- Booking and membership changes must pass through the trusted command API.
-- Admin UI accounts use authenticated, not service_role, and cannot bypass this.
grant select, insert, update, delete on public.profiles, public.providers,
  public.provider_memberships, public.operators, public.vehicles, public.bookings,
  public.booking_declines, public.booking_ratings, app_private.central_admins to service_role;
grant select, insert on public.booking_events, app_private.booking_requests to service_role;

create policy own_profile_read on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy own_profile_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy available_providers on public.providers for select to authenticated
  using (active or app_private.is_central_admin() or app_private.has_provider_role(id, array['operator', 'company']));
create policy membership_visibility on public.provider_memberships for select to authenticated
  using (user_id = (select auth.uid()) or app_private.is_central_admin() or app_private.has_provider_role(provider_id, array['company']));
create policy operator_visibility on public.operators for select to authenticated
  using (app_private.is_central_admin() or app_private.has_provider_role(provider_id, array['operator', 'company'])
    or exists (select 1 from public.bookings b where b.operator_id = operators.id and b.motorist_id = (select auth.uid())));
create policy own_vehicles on public.vehicles for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy booking_visibility on public.bookings for select to authenticated using (app_private.can_read_booking(id));
create policy decline_visibility on public.booking_declines for select to authenticated using (app_private.can_read_booking(booking_id));
create policy event_visibility on public.booking_events for select to authenticated using (app_private.can_read_booking(booking_id));
create policy rating_visibility on public.booking_ratings for select to authenticated using (app_private.can_read_booking(booking_id));

commit;
