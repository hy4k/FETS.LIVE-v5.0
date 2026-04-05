-- Payroll-only / historical placeholder for staff_profiles (e.g. resigned, row was deleted).
-- Run in Supabase SQL Editor as a user with sufficient privileges (often service role bypasses RLS).
--
-- BEFORE INSERT: try to recover the old profile UUID -----------------------------------------
-- 1) Orphan roster rows (profile deleted but schedules might remain if no CASCADE):
--    SELECT profile_id, MIN(date) AS first_shift, MAX(date) AS last_shift, COUNT(*) AS rows
--    FROM public.roster_schedules
--    WHERE date >= '2026-03-01' AND date < '2026-04-01'
--    GROUP BY profile_id
--    ORDER BY profile_id;
--
-- 2) Rows that no longer join to staff_profiles:
--    SELECT rs.profile_id, COUNT(*) AS n
--    FROM public.roster_schedules rs
--    LEFT JOIN public.staff_profiles sp ON sp.id = rs.profile_id
--    WHERE sp.id IS NULL
--    GROUP BY rs.profile_id;
--
-- 3) Attendance / other tables referencing staff_profiles(id):
--    SELECT sa.staff_id, COUNT(*) FROM public.staff_attendance sa
--    LEFT JOIN public.staff_profiles sp ON sp.id = sa.staff_id
--    WHERE sp.id IS NULL
--    GROUP BY sa.staff_id;
--
-- If you FIND the old UUID: use OPTION A. If not: OPTION B (new id). Old March roster rows stay tied
-- to the OLD profile_id unless you UPDATE roster_schedules SET profile_id = <new_id> WHERE ...
-- ----------------------------------------------------------------------------------------------

-- OPTION A — Reuse known historical id (replace UUID and dates; use one uuid for both id and user_id)
/*
INSERT INTO public.staff_profiles (
  id,
  user_id,
  full_name,
  email,
  role,
  department,
  branch_assigned,
  base_centre,
  branch_location,
  is_active,
  employment_end_date,
  created_at
) VALUES (
  'PASTE-OLD-PROFILE-UUID-HERE'::uuid,
  'PASTE-OLD-PROFILE-UUID-HERE'::uuid,
  'Abhirami',
  'payroll.placeholder+abhirami@fets.internal',
  'staff',
  'Operations',
  'cochin',
  'cochin',
  'cochin',
  false,
  '2026-03-31',
  now()
);
*/

-- OPTION B — New placeholder (id = user_id, matches create-staff-user pattern)
-- Uncomment ONE of A or B. If INSERT fails on user_id → auth.users FK, create an Auth user with this email first.

/*
WITH u AS (SELECT gen_random_uuid() AS id)
INSERT INTO public.staff_profiles (
  id,
  user_id,
  full_name,
  email,
  role,
  department,
  branch_assigned,
  base_centre,
  branch_location,
  is_active,
  employment_end_date,
  created_at
)
SELECT
  id,
  id,
  'Abhirami (payroll placeholder)',
  'payroll.placeholder+abhirami@fets.internal',
  'staff',
  'Operations',
  'cochin',
  'cochin',
  'cochin',
  false,
  '2026-03-31',
  now()
FROM u;
*/

-- After insert: NOTIFY pgrst, 'reload schema';  -- if PostgREST cache complains in the app
