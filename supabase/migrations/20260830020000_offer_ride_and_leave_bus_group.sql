-- offer_ride: lets a driver offer a ride directly from someone's open
-- car-mode request without first posting a throwaway request of their
-- own (previously the only way to become "request_a" for create_match).
-- Creates a minimal car-mode trip_request on the caller's behalf — open,
-- then immediately matched — using only what's actually needed to drive
-- someone somewhere: where the driver is starting from and roughly when
-- they can leave. Destination mirrors the target's, since the point of
-- this flow is driving that person there, not a separate errand.
create function public.offer_ride(
  p_target_request_id uuid,
  p_starting_point text,
  p_starting_point_lat double precision,
  p_starting_point_lng double precision,
  p_requested_time timestamptz
)
returns public.matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  target_owner uuid;
  target_status text;
  target_mode text;
  target_destination text;
  target_destination_lat double precision;
  target_destination_lng double precision;
  new_request_id uuid;
  result public.matches;
begin
  if caller is null then
    raise exception 'Not authenticated';
  end if;

  select user_id, status, mode, destination, destination_lat, destination_lng
    into target_owner, target_status, target_mode, target_destination,
         target_destination_lat, target_destination_lng
  from public.trip_requests
  where id = p_target_request_id
  for update;

  if target_owner is null then
    raise exception 'Trip request not found';
  end if;

  if target_mode <> 'car' then
    raise exception 'Can only offer a ride on a car request';
  end if;

  if target_status <> 'open' then
    raise exception 'This request is no longer open';
  end if;

  if target_owner = caller then
    raise exception 'Cannot offer a ride to yourself';
  end if;

  insert into public.trip_requests (
    user_id, starting_point, starting_point_lat, starting_point_lng,
    destination, destination_lat, destination_lng, requested_time, mode, status
  )
  values (
    caller, p_starting_point, p_starting_point_lat, p_starting_point_lng,
    target_destination, target_destination_lat, target_destination_lng,
    p_requested_time, 'car', 'open'
  )
  returning id into new_request_id;

  update public.trip_requests
  set status = 'matched'
  where id in (new_request_id, p_target_request_id);

  -- Same driver semantics as create_match: the person whose counterpart
  -- posted the car-mode "needs ride" request is the one driving. Here
  -- that's always the caller, since target_mode = 'car' is enforced above.
  insert into public.matches (trip_request_id_a, trip_request_id_b, driver_user_id)
  values (new_request_id, p_target_request_id, caller)
  returning * into result;

  return result;
end;
$$;

grant execute on function public.offer_ride(uuid, text, double precision, double precision, timestamptz)
  to authenticated;

-- =========================================================================
-- leave_bus_group: lets a passenger back out of a bus post they joined.
-- Frees their spot and reopens the post if it had been closed for being
-- full. The host isn't a bus_group_members row (they're tracked via
-- trip_requests.user_id), so this only ever applies to joiners — leaving
-- your own post is a different action (cancel), out of scope here.
-- =========================================================================

create function public.leave_bus_group(p_trip_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  trip_status text;
  member_count integer;
begin
  if caller is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.bus_group_members
  where trip_request_id = p_trip_request_id and user_id = caller;

  if not found then
    raise exception 'You are not part of this commute';
  end if;

  select status into trip_status
  from public.trip_requests
  where id = p_trip_request_id
  for update;

  select count(*) into member_count
  from public.bus_group_members
  where trip_request_id = p_trip_request_id;

  if trip_status = 'matched' and member_count < 5 then
    update public.trip_requests set status = 'open' where id = p_trip_request_id;
  end if;
end;
$$;

grant execute on function public.leave_bus_group(uuid) to authenticated;
