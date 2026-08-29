-- Optional, fill-in-anytime enrichment fields, separate from `profiles`
-- (core identity/verification). This data is intended to feed a future
-- AI match-reasoning feature (not built here) — kept as clean, constrained
-- fields rather than free text wherever the field type allows it, so it's
-- structured input for a model rather than prose to re-parse later.
--
-- One row per user, same shape as `profiles` itself. Every field is
-- nullable (or defaults to an empty array) so a partial save is just a
-- normal upsert with only some keys set.

create table public.profile_details (
  user_id uuid primary key references auth.users (id) on delete cascade,

  music_preference text[] not null default '{}'
    check (
      music_preference <@ array[
        'Pop', 'Hip-Hop/R&B', 'Rock/Indie', 'EDM/Electronic', 'Podcasts', 'Quiet/no music'
      ]
    ),
  conversation_style text
    check (conversation_style in ('Love to chat', 'Depends on my mood', 'Prefer quiet')),

  temperature_preference text
    check (
      temperature_preference in (
        'Runs hot (likes AC)', 'Runs cold (likes heat)', 'No preference'
      )
    ),
  fragrance_free_preferred boolean,
  pet_preference text
    check (pet_preference in ('Pet-friendly', 'Prefer no pets', 'No preference')),
  ok_with_food_drink boolean,

  hometown text,
  languages_spoken text,
  hobbies text[] not null default '{}'
    check (
      hobbies <@ array[
        'Hiking/Outdoors', 'Fitness/Sports', 'Cooking/Food', 'Music/Concerts',
        'Travel', 'Reading', 'Gaming/Art'
      ]
    ),

  target_field text
    check (
      target_field in (
        'Business/Consulting', 'Tech/Engineering', 'Healthcare/Medicine', 'Creative/Arts',
        'Law/Policy', 'Academia/Research', 'Entrepreneurship'
      )
    ),
  dream_role_or_company text,
  -- The one field in this table that isn't private match-fuel — it's a
  -- deliberate signal shown on the public profile and browse cards, see
  -- profile_stats() below.
  open_to_networking_chat boolean,

  fun_fact text check (fun_fact is null or char_length(fun_fact) <= 100),

  updated_at timestamptz not null default now()
);

alter table public.profile_details enable row level security;

create policy "profile_details_select_own"
  on public.profile_details for select
  to authenticated
  using (user_id = auth.uid());

create policy "profile_details_insert_own"
  on public.profile_details for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "profile_details_update_own"
  on public.profile_details for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- =========================================================================
-- Surface only open_to_networking_chat on the public-facing profile_stats
-- RPC — everything else in profile_details stays behind the owner-only RLS
-- above. Return type change -> drop + recreate, and open_trip_requests()
-- has a hard dependency on profile_stats (LANGUAGE SQL), so it has to be
-- dropped first and recreated after, same pattern as prior migrations.
-- =========================================================================

drop function public.open_trip_requests();
drop function public.profile_stats(uuid);

create function public.profile_stats(p_user_id uuid)
returns table (
  full_name text,
  average_stars numeric,
  completed_trip_count integer,
  rides_given integer,
  member_since timestamptz,
  school text,
  degree_pursuit text,
  graduation_year integer,
  open_to_networking_chat boolean
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
    p.created_at as member_since,
    p.school,
    p.degree_pursuit,
    p.graduation_year,
    pd.open_to_networking_chat
  from public.profiles p
  left join public.ratings r on r.ratee_id = p.id and r.stars is not null
  left join public.profile_details pd on pd.user_id = p.id
  where p.id = p_user_id
  group by
    p.full_name, p.created_at, p.school, p.degree_pursuit, p.graduation_year,
    pd.open_to_networking_chat;
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
  requester_rides_given integer,
  bus_member_count integer,
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
    stats.open_to_networking_chat
  from public.trip_requests tr
  join public.profiles p on p.id = tr.user_id
  left join lateral public.profile_stats(tr.user_id) as stats on true
  where tr.status = 'open'
    and tr.user_id <> auth.uid()
  order by tr.created_at desc;
$$;

grant execute on function public.open_trip_requests() to authenticated;
