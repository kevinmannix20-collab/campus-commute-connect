-- Phase 4 needs two read paths that the Phase 2 RLS deliberately doesn't
-- allow directly: seeing an *other* user's display name on /browse (for
-- open requests) and on /trips (for a matched counterpart's itinerary).
-- profiles RLS stays locked to "own row only" as specified; these
-- SECURITY DEFINER functions expose only the minimum needed for each
-- feature, scoped with auth.uid() inside the function itself.

-- =========================================================================
-- /browse: open requests from other users, with a redacted display name
-- ("First L.") instead of exposing the full profile.
-- =========================================================================

create function public.open_trip_requests()
returns table (
  id uuid,
  starting_point text,
  destination text,
  requested_time timestamptz,
  mode text,
  created_at timestamptz,
  requester_display_name text
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    tr.id,
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
    ) as requester_display_name
  from public.trip_requests tr
  join public.profiles p on p.id = tr.user_id
  where tr.status = 'open'
    and tr.user_id <> auth.uid()
  order by tr.created_at desc;
$$;

grant execute on function public.open_trip_requests() to authenticated;

-- =========================================================================
-- /trips: the caller's matches, enriched with the counterpart's trip
-- details and display name.
-- =========================================================================

create function public.my_matches()
returns table (
  match_id uuid,
  match_created_at timestamptz,
  my_trip_request_id uuid,
  counterpart_trip_request_id uuid,
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
    m.created_at as match_created_at,
    case when tr_a.user_id = auth.uid() then tr_a.id else tr_b.id end,
    case when tr_a.user_id = auth.uid() then tr_b.id else tr_a.id end,
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

-- =========================================================================
-- Realtime: let /browse update live as new requests come in.
-- =========================================================================

alter publication supabase_realtime add table public.trip_requests;
