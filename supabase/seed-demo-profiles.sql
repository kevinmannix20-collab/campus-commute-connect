-- Demo seed data for exercising the AI match-ranking layer without manual
-- data entry. No seed mechanism existed in this repo before this file —
-- run manually against a sandbox project with:
--   npx supabase db query -f supabase/seed-demo-profiles.sql --linked
-- (or paste into the Supabase SQL editor). NEVER run against production.
--
-- Idempotent: deletes any previous demo-*@ucla.edu accounts first, so this
-- can be re-run freely. Creates auth.users directly (bypassing the normal
-- signup flow) since there's no scripted way to drive real signup — this
-- mirrors the standard Supabase local-seed pattern (pgcrypto + auth.identities).
--
-- Password for every seed account: DemoPass123!
--
-- Accounts:
--   demo-viewer@ucla.edu   — the "browsing" test account (has its own
--                            rich profile so the AI has real overlap to find)
--   demo-alex@ucla.edu     — rich profile, shares hobbies + target field
--                            with demo-viewer and demo-brianna
--   demo-brianna@ucla.edu  — rich profile, shares hobbies + target field
--                            with demo-alex
--   demo-carlos@ucla.edu   — rich profile, no overlap with the above two
--                            (different hobbies/field) — exercises the
--                            "neutral, no forced connection" reason case
--   demo-dana@ucla.edu     — no profile_details row at all (never touched
--                            the enrichment form) — fallback case
--   demo-evan@ucla.edu     — profile_details row exists but only
--                            open_to_networking_chat is set — fallback case

begin;

delete from auth.users where email like 'demo-%@ucla.edu';

