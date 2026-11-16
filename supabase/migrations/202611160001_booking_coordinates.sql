-- Add coordinate columns to bookings so GPS-pinned pickup/destination
-- survive the server round-trip and appear on the tracking screen.
alter table public.bookings
  add column pickup_coords double precision[2] default null,
  add column destination_coords double precision[2] default null;

-- Validate that when present they are exactly 2-element arrays with
-- longitude in [-180,180] and latitude in [-90,90].
alter table public.bookings
  add constraint bookings_pickup_coords_check check (
    pickup_coords is null or (
      array_length(pickup_coords, 1) = 2
      and pickup_coords[1] between -180 and 180
      and pickup_coords[2] between -90 and 90
    )
  ),
  add constraint bookings_destination_coords_check check (
    destination_coords is null or (
      array_length(destination_coords, 1) = 2
      and destination_coords[1] between -180 and 180
      and destination_coords[2] between -90 and 90
    )
  );
