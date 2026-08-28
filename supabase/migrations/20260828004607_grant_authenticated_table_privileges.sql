-- The Phase 2 migration created RLS policies but never granted the
-- underlying table-level privileges to the authenticated role. RLS only
-- narrows which *rows* a role can touch — the role still needs a base
-- GRANT before it's allowed to attempt the operation at all. Caught by
-- testing an actual authenticated insert end-to-end, not just confirming
-- anon gets refused (which passes trivially with zero grants either way).

grant select, update, insert on public.profiles to authenticated;
grant select, insert, update on public.trip_requests to authenticated;
grant select on public.matches to authenticated;
