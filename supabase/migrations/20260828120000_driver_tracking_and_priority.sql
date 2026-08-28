-- Driver priority score, tier badges, and reciprocal karma need
-- "rides_given as a driver" — which nothing in this schema has ever
-- tracked. matches pairs two symmetric trip_requests with no record of
-- who (if anyone) was driving. This migration adds that going forward:
--
-- driver_user_id on matches, set inside create_match() based on the
-- mode of the request being matched into (request_b) — mirrors the
-- existing UI exactly: browse.tsx only shows an "Offer a Ride" button on
-- mode = 'car' cards, and clicking it is the only way a match forms
-- where someone is knowingly acting as a driver. mode = 'bus' pairings
-- (bus-buddy, "Join Commute") have no driver by definition.
--
-- This is necessarily prospective only — existing completed matches (from
-- before this migration) have no recoverable driver, and stay counted as
-- non-driving trips. rides_given will under-count for anyone who drove
-- before this shipped.

alter table public.matches
  add column driver_user_id uuid references auth.users (id);

create or replace function public.create_match(request_a uuid, request_b uuid)
returns public.matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  owner_a uuid;
  owner_b uuid;
  status_a text;
  status_b text;
  mode_b text;
  driver uuid;
  result public.matches;
begin
  if request_a = request_b then
    raise exception 'Cannot match a trip request with itself';
  end if;

  select user_id, status into owner_a, status_a
  from public.trip_requests where id = request_a for update;

  select user_id, status, mode into owner_b, status_b, mode_b
  from public.trip_requests where id = request_b for update;

  if owner_a is null or owner_b is null then
    raise exception 'Trip request not found';
  end if;

  if caller is null or (caller <> owner_a and caller <> owner_b) then
    raise exception 'Not authorized to match these trip requests';
  end if;

  if owner_a = owner_b then
    raise exception 'Cannot match a user with themselves';
  end if;

  if status_a <> 'open' or status_b <> 'open' then
    raise exception 'Both trip requests must be open to match';
  end if;

  update public.trip_requests set status = 'matched' where id in (request_a, request_b);

  driver := case when mode_b = 'car' then owner_a else null end;

  insert into public.matches (trip_request_id_a, trip_request_id_b, driver_user_id)
  values (request_a, request_b, driver)
  returning * into result;

  return result;
end;
$$;

-- open_trip_requests depends on profile_stats via a lateral join, so it
-- has to be dropped before profile_stats can be dropped and recreated
-- with the new rides_given column.
drop function public.open_trip_requests();
drop function public.profile_stats(uuid);

create function public.profile_stats(p_user_id uuid)
returns table (
  full_name text,
  average_stars numeric,
  completed_trip_count integer,
  rides_given integer
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
    ) as rides_given
  from public.profiles p
  left join public.ratings r on r.ratee_id = p.id and r.stars is not null
  where p.id = p_user_id
  group by p.full_name;
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
