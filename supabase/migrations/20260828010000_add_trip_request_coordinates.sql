-- Google Places autocomplete resolves an address straight to lat/lng at
-- selection time, so we store both alongside the text instead of only the
-- text — the map and any future distance-based filtering need real
-- coordinates, and re-geocoding stored text later would be a second API
-- call for something we already had for free.
--
-- Nullable: a request can still be submitted with free-typed text that was
-- never selected from a suggestion (autocomplete API unavailable, or the
-- user just typed and hit submit), same as starting_point/destination today.

alter table public.trip_requests
  add column starting_point_lat double precision,
  add column starting_point_lng double precision,
  add column destination_lat double precision,
  add column destination_lng double precision;
