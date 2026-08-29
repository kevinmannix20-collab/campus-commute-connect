-- profile_details (added in profile_enrichment_details.sql) never got a
-- table-level GRANT for service_role — RLS only narrows which *rows* a
-- role can see, the role still needs a base privilege before it's allowed
-- to attempt the operation at all (same class of bug already documented
-- in grant_authenticated_table_privileges.sql for an earlier table).
-- service_role normally bypasses RLS by design, but still hit "permission
-- denied for table profile_details" (Postgres error 42501) from the
-- rank-matches edge function, which reads other users' profile_details
-- with the service-role key specifically because RLS blocks the
-- authenticated role from seeing anyone else's row.

grant select on public.profile_details to service_role;
