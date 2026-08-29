-- Lets a student set a home address on their profile, and surfaces
-- destination lat/lng on open_trip_requests() so the browse feed can show
-- "N min from home" next to each posting. trip_requests already stores
-- destination_lat/lng (20260828010000_add_trip_request_coordinates.sql);
-- this just exposes those two columns through the RPC.

alter table public.profiles
  add column home_address text,
  add column home_lat double precision,
  add column home_lng double precision;

-- Return type change -> drop + recreate.
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
  created_at timestamptz,
  requester_display_name text,
  requester_average_stars numeric,
  requester_completed_trip_count integer,
  requester_rides_given integer,
  bus_member_count integer,
  companion_display_names text[],
  requester_school text,
  requester_degree_pursuit text
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
    p.degree_pursuit as requester_degree_pursuit
  from public.trip_requests tr
  join public.profiles p on p.id = tr.user_id
  left join lateral public.profile_stats(tr.user_id) as stats on true
  where tr.status = 'open'
    and tr.user_id <> auth.uid()
    and tr.requested_time > now()
  order by tr.requested_time asc;
$$;

grant execute on function public.open_trip_requests() to authenticated;
