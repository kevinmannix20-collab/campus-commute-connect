-- Resolves every participant's redacted display name for a message
-- thread (a match's two sides, or a bus group's poster + members) —
-- needed to label senders in the messages UI, since a bus group thread
-- can have more than the two people the existing my_matches() /
-- my_bus_groups() "counterpart" framing assumes. Validates the caller is
-- actually a participant before returning anything.

create function public.thread_participants(p_thread_type text, p_thread_id uuid)
returns table (user_id uuid, display_name text)
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if p_thread_type = 'match' then
    if not exists (
      select 1
      from public.matches m
      join public.trip_requests tr_a on tr_a.id = m.trip_request_id_a
      join public.trip_requests tr_b on tr_b.id = m.trip_request_id_b
      where m.id = p_thread_id
        and (tr_a.user_id = auth.uid() or tr_b.user_id = auth.uid())
    ) then
      raise exception 'Not authorized';
    end if;

    return query
      select distinct p.id, trim(
        split_part(p.full_name, ' ', 1)
        || case
             when position(' ' in p.full_name) > 0
               then ' ' || left(split_part(p.full_name, ' ', 2), 1) || '.'
             else ''
           end
      )
      from public.matches m
      join public.trip_requests tr_a on tr_a.id = m.trip_request_id_a
      join public.trip_requests tr_b on tr_b.id = m.trip_request_id_b
      join public.profiles p on p.id in (tr_a.user_id, tr_b.user_id)
      where m.id = p_thread_id;

  elsif p_thread_type = 'bus' then
    if not exists (
      select 1 from public.trip_requests tr
      where tr.id = p_thread_id and tr.user_id = auth.uid()
    ) and not exists (
      select 1 from public.bus_group_members bgm
      where bgm.trip_request_id = p_thread_id and bgm.user_id = auth.uid()
    ) then
      raise exception 'Not authorized';
    end if;

    return query
      select p.id, trim(
        split_part(p.full_name, ' ', 1)
        || case
             when position(' ' in p.full_name) > 0
               then ' ' || left(split_part(p.full_name, ' ', 2), 1) || '.'
             else ''
           end
      )
      from public.trip_requests tr
      join public.profiles p on p.id = tr.user_id
      where tr.id = p_thread_id
      union
      select p2.id, trim(
        split_part(p2.full_name, ' ', 1)
        || case
             when position(' ' in p2.full_name) > 0
               then ' ' || left(split_part(p2.full_name, ' ', 2), 1) || '.'
             else ''
           end
      )
      from public.bus_group_members bgm
      join public.profiles p2 on p2.id = bgm.user_id
      where bgm.trip_request_id = p_thread_id;
  else
    raise exception 'Invalid thread type: %', p_thread_type;
  end if;
end;
$$;

grant execute on function public.thread_participants(text, uuid) to authenticated;
