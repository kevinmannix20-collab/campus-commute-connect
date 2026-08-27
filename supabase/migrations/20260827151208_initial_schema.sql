-- Commute Mate: initial schema (profiles, trip_requests, matches) + RLS

-- =========================================================================
-- Tables
-- =========================================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  school_email text not null unique check (school_email ~* '^[^@\s]+@[^@\s]+\.edu$'),
  created_at timestamptz not null default now()
);

create table public.trip_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  starting_point text not null,
  destination text not null,
  requested_time timestamptz not null,
  mode text not null check (mode in ('bus', 'car')),
  status text not null default 'open' check (status in ('open', 'matched', 'cancelled')),
  created_at timestamptz not null default now()
);

create index trip_requests_status_idx on public.trip_requests (status);
create index trip_requests_user_id_idx on public.trip_requests (user_id);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  trip_request_id_a uuid not null references public.trip_requests (id) on delete cascade,
  trip_request_id_b uuid not null references public.trip_requests (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint matches_distinct_requests check (trip_request_id_a <> trip_request_id_b)
);

create index matches_trip_request_id_a_idx on public.matches (trip_request_id_a);
create index matches_trip_request_id_b_idx on public.matches (trip_request_id_b);

-- =========================================================================
-- Row Level Security
-- =========================================================================

alter table public.profiles enable row level security;
alter table public.trip_requests enable row level security;
alter table public.matches enable row level security;

-- profiles: a user can read/update only their own row.
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Fallback path in case a client ever needs to create its own profile row
-- directly (normal signups go through handle_new_user() below instead).
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

-- trip_requests: any authenticated user can insert a row for themselves;
-- open rows are browsable by everyone, owners can also see their own
-- rows regardless of status (needed for the /trips page); only the
-- owner can update/cancel their own row.
create policy "trip_requests_insert_own"
  on public.trip_requests for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "trip_requests_select_open_or_own"
  on public.trip_requests for select
  to authenticated
  using (status = 'open' or user_id = auth.uid());

create policy "trip_requests_update_own"
  on public.trip_requests for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- matches: only the two participating users can read a match row.
-- There is deliberately no insert/update/delete policy here for the
-- authenticated role — matches are created via create_match() below,
-- which runs as SECURITY DEFINER after validating both sides.
create policy "matches_select_participant"
  on public.matches for select
  to authenticated
  using (
    exists (
      select 1
      from public.trip_requests tr
      where tr.id in (matches.trip_request_id_a, matches.trip_request_id_b)
        and tr.user_id = auth.uid()
    )
  );

-- =========================================================================
-- .edu signup enforcement (real, server-side — not just client-side UX)
-- =========================================================================

create function public.enforce_edu_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email !~* '^[^@\s]+@[^@\s]+\.edu$' then
    raise exception 'Signup is restricted to .edu email addresses';
  end if;
  return new;
end;
$$;

create trigger enforce_edu_email_before_insert
  before insert on auth.users
  for each row
  execute function public.enforce_edu_email();

-- =========================================================================
-- Auto-create a profile row whenever a new auth user is created
-- =========================================================================

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, school_email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- =========================================================================
-- Matching: the only supported way to create a match, since RLS above
-- does not let one user update another user's trip_requests row directly.
-- Validates the caller owns one side, both requests are open and
-- distinct, then atomically marks both matched and records the match.
-- =========================================================================

create function public.create_match(request_a uuid, request_b uuid)
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
  result public.matches;
begin
  if request_a = request_b then
    raise exception 'Cannot match a trip request with itself';
  end if;

  select user_id, status into owner_a, status_a
  from public.trip_requests where id = request_a for update;

  select user_id, status into owner_b, status_b
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

  insert into public.matches (trip_request_id_a, trip_request_id_b)
  values (request_a, request_b)
  returning * into result;

  return result;
end;
$$;

grant execute on function public.create_match(uuid, uuid) to authenticated;
