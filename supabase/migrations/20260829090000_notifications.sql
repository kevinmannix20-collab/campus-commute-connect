-- Notification feed + message inbox: a single "you got a match" / "new
-- message" / "someone joined your bus" activity stream (Uber-style
-- ride-activity feed), plus a thread list so /messages can show every
-- conversation instead of only being reachable via a specific
-- match/bus link from Status.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('match', 'message', 'bus_join')),
  match_id uuid references public.matches (id) on delete cascade,
  bus_trip_request_id uuid references public.trip_requests (id) on delete cascade,
  message_id uuid references public.messages (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index notifications_user_id_created_at_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

create policy "notifications_select_own"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

create policy "notifications_update_own"
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, update on public.notifications to authenticated;

-- notify_on_match: fires after a car match or bus pairing is created,
-- notifying both sides. SECURITY DEFINER because the inserting role
-- (authenticated, via create_match) has no INSERT policy here — all
-- writes to notifications are trigger-driven, never client-direct.

create function public.notify_on_match()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_a uuid;
  owner_b uuid;
begin
  select user_id into owner_a from public.trip_requests where id = new.trip_request_id_a;
  select user_id into owner_b from public.trip_requests where id = new.trip_request_id_b;

  insert into public.notifications (user_id, type, match_id, actor_id)
  values
    (owner_a, 'match', new.id, owner_b),
    (owner_b, 'match', new.id, owner_a);

  return new;
end;
$$;

create trigger trg_notify_on_match
  after insert on public.matches
  for each row
  execute function public.notify_on_match();

-- notify_on_message: fires after any chat message, notifying every other
-- participant in that thread (the other match side, or the bus roster).

create function public.notify_on_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.match_id is not null then
    insert into public.notifications (user_id, type, match_id, message_id, actor_id)
    select tr.user_id, 'message', new.match_id, new.id, new.sender_id
    from public.matches m
    join public.trip_requests tr on tr.id in (m.trip_request_id_a, m.trip_request_id_b)
    where m.id = new.match_id
      and tr.user_id <> new.sender_id;
  else
    insert into public.notifications (user_id, type, bus_trip_request_id, message_id, actor_id)
    select roster.recipient, 'message', new.bus_trip_request_id, new.id, new.sender_id
    from (
      select tr.user_id as recipient from public.trip_requests tr where tr.id = new.bus_trip_request_id
      union
      select bgm.user_id from public.bus_group_members bgm where bgm.trip_request_id = new.bus_trip_request_id
    ) roster
    where roster.recipient <> new.sender_id;
  end if;

  return new;
end;
$$;

create trigger trg_notify_on_message
  after insert on public.messages
  for each row
  execute function public.notify_on_message();

-- notify_on_bus_join: tells the host when someone joins their bus post.

create function public.notify_on_bus_join()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  host uuid;
begin
  select user_id into host from public.trip_requests where id = new.trip_request_id;

  if host is not null and host <> new.user_id then
    insert into public.notifications (user_id, type, bus_trip_request_id, actor_id)
    values (host, 'bus_join', new.trip_request_id, new.user_id);
  end if;

  return new;
end;
$$;

create trigger trg_notify_on_bus_join
  after insert on public.bus_group_members
  for each row
  execute function public.notify_on_bus_join();

-- my_notifications: the activity feed, newest first, with the actor's
-- redacted display name and a ready-to-render message preview.

create function public.my_notifications()
returns table (
  id uuid,
  type text,
  match_id uuid,
  bus_trip_request_id uuid,
  actor_display_name text,
  preview text,
  created_at timestamptz,
  read_at timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    n.id,
    n.type,
    n.match_id,
    n.bus_trip_request_id,
    trim(
      split_part(p.full_name, ' ', 1)
      || case
           when position(' ' in p.full_name) > 0
             then ' ' || left(split_part(p.full_name, ' ', 2), 1) || '.'
           else ''
         end
    ) as actor_display_name,
    case
      when n.type = 'message' then left(m.body, 80)
      else null
    end as preview,
    n.created_at,
    n.read_at
  from public.notifications n
  left join public.profiles p on p.id = n.actor_id
  left join public.messages m on m.id = n.message_id
  where n.user_id = auth.uid()
  order by n.created_at desc
  limit 50;
$$;

grant execute on function public.my_notifications() to authenticated;

create function public.mark_all_notifications_read()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notifications
  set read_at = now()
  where user_id = auth.uid() and read_at is null;
$$;

grant execute on function public.mark_all_notifications_read() to authenticated;

create function public.mark_thread_notifications_read(p_thread_type text, p_thread_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notifications
  set read_at = now()
  where user_id = auth.uid()
    and read_at is null
    and (
      (p_thread_type = 'match' and match_id = p_thread_id)
      or (p_thread_type = 'bus' and bus_trip_request_id = p_thread_id)
    );
$$;

grant execute on function public.mark_thread_notifications_read(text, uuid) to authenticated;

-- my_message_threads: every conversation the caller belongs to (matches
-- and bus groups both), with a title, last message preview, and unread
-- count — the "Chats" list for the /messages inbox.

create function public.my_message_threads()
returns table (
  thread_type text,
  thread_id uuid,
  title text,
  last_message_body text,
  last_message_at timestamptz,
  unread_count integer
)
language sql
security definer
set search_path = ''
stable
as $$
  with match_threads as (
    select
      'match'::text as thread_type,
      m.id as thread_id,
      trim(
        split_part(p.full_name, ' ', 1)
        || case
             when position(' ' in p.full_name) > 0
               then ' ' || left(split_part(p.full_name, ' ', 2), 1) || '.'
             else ''
           end
      ) as title
    from public.matches m
    join public.trip_requests tr_mine on tr_mine.id in (m.trip_request_id_a, m.trip_request_id_b)
      and tr_mine.user_id = auth.uid()
    join public.trip_requests tr_other on tr_other.id in (m.trip_request_id_a, m.trip_request_id_b)
      and tr_other.id <> tr_mine.id
    join public.profiles p on p.id = tr_other.user_id
  ),
  bus_threads as (
    select 'bus'::text as thread_type, tr.id as thread_id, 'Bus Group to ' || tr.destination as title
    from public.trip_requests tr
    where tr.mode = 'bus'
      and (
        tr.user_id = auth.uid()
        or exists (
          select 1 from public.bus_group_members bgm
          where bgm.trip_request_id = tr.id and bgm.user_id = auth.uid()
        )
      )
  ),
  all_threads as (
    select * from match_threads
    union all
    select * from bus_threads
  )
  select
    t.thread_type,
    t.thread_id,
    t.title,
    last_msg.body as last_message_body,
    last_msg.created_at as last_message_at,
    (
      select count(*)::integer from public.notifications n
      where n.user_id = auth.uid()
        and n.read_at is null
        and (
          (t.thread_type = 'match' and n.match_id = t.thread_id)
          or (t.thread_type = 'bus' and n.bus_trip_request_id = t.thread_id)
        )
    ) as unread_count
  from all_threads t
  left join lateral (
    select msg.body, msg.created_at
    from public.messages msg
    where (t.thread_type = 'match' and msg.match_id = t.thread_id)
       or (t.thread_type = 'bus' and msg.bus_trip_request_id = t.thread_id)
    order by msg.created_at desc
    limit 1
  ) last_msg on true
  order by last_msg.created_at desc nulls last;
$$;

grant execute on function public.my_message_threads() to authenticated;

alter publication supabase_realtime add table public.notifications;
