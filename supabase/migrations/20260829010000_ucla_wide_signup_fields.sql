-- Broadens signup from a narrower .edu-wide check to UCLA specifically
-- (any subdomain: ucla.edu, g.ucla.edu, anderson.ucla.edu, law.ucla.edu,
-- etc.), and adds school/department + degree pursuit fields captured at
-- signup. NOT VALID on the two altered/added check constraints so this
-- doesn't retroactively validate rows that predate it — only inserts and
-- updates going forward are checked against the new rules.

-- =========================================================================
-- UCLA-wide email enforcement (replaces the generic .edu pattern)
-- =========================================================================

create or replace function public.enforce_edu_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email !~* '^[^\s@]+@([a-zA-Z0-9-]+\.)*ucla\.edu$' then
    raise exception 'Signup is restricted to UCLA email addresses';
  end if;
  return new;
end;
$$;

alter table public.profiles drop constraint profiles_school_email_check;

alter table public.profiles
  add constraint profiles_school_email_check
  check (school_email ~* '^[^\s@]+@([a-zA-Z0-9-]+\.)*ucla\.edu$') not valid;

-- =========================================================================
-- School/department + degree pursuit fields
-- =========================================================================

alter table public.profiles
  add column school text,
  add column degree_pursuit text,
  add column graduation_year integer;

alter table public.profiles
  add constraint profiles_school_check
  check (
    school is null or school in (
      'The College (Undergraduate)',
      'Anderson School of Management',
      'David Geffen School of Medicine',
      'Fielding School of Public Health',
      'Henry Samueli School of Engineering and Applied Science',
      'Herb Alpert School of Music',
      'Luskin School of Public Affairs',
      'School of Dentistry',
      'School of Education & Information Studies',
      'School of Law',
      'School of Nursing',
      'School of the Arts and Architecture',
      'School of Theater, Film and Television',
      'Other / Staff'
    )
  ) not valid;

alter table public.profiles
  add constraint profiles_degree_pursuit_check
  check (
    degree_pursuit is null
    or degree_pursuit in ('Undergraduate', 'Master''s', 'MBA', 'PhD', 'Other', 'Alumni')
  ) not valid;

alter table public.profiles
  add constraint profiles_graduation_year_check
  check (
    graduation_year is null
    or graduation_year between 1950 and extract(year from now())::int + 1
  ) not valid;

-- Only meaningful for alumni — required there, not stored otherwise.
alter table public.profiles
  add constraint profiles_graduation_year_requires_alumni
  check (degree_pursuit = 'Alumni' or graduation_year is null) not valid;

-- =========================================================================
-- Capture the new fields at signup (from auth.users.raw_user_meta_data,
-- set via the signUp() call's options.data)
-- =========================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id, full_name, school_email, school, degree_pursuit, graduation_year
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    new.raw_user_meta_data ->> 'school',
    new.raw_user_meta_data ->> 'degree_pursuit',
    nullif(new.raw_user_meta_data ->> 'graduation_year', '')::integer
  );
  return new;
end;
$$;

-- =========================================================================
-- Surface the new fields on profile_stats() for the profile page.
-- Return type change -> drop + recreate, and open_trip_requests() has a
-- hard dependency on profile_stats (it's LANGUAGE SQL, so Postgres
-- resolves the call at creation time), so it has to be dropped first and
-- recreated after, same as the last time this return type changed.
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
  graduation_year integer
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
    p.graduation_year
  from public.profiles p
  left join public.ratings r on r.ratee_id = p.id and r.stars is not null
  where p.id = p_user_id
  group by p.full_name, p.created_at, p.school, p.degree_pursuit, p.graduation_year;
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
