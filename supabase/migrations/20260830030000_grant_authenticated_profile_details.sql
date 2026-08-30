-- profile_details (added in profile_enrichment_details.sql) got RLS
-- policies for the authenticated role but never the underlying
-- table-level GRANT — RLS only narrows which *rows* a role can touch,
-- the role still needs a base privilege before it's allowed to attempt
-- the operation at all (same class of bug as
-- grant_authenticated_table_privileges.sql, and as the service_role gap
-- fixed in grant_service_role_profile_details.sql). This is why saving
-- the Edit Profile enrichment fields has been failing end-to-end with
-- "permission denied for table profile_details" (Postgres 42501).

grant select, insert, update on public.profile_details to authenticated;
