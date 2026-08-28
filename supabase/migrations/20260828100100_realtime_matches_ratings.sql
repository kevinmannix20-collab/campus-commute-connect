-- The existing /trips subscription listens for postgres_changes on
-- `matches`, but matches was never added to the supabase_realtime
-- publication (only trip_requests was, in the previous migration) — so
-- that listener has been a silent no-op. Fixing it here since the new
-- completion/rating flow depends on it, and adding `ratings` for the
-- same reason (live-unlocking a mutually-revealed review).

alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.ratings;
