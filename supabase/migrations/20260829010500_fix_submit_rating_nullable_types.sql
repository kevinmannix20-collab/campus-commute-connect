-- submit_rating has always accepted NULL for p_stars/p_comment at runtime
-- (its body checks "if p_stars is not null" — see trip_completion_and_ratings
-- migration), but the parameters were declared without "default null", so
-- `supabase gen types` infers them as non-nullable. Regenerating types for
-- the UCLA signup fields surfaced this mismatch as a genuine compile error
-- in RatingForm.tsx. No behavior change, just declaring the defaults that
-- were already implicitly supported so generated types match reality.

create or replace function public.submit_rating(
  p_trip_id uuid,
  p_stars integer default null,
  p_comment text default null
)
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
