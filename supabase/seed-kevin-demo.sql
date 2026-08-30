-- Seed data for Kevin's 90-second screen-recorded demo. Creates four fake
-- UCLA Anderson MBA students (same school as Kevin, so the browse feed's
-- "same school" highlight shows too) with a mix of pre-existing activity
-- plus fresh open posts, so the demo has both "look, activity already
-- exists" moments and "watch this happen live" moments:
--
--   Maya Chen    (demo-kevin-maya@ucla.edu)   — open BUS post, for Kevin
--                to join live on camera.
--   Jordan Park  (demo-kevin-jordan@ucla.edu) — open CAR "need a ride"
--                post, for Kevin to click "Offer a Ride" on live.
--   Priya Patel  (demo-kevin-priya@ucla.edu)  — already matched with
--                Kevin (upcoming car ride), with a short message thread
--                ending on an unread message from her — open Messages,
--                the badge is already lit, reply live.
--   Ben Torres   (demo-kevin-ben@ucla.edu)    — already matched with
--                Kevin on a COMPLETED past trip, and already left Kevin a
--                5-star review. Kevin hasn't rated him back yet — submit
--                a rating live from Kevin's own profile's Trip History.
--                Note: reviews only reveal once BOTH sides have rated
--                (same rule as the public Reviews section), so Ben's
--                review is invisible until Kevin submits his — a nice
--                "unlocks on camera" moment.
--
-- Run manually in the Supabase SQL editor. Idempotent — safe to re-run
-- before every take; re-running refreshes all the timestamps to stay
-- relative to "now" so nothing looks stale on a later recording.
--
-- To remove all of it afterward:
--   delete from auth.users where email like 'demo-kevin-%@ucla.edu';
--   delete from public.trip_requests where id in (
--     'e2000000-0000-0000-0000-000000000003', 'e2000000-0000-0000-0000-000000000004',
--     'e2000000-0000-0000-0000-000000000005', 'e2000000-0000-0000-0000-000000000006'
--   );
-- (the two open posts for Maya/Jordan clean up on their own via the
-- auth.users cascade; Kevin's own paired trip_requests for the Priya/Ben
-- matches don't, since Kevin's account isn't being deleted.)

begin;

-- ---------------------------------------------------------------------
-- Clean slate: safe to re-run.
-- ---------------------------------------------------------------------
delete from public.matches where id in (
  'e3000000-0000-0000-0000-000000000001', 'e3000000-0000-0000-0000-000000000002'
);
delete from public.trip_requests where id in (
  'e2000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000002',
  'e2000000-0000-0000-0000-000000000003', 'e2000000-0000-0000-0000-000000000004',
  'e2000000-0000-0000-0000-000000000005', 'e2000000-0000-0000-0000-000000000006'
);
delete from auth.users where email like 'demo-kevin-%@ucla.edu';

-- ---------------------------------------------------------------------
-- Four fake UCLA Anderson MBA students (same pattern as
-- seed-demo-profiles.sql: insert auth.users + auth.identities directly,
-- bypassing signup; public.profiles is auto-created by the
-- handle_new_user trigger from raw_user_meta_data).
-- ---------------------------------------------------------------------
with new_users (id, email, full_name) as (
  values
    ('e1000000-0000-0000-0000-000000000001'::uuid, 'demo-kevin-maya@ucla.edu', 'Maya Chen'),
    ('e1000000-0000-0000-0000-000000000002'::uuid, 'demo-kevin-jordan@ucla.edu', 'Jordan Park'),
    ('e1000000-0000-0000-0000-000000000003'::uuid, 'demo-kevin-priya@ucla.edu', 'Priya Patel'),
    ('e1000000-0000-0000-0000-000000000004'::uuid, 'demo-kevin-ben@ucla.edu', 'Ben Torres')
)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
)
select
  '00000000-0000-0000-0000-000000000000',
  id,
  'authenticated',
  'authenticated',
  email,
  crypt('DemoPass123!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  jsonb_build_object(
    'full_name', full_name,
    'school', 'Anderson School of Management',
    'degree_pursuit', 'MBA'
  ),
  now(), now(), '', '', '', ''
from new_users;

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(),
  id,
  id::text,
  jsonb_build_object('sub', id::text, 'email', email),
  'email',
  now(), now(), now()
from auth.users
where email like 'demo-kevin-%@ucla.edu';

-- ---------------------------------------------------------------------
-- Maya: open bus post, requested a few hours out — join it live.
-- ---------------------------------------------------------------------
insert into public.trip_requests (
  id, user_id, starting_point, destination, requested_time, mode, post_type, status,
  starting_point_lat, starting_point_lng, destination_lat, destination_lng
) values (
  'e2000000-0000-0000-0000-000000000001',
  'e1000000-0000-0000-0000-000000000001',
  'UCLA Anderson School of Management', 'Santa Monica Pier',
  now() + interval '3 hours', 'bus', 'need', 'open',
  34.0722, -118.4441, 34.0100, -118.4963
);

