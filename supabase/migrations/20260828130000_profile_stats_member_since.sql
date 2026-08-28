-- Adds member_since to profile_stats() for the profile page. Return type
-- change, so drop + recreate (same pattern used elsewhere in this file's
-- history).

drop function public.open_trip_requests();
drop function public.profile_stats(uuid);

create function public.profile_stats(p_user_id uuid)
returns table (
  full_name text,
  average_stars numeric,
  completed_trip_count integer,
  rides_given integer,
  member_since timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    p.full_name,
    round(avg(r.stars)::numeric, 1) as average_stars,
    (
      select count(*)::integer
      from public.matches m
      join public.trip_requests tr_a on tr_a.id = m.trip_request_id_a
      join public.trip_requests tr_b on tr_b.id = m.trip_request_id_b
      where m.status = 'completed'
        and (tr_a.user_id = p_user_id or tr_b.user_id = p_user_id)
    ) as completed_trip_count,
    (
      select count(*)::integer
      from public.matches m
      where m.status = 'completed'
        and m.driver_user_id = p_user_id
    ) as rides_given,
    p.created_at as member_since
  from public.profiles p
  left join public.ratings r on r.ratee_id = p.id and r.stars is not null
  where p.id = p_user_id
  group by p.full_name, p.created_at;
$$;

grant execute on function public.profile_stats(uuid) to authenticated;

create function public.open_trip_requests()
returns table (
  id uuid,
  requester_id uuid,
  starting_point text,
  destination text,
  requested_time timestamptz,
  mode text,
  created_at timestamptz,
  requester_display_name text,
  requester_average_stars numeric,
  requester_completed_trip_count integer,
  requester_rides_given integer
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
    stats.rides_given
  from public.trip_requests tr
  join public.profiles p on p.id = tr.user_id
  left join lateral public.profile_stats(tr.user_id) as stats on true
  where tr.status = 'open'
    and tr.user_id <> auth.uid()
  order by tr.created_at desc;
$$;

grant execute on function public.open_trip_requests() to authenticated;
