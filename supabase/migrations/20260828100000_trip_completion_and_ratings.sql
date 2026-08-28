-- Trip completion status + ratings/reviews + profile stats.
--
-- Design notes:
-- * matches has no "driver"/"rider" distinction (see open_trip_requests /
--   create_match) — a match is just two symmetric trip_requests. Ratings
--   are therefore person-level, not role-specific: whoever you match with
--   is rateable once the trip completes, regardless of mode.
-- * Completion is unlocked once either party marks it done (no mutual
--   confirmation) — see mark_trip_completed().
-- * Ratings are mutually blind: you can only see a rating someone left you
--   once you've also rated them for that same trip (ratings_select policy
--   below), to avoid retaliatory/anchored ratings.
-- * All mutation goes through SECURITY DEFINER functions (mark_trip_completed,
--   submit_rating), matching the create_match() pattern already used here —
--   no direct insert/update grants to `authenticated` on either table.

-- =========================================================================
-- matches: completion status
-- =========================================================================

alter table public.matches
  add column status text not null default 'active' check (status in ('active', 'completed')),
  add column completed_at timestamptz,
  add column completed_by uuid references auth.users (id);

-- =========================================================================
-- ratings
-- =========================================================================

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.matches (id) on delete cascade,
  rater_id uuid not null references auth.users (id) on delete cascade,
  ratee_id uuid not null references auth.users (id) on delete cascade,
  stars integer check (stars between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  constraint ratings_trip_rater_unique unique (trip_id, rater_id),
  constraint ratings_no_self_rating check (rater_id <> ratee_id)
);

create index ratings_ratee_id_idx on public.ratings (ratee_id);
create index ratings_rater_id_idx on public.ratings (rater_id);

alter table public.ratings enable row level security;

-- You can always see ratings you gave.
create policy "ratings_select_given"
  on public.ratings for select
  to authenticated
  using (rater_id = auth.uid());

-- You can see a rating someone left you only once you've also rated them
-- for that same trip (mutual reveal — see design note above).
create policy "ratings_select_received_after_own"
  on public.ratings for select
  to authenticated
  using (
    ratee_id = auth.uid()
    and exists (
      select 1 from public.ratings r2
      where r2.trip_id = ratings.trip_id
        and r2.rater_id = auth.uid()
    )
  );

grant select on public.ratings to authenticated;

-- =========================================================================
-- mark_trip_completed: either matched party can mark a trip done, once
-- both sides' scheduled times have passed. Idempotent.
-- =========================================================================

create function public.mark_trip_completed(p_trip_id uuid)
returns public.matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  rec public.matches;
  owner_a uuid;
  owner_b uuid;
  time_a timestamptz;
  time_b timestamptz;
begin
  select * into rec from public.matches where id = p_trip_id for update;

  if rec.id is null then
    raise exception 'Trip not found';
  end if;

  select user_id, requested_time into owner_a, time_a
  from public.trip_requests where id = rec.trip_request_id_a;

  select user_id, requested_time into owner_b, time_b
  from public.trip_requests where id = rec.trip_request_id_b;

  if caller is null or (caller <> owner_a and caller <> owner_b) then
    raise exception 'Not authorized to complete this trip';
  end if;

  if rec.status = 'completed' then
    return rec;
  end if;

  if now() < greatest(time_a, time_b) then
    raise exception 'Trip has not happened yet';
  end if;

  update public.matches
  set status = 'completed', completed_at = now(), completed_by = caller
  where id = p_trip_id
  returning * into rec;

  return rec;
end;
$$;

grant execute on function public.mark_trip_completed(uuid) to authenticated;

-- =========================================================================
-- submit_rating: rate your trip partner on a completed trip. ratee_id is
-- derived server-side (never trusts client input) so self-rating and
-- rating an unrelated user are both structurally impossible, not just
-- UI-guarded. Upserts, so fixing a typo doesn't require new plumbing.
-- =========================================================================

create function public.submit_rating(p_trip_id uuid, p_stars integer, p_comment text)
returns public.ratings
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  m public.matches;
  owner_a uuid;
  owner_b uuid;
  target uuid;
  result public.ratings;
begin
  if p_stars is not null and (p_stars < 1 or p_stars > 5) then
    raise exception 'Stars must be between 1 and 5';
  end if;

  select * into m from public.matches where id = p_trip_id;
  if m.id is null then
    raise exception 'Trip not found';
  end if;

  if m.status <> 'completed' then
    raise exception 'Trip must be completed before rating';
  end if;

  select user_id into owner_a from public.trip_requests where id = m.trip_request_id_a;
  select user_id into owner_b from public.trip_requests where id = m.trip_request_id_b;

  if caller is null or (caller <> owner_a and caller <> owner_b) then
    raise exception 'Not authorized to rate this trip';
  end if;

  target := case when caller = owner_a then owner_b else owner_a end;

  if caller = target then
    raise exception 'Cannot rate yourself';
  end if;

  insert into public.ratings (trip_id, rater_id, ratee_id, stars, comment)
  values (p_trip_id, caller, target, p_stars, nullif(trim(p_comment), ''))
  on conflict (trip_id, rater_id) do update
    set stars = excluded.stars, comment = excluded.comment
  returning * into result;

  return result;
end;
$$;

grant execute on function public.submit_rating(uuid, integer, text) to authenticated;

-- =========================================================================
-- profile_stats: public-facing aggregate for any user — name, average
-- stars, completed trip count. Deliberately excludes individual reviews.
-- =========================================================================

create function public.profile_stats(p_user_id uuid)
returns table (
  full_name text,
  average_stars numeric,
  completed_trip_count integer
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
    ) as completed_trip_count
  from public.profiles p
  left join public.ratings r on r.ratee_id = p.id and r.stars is not null
  where p.id = p_user_id
  group by p.full_name;
