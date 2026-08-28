-- messages' match-thread participancy check joined trip_requests twice
-- (tr_a and tr_b) and required *both* to be visible to satisfy the
-- exists — but trip_requests' own RLS only shows a user their own row
-- once it's no longer 'open' (matches_select_participant hits the same
-- shape and avoids it: it checks `tr.id in (id_a, id_b) and tr.user_id
-- = auth.uid()` against a single trip_requests reference, which only
-- ever needs the caller's *own* row to be visible — always true for
-- your own row regardless of status). Re-point messages at that same
-- pattern instead of the two-way join.

drop policy "messages_select_participant" on public.messages;
drop policy "messages_insert_participant" on public.messages;

create policy "messages_select_participant"
  on public.messages for select
  to authenticated
  using (
    (
      match_id is not null
      and exists (
        select 1 from public.trip_requests tr
        join public.matches m on tr.id in (m.trip_request_id_a, m.trip_request_id_b)
        where m.id = messages.match_id and tr.user_id = auth.uid()
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
          select 1 from public.trip_requests tr
          join public.matches m on tr.id in (m.trip_request_id_a, m.trip_request_id_b)
          where m.id = messages.match_id and tr.user_id = auth.uid()
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
