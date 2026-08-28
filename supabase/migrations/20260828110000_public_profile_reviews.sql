-- Individual written reviews are now shown on anyone's profile page (was
-- previously aggregate-only). Keeps the same mutual-reveal gate as before
-- — a review only becomes visible once BOTH trip partners have rated each
-- other — just widened from "visible to the trip partner" to "visible to
-- any viewer", since the anti-retaliation purpose was about not seeing
-- your own partner's rating before submitting yours, not about hiding a
-- settled review from the rest of the app. Rater name is redacted to
-- "First L." to match the display convention used everywhere else here.

create function public.profile_reviews(p_user_id uuid)
returns table (
  rater_name text,
  stars integer,
  comment text,
  created_at timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    trim(
      split_part(p.full_name, ' ', 1)
      || case
           when position(' ' in p.full_name) > 0
             then ' ' || left(split_part(p.full_name, ' ', 2), 1) || '.'
           else ''
         end
    ) as rater_name,
    r.stars,
    r.comment,
    r.created_at
  from public.ratings r
  join public.profiles p on p.id = r.rater_id
  where r.ratee_id = p_user_id
    and exists (
      select 1 from public.ratings r2
      where r2.trip_id = r.trip_id
        and r2.rater_id = r.ratee_id
        and r2.ratee_id = r.rater_id
    )
  order by r.created_at desc;
$$;

grant execute on function public.profile_reviews(uuid) to authenticated;