-- ---------------------------------------------------------------------
-- Jordan: open car "need a ride" post — click "Offer a Ride" on it live.
-- ---------------------------------------------------------------------
insert into public.trip_requests (
  id, user_id, starting_point, destination, requested_time, mode, post_type, status,
  starting_point_lat, starting_point_lng, destination_lat, destination_lng
) values (
  'e2000000-0000-0000-0000-000000000002',
  'e1000000-0000-0000-0000-000000000002',
  'UCLA Anderson School of Management', 'Culver City',
  now() + interval '2 hours', 'car', 'need', 'open',
  34.0722, -118.4441, 34.0211, -118.3965
);

-- ---------------------------------------------------------------------
-- Priya: already-matched upcoming car ride with Kevin, plus a message
-- thread ending unread — open Messages and reply live.
-- ---------------------------------------------------------------------
insert into public.trip_requests (
  id, user_id, starting_point, destination, requested_time, mode, post_type, status,
  starting_point_lat, starting_point_lng, destination_lat, destination_lng
) values (
  'e2000000-0000-0000-0000-000000000003',
  'e1000000-0000-0000-0000-000000000003',
  'UCLA Anderson School of Management', 'Santa Monica Pier',
  now() + interval '5 hours', 'car', 'need', 'matched',
  34.0722, -118.4441, 34.0100, -118.4963
);
insert into public.trip_requests (
  id, user_id, starting_point, destination, requested_time, mode, post_type, status,
  starting_point_lat, starting_point_lng, destination_lat, destination_lng
) values (
  'e2000000-0000-0000-0000-000000000004',
  '6a24061d-3e2a-4a36-8735-3e904df8dfc9',
  'UCLA Anderson School of Management', 'Santa Monica Pier',
  now() + interval '5 hours', 'car', 'offer', 'matched',
  34.0722, -118.4441, 34.0100, -118.4963
);
insert into public.matches (id, trip_request_id_a, trip_request_id_b, status, driver_user_id, created_at) values (
  'e3000000-0000-0000-0000-000000000001',
  'e2000000-0000-0000-0000-000000000004', 'e2000000-0000-0000-0000-000000000003',
  'active', '6a24061d-3e2a-4a36-8735-3e904df8dfc9', now() - interval '1 hour'
);
insert into public.messages (match_id, sender_id, body, created_at) values
  (
    'e3000000-0000-0000-0000-000000000001', '6a24061d-3e2a-4a36-8735-3e904df8dfc9',
    'Hey Priya! Looks like we''re both headed to Santa Monica later — I can swing by Anderson around 5:30, does that work?',
    now() - interval '25 minutes'
  ),
  (
    'e3000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000003',
    'That works perfectly! I''ll be right outside the entrance.',
    now() - interval '20 minutes'
  ),
  (
    'e3000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000003',
    'Also — mind if I bring my roommate? She''s headed the same way :)',
    now() - interval '4 minutes'
  );

-- ---------------------------------------------------------------------
-- Ben: completed past trip with Kevin, already left a 5-star review —
-- submit Kevin's rating live from Profile > Trip History to reveal it.
-- ---------------------------------------------------------------------
insert into public.trip_requests (
  id, user_id, starting_point, destination, requested_time, mode, post_type, status,
  starting_point_lat, starting_point_lng, destination_lat, destination_lng
) values (
  'e2000000-0000-0000-0000-000000000005',
  'e1000000-0000-0000-0000-000000000004',
  'UCLA Anderson School of Management', 'LAX Airport',
  now() - interval '2 days', 'car', 'need', 'matched',
  34.0722, -118.4441, 33.9416, -118.4085
);
insert into public.trip_requests (
  id, user_id, starting_point, destination, requested_time, mode, post_type, status,
  starting_point_lat, starting_point_lng, destination_lat, destination_lng
) values (
  'e2000000-0000-0000-0000-000000000006',
  '6a24061d-3e2a-4a36-8735-3e904df8dfc9',
  'UCLA Anderson School of Management', 'LAX Airport',
  now() - interval '2 days', 'car', 'offer', 'matched',
  34.0722, -118.4441, 33.9416, -118.4085
);
insert into public.matches (id, trip_request_id_a, trip_request_id_b, status, driver_user_id, created_at, completed_at, completed_by) values (
  'e3000000-0000-0000-0000-000000000002',
  'e2000000-0000-0000-0000-000000000006', 'e2000000-0000-0000-0000-000000000005',
  'completed', '6a24061d-3e2a-4a36-8735-3e904df8dfc9',
  now() - interval '2 days', now() - interval '1 day', 'e1000000-0000-0000-0000-000000000004'
);
insert into public.ratings (trip_id, rater_id, ratee_id, stars, comment, created_at) values (
  'e3000000-0000-0000-0000-000000000002',
  'e1000000-0000-0000-0000-000000000004', '6a24061d-3e2a-4a36-8735-3e904df8dfc9',
  5, 'Kevin was super easy to coordinate with and got us to LAX with time to spare. Would ride with him again!',
  now() - interval '20 hours'
);

commit;