$$;

grant execute on function public.profile_stats(uuid) to authenticated;

-- =========================================================================
-- my_trip_history: the caller's own completed trips, enriched with the
-- counterpart's name and both destinations. Private-profile use only.
-- =========================================================================

create function public.my_trip_history()
returns table (
  trip_id uuid,
  completed_at timestamptz,
  counterpart_id uuid,
  counterpart_name text,
  my_destination text,
  counterpart_destination text,
  requested_time timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    m.id,
    m.completed_at,
    case when tr_a.user_id = auth.uid() then tr_b.user_id else tr_a.user_id end,
    case when tr_a.user_id = auth.uid() then p_b.full_name else p_a.full_name end,
    case when tr_a.user_id = auth.uid() then tr_a.destination else tr_b.destination end,
    case when tr_a.user_id = auth.uid() then tr_b.destination else tr_a.destination end,
    case when tr_a.user_id = auth.uid() then tr_a.requested_time else tr_b.requested_time end
  from public.matches m
  join public.trip_requests tr_a on tr_a.id = m.trip_request_id_a
  join public.trip_requests tr_b on tr_b.id = m.trip_request_id_b
  join public.profiles p_a on p_a.id = tr_a.user_id
  join public.profiles p_b on p_b.id = tr_b.user_id
  where m.status = 'completed'
    and auth.uid() in (tr_a.user_id, tr_b.user_id)
  order by m.completed_at desc;
$$;

grant execute on function public.my_trip_history() to authenticated;

-- =========================================================================
-- my_rating_activity: ratings the caller has given and received (received
-- rows only appear once the caller has rated that trip too — same mutual
-- reveal rule as the ratings RLS policy, re-implemented here since this
-- function runs as SECURITY DEFINER and bypasses table RLS). Private
-- -profile use only.
-- =========================================================================

create function public.my_rating_activity()
returns table (
  trip_id uuid,
  direction text,
  counterpart_id uuid,
  counterpart_name text,
  stars integer,
  comment text,
  created_at timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select r.trip_id, 'given', r.ratee_id, p.full_name, r.stars, r.comment, r.created_at
  from public.ratings r
  join public.profiles p on p.id = r.ratee_id
  where r.rater_id = auth.uid()

  union all

  select r.trip_id, 'received', r.rater_id, p.full_name, r.stars, r.comment, r.created_at
  from public.ratings r
  join public.profiles p on p.id = r.rater_id
  where r.ratee_id = auth.uid()
    and exists (
      select 1 from public.ratings r2
      where r2.trip_id = r.trip_id and r2.rater_id = auth.uid()
    )
  order by created_at desc;
$$;

grant execute on function public.my_rating_activity() to authenticated;

-- =========================================================================
-- open_trip_requests / my_matches: extend with the columns the new UI
-- needs (requester_id for profile links + rating; match status/completion;
-- counterpart_id for profile links). Return type changes, so drop + recreate.
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
  requester_completed_trip_count integer
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
    stats.completed_trip_count
  from public.trip_requests tr
  join public.profiles p on p.id = tr.user_id
  left join lateral public.profile_stats(tr.user_id) as stats on true
  where tr.status = 'open'
    and tr.user_id <> auth.uid()
  order by tr.created_at desc;
$$;

grant execute on function public.open_trip_requests() to authenticated;

drop function public.my_matches();

create function public.my_matches()
returns table (
  match_id uuid,
  match_status text,
  match_created_at timestamptz,
  completed_at timestamptz,
  my_trip_request_id uuid,
  my_requested_time timestamptz,
  counterpart_trip_request_id uuid,
  counterpart_id uuid,
  counterpart_display_name text,
  counterpart_starting_point text,
  counterpart_destination text,
  counterpart_requested_time timestamptz,
  counterpart_mode text
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    m.id as match_id,
    m.status,
    m.created_at as match_created_at,
    m.completed_at,
    case when tr_a.user_id = auth.uid() then tr_a.id else tr_b.id end,
    case when tr_a.user_id = auth.uid() then tr_a.requested_time else tr_b.requested_time end,
    case when tr_a.user_id = auth.uid() then tr_b.id else tr_a.id end,
    case when tr_a.user_id = auth.uid() then tr_b.user_id else tr_a.user_id end,
    case
      when tr_a.user_id = auth.uid() then
        trim(
          split_part(p_b.full_name, ' ', 1)
          || case
               when position(' ' in p_b.full_name) > 0
                 then ' ' || left(split_part(p_b.full_name, ' ', 2), 1) || '.'
               else ''
             end
        )
      else
        trim(
          split_part(p_a.full_name, ' ', 1)
          || case
               when position(' ' in p_a.full_name) > 0
                 then ' ' || left(split_part(p_a.full_name, ' ', 2), 1) || '.'
               else ''
             end
        )
    end,
    case when tr_a.user_id = auth.uid() then tr_b.starting_point else tr_a.starting_point end,
    case when tr_a.user_id = auth.uid() then tr_b.destination else tr_a.destination end,
    case when tr_a.user_id = auth.uid() then tr_b.requested_time else tr_a.requested_time end,
    case when tr_a.user_id = auth.uid() then tr_b.mode else tr_a.mode end
  from public.matches m
  join public.trip_requests tr_a on tr_a.id = m.trip_request_id_a
  join public.trip_requests tr_b on tr_b.id = m.trip_request_id_b
  join public.profiles p_a on p_a.id = tr_a.user_id
  join public.profiles p_b on p_b.id = tr_b.user_id
  where auth.uid() in (tr_a.user_id, tr_b.user_id)
  order by m.created_at desc;
$$;

grant execute on function public.my_matches() to authenticated;