with new_users (id, email, full_name, school, degree_pursuit) as (
  values
    ('d0000000-0000-0000-0000-000000000001'::uuid, 'demo-viewer@ucla.edu', 'Viewer Test', 'Anderson School of Management', 'MBA'),
    ('d0000000-0000-0000-0000-000000000002'::uuid, 'demo-alex@ucla.edu', 'Alex Rivera', 'Henry Samueli School of Engineering and Applied Science', 'Master''s'),
    ('d0000000-0000-0000-0000-000000000003'::uuid, 'demo-brianna@ucla.edu', 'Brianna Chen', 'Henry Samueli School of Engineering and Applied Science', 'Master''s'),
    ('d0000000-0000-0000-0000-000000000004'::uuid, 'demo-carlos@ucla.edu', 'Carlos Mendoza', 'The College (Undergraduate)', 'Undergraduate'),
    ('d0000000-0000-0000-0000-000000000005'::uuid, 'demo-dana@ucla.edu', 'Dana Kim', 'School of Law', 'PhD'),
    ('d0000000-0000-0000-0000-000000000006'::uuid, 'demo-evan@ucla.edu', 'Evan Wright', 'David Geffen School of Medicine', 'Undergraduate')
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
  jsonb_build_object('full_name', full_name, 'school', school, 'degree_pursuit', degree_pursuit),
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
where email like 'demo-%@ucla.edu';

-- profiles rows already exist here via the on_auth_user_created trigger.

-- Rich profile_details: viewer, alex, brianna share Hiking/Outdoors +
-- Tech/Engineering so the AI has real, specific overlap to reference.
-- carlos deliberately shares nothing with them (different hobbies, field,
-- music) to exercise the neutral/no-forced-connection reason case.
insert into public.profile_details (
  user_id, music_preference, conversation_style, temperature_preference,
  fragrance_free_preferred, pet_preference, ok_with_food_drink, hometown,
  languages_spoken, hobbies, target_field, dream_role_or_company,
  open_to_networking_chat, fun_fact
) values
  (
    'd0000000-0000-0000-0000-000000000001',
    array['Rock/Indie', 'Podcasts'], 'Love to chat', 'No preference',
    false, 'Pet-friendly', true, 'Seattle',
    'English, Spanish', array['Hiking/Outdoors', 'Reading'], 'Tech/Engineering',
    'PM at a climate-tech startup', true, 'I''ve run 3 marathons'
  ),
  (
    'd0000000-0000-0000-0000-000000000002',
    array['Rock/Indie', 'Podcasts'], 'Love to chat', 'No preference',
    false, 'Pet-friendly', true, 'Denver',
    'English', array['Hiking/Outdoors', 'Reading'], 'Tech/Engineering',
    'PM at Google', true, 'I''ve summited three 14ers'
  ),
  (
    'd0000000-0000-0000-0000-000000000003',
    array['EDM/Electronic', 'Rock/Indie'], 'Depends on my mood', 'Runs cold (likes heat)',
    true, 'No preference', false, 'Austin',
    'English, Mandarin', array['Hiking/Outdoors', 'Gaming/Art'], 'Tech/Engineering',
    'Own a robotics startup', true, 'I can solve a Rubik''s cube in under a minute'
  ),
  (
    'd0000000-0000-0000-0000-000000000004',
    array['Pop', 'Hip-Hop/R&B'], 'Love to chat', 'Runs hot (likes AC)',
    false, 'Pet-friendly', true, 'Miami',
    'English, Spanish, Portuguese', array['Cooking/Food', 'Travel'], 'Business/Consulting',
    'Consulting at a top-3 firm', false, 'I once met a president'
  ),
  -- evan: exists, but only one field ever filled in.
  (
    'd0000000-0000-0000-0000-000000000006',
    '{}', null, null, null, null, null, null,
    null, '{}', null, null, true, null
  );
-- dana: no profile_details row at all — never opened the enrichment form.

-- Trip requests: everyone posts something for tomorrow evening, so a
-- viewer browsing right after seeding sees all of them as open candidates.
insert into public.trip_requests (
  user_id, starting_point, destination, requested_time, mode,
  starting_point_lat, starting_point_lng, destination_lat, destination_lng
) values
  (
    'd0000000-0000-0000-0000-000000000002', 'UCLA Anderson School of Management', 'LAX Airport',
    (current_date + interval '1 day' + interval '18 hour'), 'car',
    34.0722, -118.4441, 33.9416, -118.4085
  ),
  (
    'd0000000-0000-0000-0000-000000000003', 'UCLA Anderson School of Management', 'LAX Airport',
    (current_date + interval '1 day' + interval '18 hour'), 'car',
    34.0722, -118.4441, 33.9416, -118.4085
  ),
  (
    'd0000000-0000-0000-0000-000000000004', 'UCLA Anderson School of Management', 'Santa Monica Pier',
    (current_date + interval '1 day' + interval '19 hour'), 'bus',
    34.0722, -118.4441, 34.0100, -118.4963
  ),
  (
    'd0000000-0000-0000-0000-000000000005', 'UCLA Anderson School of Management', 'LAX Airport',
    (current_date + interval '1 day' + interval '18 hour'), 'car',
    34.0722, -118.4441, 33.9416, -118.4085
  ),
  (
    'd0000000-0000-0000-0000-000000000006', 'UCLA Anderson School of Management', 'Santa Monica Pier',
    (current_date + interval '1 day' + interval '19 hour'), 'bus',
    34.0722, -118.4441, 34.0100, -118.4963
  );
-- Note: demo-viewer intentionally has no trip_request of its own — it's
-- meant purely to browse, matching the "AI ranks even without an active
-- request" behavior. All 4 others (alex, brianna, carlos, dana) plus evan
-- are open candidates when viewer browses: 5 total, satisfying the "3+
-- candidates" scenario. To exercise the "exactly 1 candidate" scenario,
-- cancel all but one, e.g.:
--   update public.trip_requests set status = 'cancelled'
--   where user_id <> 'd0000000-0000-0000-0000-000000000002'
--     and user_id like 'd0000000%';

commit;
