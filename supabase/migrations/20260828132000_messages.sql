-- In-app messaging for both thread kinds: 1-on-1 matches (car rides and
-- paired bus buddies) and bus groups. Two nullable FKs + a check
-- constraint instead of a polymorphic reference, so RLS stays plain
-- `exists` clauses.
--
-- Unlike matches/ratings/bus_group_members, this table gets ordinary RLS
-- select/insert policies (not just RPC-gated mutation) because Realtime
-- authorizes each row against the subscriber's RLS visibility — a
-- table only reachable through a SECURITY DEFINER function can't be
-- safely subscribed to per-thread.

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references public.matches (id) on delete cascade,
  bus_trip_request_id uuid references public.trip_requests (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0 and char_length(body) <= 2000),
  created_at timestamptz not null default now(),
  constraint messages_exactly_one_thread check (
    (match_id is not null and bus_trip_request_id is null)
    or (match_id is null and bus_trip_request_id is not null)
  )
);

create index messages_match_id_idx on public.messages (match_id, created_at);
create index messages_bus_trip_request_id_idx on public.messages (bus_trip_request_id, created_at);

alter table public.messages enable row level security;

create policy "messages_select_participant"
  on public.messages for select
  to authenticated
  using (
    (
      match_id is not null
      and exists (
        select 1
        from public.matches m
        join public.trip_requests tr_a on tr_a.id = m.trip_request_id_a
        join public.trip_requests tr_b on tr_b.id = m.trip_request_id_b
        where m.id = messages.match_id
          and (tr_a.user_id = auth.uid() or tr_b.user_id = auth.uid())
      )
    )
    or (
      bus_trip_request_id is not null
      and (
        exists (
          select 1 from public.trip_requests tr
          where tr.id = messages.bus_trip_request_id and tr.user_id = auth.uid()
        )
        or exists (
          select 1 from public.bus_group_members bgm
          where bgm.trip_request_id = messages.bus_trip_request_id and bgm.user_id = auth.uid()
        )
      )
    )
  );

create policy "messages_insert_participant"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and (
      (
        match_id is not null
        and exists (
          select 1
          from public.matches m
          join public.trip_requests tr_a on tr_a.id = m.trip_request_id_a
          join public.trip_requests tr_b on tr_b.id = m.trip_request_id_b
          where m.id = messages.match_id
            and (tr_a.user_id = auth.uid() or tr_b.user_id = auth.uid())
        )
      )
      or (
        bus_trip_request_id is not null
        and (
          exists (
            select 1 from public.trip_requests tr
            where tr.id = messages.bus_trip_request_id and tr.user_id = auth.uid()
          )
          or exists (
            select 1 from public.bus_group_members bgm
            where bgm.trip_request_id = messages.bus_trip_request_id and bgm.user_id = auth.uid()
          )
        )
      )
    )
  );

grant select, insert on public.messages to authenticated;

alter publication supabase_realtime add table public.messages;
