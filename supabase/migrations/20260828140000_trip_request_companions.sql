-- Car-ride companions: the poster of a car request can tag other real
-- accounts (friends also wanting a ride) directly onto their request.
-- This is deliberately a different shape from bus_group_members: bus
-- membership is self-join by strangers browsing an open post, whereas
-- companions are known people the poster names by search at posting
-- time. Companions ride along under the same request; matching, ratings,
-- and completion stay 1:1 between the poster and the driver — extending
-- those to N people is its own project, same scope note as bus groups.

create table public.trip_request_companions (
  id uuid primary key default gen_random_uuid(),
  trip_request_id uuid not null references public.trip_requests (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  added_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (trip_request_id, user_id)
);

create index trip_request_companions_trip_request_id_idx
  on public.trip_request_companions (trip_request_id);
create index trip_request_companions_user_id_idx
  on public.trip_request_companions (user_id);

alter table public.trip_request_companions enable row level security;

-- No self-referencing subquery on this table — see
-- 20260828133000_fix_bus_group_members_rls_recursion.sql for why that
-- causes infinite recursion. Full rosters are read via open_trip_requests
-- (SECURITY DEFINER), same pattern as bus groups.
create policy "trip_request_companions_select_participant"
  on public.trip_request_companions for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.trip_requests tr
      where tr.id = trip_request_companions.trip_request_id and tr.user_id = auth.uid()
    )
  );

-- Only the request's poster can tag companions onto it, and only while
-- it's still open.
create policy "trip_request_companions_insert_host"
  on public.trip_request_companions for insert
  to authenticated
  with check (
    added_by = auth.uid()
    and exists (
      select 1 from public.trip_requests tr
      where tr.id = trip_request_companions.trip_request_id
        and tr.user_id = auth.uid()
        and tr.status = 'open'
    )
  );

-- Only the poster can untag someone.
create policy "trip_request_companions_delete_host"
  on public.trip_request_companions for delete
  to authenticated
  using (
    exists (
      select 1 from public.trip_requests tr
      where tr.id = trip_request_companions.trip_request_id and tr.user_id = auth.uid()
    )
  );

grant select, insert, delete on public.trip_request_companions to authenticated;

-- =========================================================================
-- search_profiles: lets the poster find other real accounts by name to
-- tag as companions. SECURITY DEFINER since profiles_select_own only lets
-- a user read their own row directly — a plain table query can't find
-- anyone else. Returns the same redacted "First L." display name used
-- everywhere else a student's identity is shown to other students.
-- =========================================================================

create function public.search_profiles(p_query text)
returns table (
  id uuid,
  display_name text
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    p.id,
    trim(
      split_part(p.full_name, ' ', 1)
      || case
           when position(' ' in p.full_name) > 0
             then ' ' || left(split_part(p.full_name, ' ', 2), 1) || '.'
           else ''
         end
    ) as display_name
  from public.profiles p
  where p.id <> auth.uid()
    and length(trim(p_query)) >= 2
    and p.full_name ilike '%' || trim(p_query) || '%'
  order by p.full_name
  limit 8;
$$;

grant execute on function public.search_profiles(text) to authenticated;

-- =========================================================================
-- open_trip_requests: add companion_display_names so browse can show who
-- else is riding along on a car post, mirroring how bus_member_count
-- surfaces the bus roster size (return type change, drop + recreate).
-- =========================================================================

drop function public.open_trip_requests();

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
  requester_rides_given integer,
  bus_member_count integer,
  companion_display_names text[]
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
    end as companion_display_names
  from public.trip_requests tr
  join public.profiles p on p.id = tr.user_id
  left join lateral public.profile_stats(tr.user_id) as stats on true
  where tr.status = 'open'
    and tr.user_id <> auth.uid()
  order by tr.created_at desc;
$$;

grant execute on function public.open_trip_requests() to authenticated;

alter publication supabase_realtime add table public.trip_request_companions;
