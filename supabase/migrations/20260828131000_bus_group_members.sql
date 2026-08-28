-- Bus posts support up to 6 people total (the poster + up to 5 joiners),
-- not just a 1:1 pairing like car matches. This is deliberately a
-- separate mechanism from matches/create_match rather than a redesign of
-- it: matches stays exactly-2-sided for car matching and the existing
-- ratings/completion/driver-tracking system, which all assume exactly
-- two participants. Bus groups get posting/joining/messaging only for
-- now — no ratings or completion, since extending that system to N
-- people is its own project.

create table public.bus_group_members (
  id uuid primary key default gen_random_uuid(),
  trip_request_id uuid not null references public.trip_requests (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (trip_request_id, user_id)
);

create index bus_group_members_trip_request_id_idx on public.bus_group_members (trip_request_id);
create index bus_group_members_user_id_idx on public.bus_group_members (user_id);

alter table public.bus_group_members enable row level security;

-- Visible to the poster and to fellow members of the same group.
create policy "bus_group_members_select_participant"
  on public.bus_group_members for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.trip_requests tr
      where tr.id = bus_group_members.trip_request_id and tr.user_id = auth.uid()
    )
    or exists (
      select 1 from public.bus_group_members bgm2
      where bgm2.trip_request_id = bus_group_members.trip_request_id
        and bgm2.user_id = auth.uid()
    )
  );

grant select on public.bus_group_members to authenticated;

-- =========================================================================
-- join_bus_group: the only way to join — validates mode, openness, caller
-- isn't the poster or already a member, and the 6-total cap (poster + 5
-- joiners), then closes the post once full, mirroring how create_match
-- closes both sides of a car match today.
-- =========================================================================

create function public.join_bus_group(p_trip_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  host uuid;
  trip_mode text;
  trip_status text;
  member_count integer;
begin
  select user_id, mode, status into host, trip_mode, trip_status
  from public.trip_requests where id = p_trip_request_id for update;

  if host is null then
    raise exception 'Trip request not found';
  end if;

  if trip_mode <> 'bus' then
    raise exception 'Only bus posts support multiple riders';
  end if;

  if trip_status <> 'open' then
    raise exception 'This commute is no longer open';
  end if;

  if caller is null or caller = host then
    raise exception 'Not authorized to join this commute';
  end if;

  if exists (
    select 1 from public.bus_group_members
    where trip_request_id = p_trip_request_id and user_id = caller
  ) then
    return;
  end if;

  select count(*) into member_count
  from public.bus_group_members
  where trip_request_id = p_trip_request_id;

  if member_count >= 5 then
    raise exception 'This commute is full';
  end if;

  insert into public.bus_group_members (trip_request_id, user_id)
  values (p_trip_request_id, caller);

  if member_count + 1 >= 5 then
    update public.trip_requests set status = 'matched' where id = p_trip_request_id;
  end if;
end;
$$;

grant execute on function public.join_bus_group(uuid) to authenticated;

-- =========================================================================
-- my_bus_groups: every bus post the caller posted or joined, with the
-- other participants' redacted display names.
-- =========================================================================

create function public.my_bus_groups()
returns table (
  trip_request_id uuid,
  role text,
  starting_point text,
  destination text,
  requested_time timestamptz,
  member_count integer,
  other_display_names text[]
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    tr.id,
    case when tr.user_id = auth.uid() then 'host' else 'member' end,
    tr.starting_point,
    tr.destination,
    tr.requested_time,
    1 + (select count(*) from public.bus_group_members bgm where bgm.trip_request_id = tr.id),
    (
      select coalesce(array_agg(
        trim(
          split_part(p.full_name, ' ', 1)
          || case
               when position(' ' in p.full_name) > 0
                 then ' ' || left(split_part(p.full_name, ' ', 2), 1) || '.'
               else ''
             end
        )
      ), '{}')
      from public.bus_group_members bgm
      join public.profiles p on p.id = bgm.user_id
      where bgm.trip_request_id = tr.id
        and bgm.user_id <> auth.uid()
    )
    || (
      select coalesce(array_agg(
        trim(
          split_part(p2.full_name, ' ', 1)
          || case
               when position(' ' in p2.full_name) > 0
                 then ' ' || left(split_part(p2.full_name, ' ', 2), 1) || '.'
               else ''
             end
        )
      ), '{}')
      from public.profiles p2
      where p2.id = tr.user_id
        and tr.user_id <> auth.uid()
    )
  from public.trip_requests tr
  where tr.mode = 'bus'
    and (
      tr.user_id = auth.uid()
      or exists (
        select 1 from public.bus_group_members bgm
        where bgm.trip_request_id = tr.id and bgm.user_id = auth.uid()
      )
    )
  order by tr.requested_time desc;
$$;

grant execute on function public.my_bus_groups() to authenticated;

-- =========================================================================
-- open_trip_requests: add bus_member_count so browse can show "3/6
-- joined" before a post fills up (return type change, drop + recreate).
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
  bus_member_count integer
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
    end as bus_member_count
  from public.trip_requests tr
  join public.profiles p on p.id = tr.user_id
  left join lateral public.profile_stats(tr.user_id) as stats on true
  where tr.status = 'open'
    and tr.user_id <> auth.uid()
  order by tr.created_at desc;
$$;

grant execute on function public.open_trip_requests() to authenticated;

alter publication supabase_realtime add table public.bus_group_members;
