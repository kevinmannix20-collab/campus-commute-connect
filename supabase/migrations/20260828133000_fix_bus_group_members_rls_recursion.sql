-- bus_group_members_select_participant's third clause queried
-- bus_group_members from within its own RLS policy (to let a member see
-- their fellow members' rows) — Postgres re-applies the same policy to
-- evaluate that subquery, which re-triggers the same subquery, and so on:
-- "infinite recursion detected in policy for relation bus_group_members".
--
-- Nothing in the app needs direct table access to see *other* members'
-- rows — the roster is always read via my_bus_groups(), a SECURITY
-- DEFINER function that bypasses RLS entirely. What does need to keep
-- working is other tables' policies (messages) checking "is the caller
-- a member" via `bgm.user_id = auth.uid()`, which only needs the first
-- clause below — no self-reference, no recursion.

drop policy "bus_group_members_select_participant" on public.bus_group_members;

create policy "bus_group_members_select_participant"
  on public.bus_group_members for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.trip_requests tr
      where tr.id = bus_group_members.trip_request_id and tr.user_id = auth.uid()
    )
  );
