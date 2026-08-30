-- Splits Open Requests into "Need a Mate" / "Offering a Ride": every post
-- now carries an explicit post_type alongside its existing mode, so a car
-- or bus/walk post can represent either "I need a ride/buddy" or "I'm
-- offering a ride/company" instead of always being read as a need.
--
-- Backfill: nothing in the existing schema distinguishes rider-posted from
-- driver-posted trip_requests (every row today was created through the one
-- "post a request" flow, which only ever expressed a need — offering was
-- previously only possible by reacting to someone else's post, never as a
-- standalone post of your own). So every existing row defaults to 'need',
-- which matches today's actual behavior exactly; this is a documented,
-- deliberate tradeoff rather than a guess.
alter table public.trip_requests
  add column post_type text not null default 'need' check (post_type in ('need', 'offer'));

-- =========================================================================
-- open_trip_requests: unchanged filtering/ordering, just also returns
-- post_type so the client can split the feed into two tabs without any
-- change to which candidates are eligible or how they're ranked.
-- =========================================================================

drop function public.open_trip_requests();

create function public.open_trip_requests()
returns table (
  id uuid,
  requester_id uuid,
  starting_point text,
  destination text,
  destination_lat double precision,
  destination_lng double precision,
  requested_time timestamptz,
  mode text,
  post_type text,
  created_at timestamptz,
  requester_display_name text,
  requester_average_stars numeric,
  requester_completed_trip_count integer,
  requester_rides_given integer,
  bus_member_count integer,
  companion_display_names text[],
  requester_school text,
  requester_degree_pursuit text,
  requester_open_to_networking_chat boolean
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    tr.id,
    tr.user_id,
    tr.starting_point,
    tr.destination,
    tr.destination_lat,
    tr.destination_lng,
    tr.requested_time,
    tr.mode,
    tr.post_type,
    tr.created_at,
    trim(
      split_part(p.full_name, ' ', 1)
      || case
           when position(' ' in p.full_name) > 0
             then ' ' || left(split_part(p.full_name, ' ', 2), 1) || '.'
             else ''
         end
    ) as requester_display_name,
    stats.average_stars,
    stats.completed_trip_count,
    stats.rides_given,
    case
      when tr.mode = 'bus' then
        1 + (select count(*) from public.bus_group_members bgm where bgm.trip_request_id = tr.id)
      else null
    end as bus_member_count,
    case
      when tr.mode = 'car' then
        (
          select coalesce(array_agg(
            trim(
              split_part(cp.full_name, ' ', 1)
              || case
                   when position(' ' in cp.full_name) > 0
                     then ' ' || left(split_part(cp.full_name, ' ', 2), 1) || '.'
                     else ''
                 end
            )
          ), '{}')
          from public.trip_request_companions trc
          join public.profiles cp on cp.id = trc.user_id
          where trc.trip_request_id = tr.id
        )
      else '{}'::text[]
    end as companion_display_names,
    p.school as requester_school,
    p.degree_pursuit as requester_degree_pursuit,
    stats.open_to_networking_chat as requester_open_to_networking_chat
  from public.trip_requests tr
  join public.profiles p on p.id = tr.user_id
  left join lateral public.profile_stats(tr.user_id) as stats on true
  where tr.status = 'open'
    and tr.user_id <> auth.uid()
    and tr.requested_time > now()
    and not exists (
      select 1 from public.bus_group_members bgm
      where bgm.trip_request_id = tr.id and bgm.user_id = auth.uid()
    )
    and not exists (
      select 1 from public.trip_request_companions trc
      where trc.trip_request_id = tr.id and trc.user_id = auth.uid()
    )
  order by tr.requested_time asc;
$$;

grant execute on function public.open_trip_requests() to authenticated;

-- =========================================================================
-- offer_ride: now explicitly tags the caller's new request post_type =
-- 'offer' (previously omitted, which would silently default to 'need' —
-- wrong for a flow whose entire point is the caller offering a ride), and
-- only allows targeting a 'need' post, since offering *at* someone else's
-- open offer doesn't make sense.
-- =========================================================================

create or replace function public.offer_ride(
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
  target_post_type text;
  target_destination text;
  target_destination_lat double precision;
  target_destination_lng double precision;
  new_request_id uuid;
  result public.matches;
begin
  if caller is null then
    raise exception 'Not authenticated';
  end if;

  select user_id, status, mode, post_type, destination, destination_lat, destination_lng
    into target_owner, target_status, target_mode, target_post_type, target_destination,
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

  if target_post_type <> 'need' then
    raise exception 'This post is already an offered ride';
  end if;

  if target_status <> 'open' then
    raise exception 'This request is no longer open';
  end if;

  if target_owner = caller then
    raise exception 'Cannot offer a ride to yourself';
  end if;

  insert into public.trip_requests (
    user_id, starting_point, starting_point_lat, starting_point_lng,
    destination, destination_lat, destination_lng, requested_time, mode, post_type, status
  )
  values (
    caller, p_starting_point, p_starting_point_lat, p_starting_point_lng,
    target_destination, target_destination_lat, target_destination_lng,
    p_requested_time, 'car', 'offer', 'open'
  )
  returning id into new_request_id;

  update public.trip_requests
  set status = 'matched'
  where id in (new_request_id, p_target_request_id);

  insert into public.matches (trip_request_id_a, trip_request_id_b, driver_user_id)
  values (new_request_id, p_target_request_id, caller)
  returning * into result;

  return result;
end;
$$;

-- =========================================================================
-- request_ride: the mirror of offer_ride for the new "Offering a Ride" tab
-- — lets a rider request a seat directly from someone's open car *offer*
-- without posting a standalone request first. Creates a minimal car-mode
-- 'need' trip_request on the caller's behalf, matched immediately, with
-- the offer's poster (who actually has the car) as driver — the inverse
-- of offer_ride's driver assignment, since here the target is the one
-- offering, not the one needing a ride.
-- =========================================================================

create function public.request_ride(
  p_target_offer_id uuid,
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
  target_post_type text;
  target_destination text;
  target_destination_lat double precision;
  target_destination_lng double precision;
  new_request_id uuid;
  result public.matches;
begin
  if caller is null then
    raise exception 'Not authenticated';
  end if;

  select user_id, status, mode, post_type, destination, destination_lat, destination_lng
    into target_owner, target_status, target_mode, target_post_type, target_destination,
         target_destination_lat, target_destination_lng
  from public.trip_requests
  where id = p_target_offer_id
  for update;

  if target_owner is null then
    raise exception 'Trip request not found';
  end if;

  if target_mode <> 'car' then
    raise exception 'Can only request a ride on a car offer';
  end if;

  if target_post_type <> 'offer' then
    raise exception 'This post is not an offered ride';
  end if;

  if target_status <> 'open' then
    raise exception 'This offer is no longer open';
  end if;

  if target_owner = caller then
    raise exception 'Cannot request a ride from yourself';
  end if;

  insert into public.trip_requests (
    user_id, starting_point, starting_point_lat, starting_point_lng,
    destination, destination_lat, destination_lng, requested_time, mode, post_type, status
  )
  values (
    caller, p_starting_point, p_starting_point_lat, p_starting_point_lng,
    target_destination, target_destination_lat, target_destination_lng,
    p_requested_time, 'car', 'need', 'open'
  )
  returning id into new_request_id;

  update public.trip_requests
  set status = 'matched'
  where id in (new_request_id, p_target_offer_id);

  insert into public.matches (trip_request_id_a, trip_request_id_b, driver_user_id)
  values (new_request_id, p_target_offer_id, target_owner)
  returning * into result;

  return result;
end;
$$;

grant execute on function public.request_ride(uuid, text, double precision, double precision, timestamptz)
  to authenticated;
