-- How many days did a staff member work in March at Cochin? (Supabase SQL Editor)
-- Adjust the year in the date range if needed (e.g. March 2025 → '2025-03-01' / '2025-04-01').
--
-- Filled in for Abhirami: profile_id = 17772c25-64f6-49ff-87e7-2c21a4b9c406

-- ---------------------------------------------------------------------------
-- 1) Confirm profile row still exists (optional)
-- ---------------------------------------------------------------------------
SELECT id,
       user_id,
       full_name,
       email,
       branch_assigned
FROM public.staff_profiles
WHERE id = '17772c25-64f6-49ff-87e7-2c21a4b9c406'::uuid;

-- After migration supabase/migrations/20260404180000_staff_soft_archive.sql you can also select:
-- is_active, employment_end_date

-- If nothing returns: profile was deleted — roster queries below still work using profile_id alone.

-- ---------------------------------------------------------------------------
-- 2) March roster detail (uses Abhirami profile_id). If JOIN returns no rows but section 3 has counts,
--    staff_profiles row may be missing; use the orphan-only SELECT at the bottom of section 2b.
-- ---------------------------------------------------------------------------

-- Daily roster lines for March (see what was scheduled)
SELECT rs.date,
       rs.shift_code,
       rs.overtime_hours,
       sp.full_name,
       sp.branch_assigned
FROM public.roster_schedules rs
LEFT JOIN public.staff_profiles sp ON sp.id = rs.profile_id
WHERE rs.profile_id = '17772c25-64f6-49ff-87e7-2c21a4b9c406'::uuid
  AND rs.date >= '2026-03-01'
  AND rs.date < '2026-04-01'
ORDER BY rs.date;

-- 2b) Same detail without needing staff_profiles (if profile row deleted)
SELECT rs.date, rs.shift_code, rs.overtime_hours
FROM public.roster_schedules rs
WHERE rs.profile_id = '17772c25-64f6-49ff-87e7-2c21a4b9c406'::uuid
  AND rs.date >= '2026-03-01'
  AND rs.date < '2026-04-01'
ORDER BY rs.date;

-- ---------------------------------------------------------------------------
-- 3) Counts (pick the definition that matches payroll policy)
-- ---------------------------------------------------------------------------
-- A) "On duty" as the app treats it for status: D, E, HD, OT, T (see FetsRosterPremium StaffProfileModal)
SELECT COUNT(DISTINCT rs.date) AS days_on_duty_shift_codes
FROM public.roster_schedules rs
WHERE rs.profile_id = '17772c25-64f6-49ff-87e7-2c21a4b9c406'::uuid
  AND rs.date >= '2026-03-01'
  AND rs.date < '2026-04-01'
  AND rs.shift_code IN ('D', 'E', 'HD', 'OT', 'T');

-- B) Scheduled working days excluding obvious non-work codes (Rest day, Leave)
SELECT COUNT(DISTINCT rs.date) AS days_excluding_rd_and_leave
FROM public.roster_schedules rs
WHERE rs.profile_id = '17772c25-64f6-49ff-87e7-2c21a4b9c406'::uuid
  AND rs.date >= '2026-03-01'
  AND rs.date < '2026-04-01'
  AND rs.shift_code NOT IN ('RD', 'L');

-- C) All distinct days with any roster row (includes RD/L if entered)
SELECT COUNT(DISTINCT rs.date) AS days_with_any_roster_entry
FROM public.roster_schedules rs
WHERE rs.profile_id = '17772c25-64f6-49ff-87e7-2c21a4b9c406'::uuid
  AND rs.date >= '2026-03-01'
  AND rs.date < '2026-04-01';

-- ---------------------------------------------------------------------------
-- 4) Optional: actual attendance (if you use staff_attendance and rows exist)
-- ---------------------------------------------------------------------------
SELECT sa.date, sa.status, sa.check_in, sa.check_out, sa.branch_location
FROM public.staff_attendance sa
WHERE sa.staff_id = '17772c25-64f6-49ff-87e7-2c21a4b9c406'::uuid
  AND sa.date >= '2026-03-01'
  AND sa.date < '2026-04-01'
ORDER BY sa.date;

SELECT COUNT(DISTINCT sa.date) AS days_marked_present_or_late
FROM public.staff_attendance sa
WHERE sa.staff_id = '17772c25-64f6-49ff-87e7-2c21a4b9c406'::uuid
  AND sa.date >= '2026-03-01'
  AND sa.date < '2026-04-01'
  AND sa.status IN ('present', 'late');

-- ---------------------------------------------------------------------------
-- 5) If profile was deleted but roster rows remain: discover profile_id from March data
-- ---------------------------------------------------------------------------
SELECT rs.profile_id,
       COUNT(*) AS roster_rows,
       MIN(rs.date) AS first_date,
       MAX(rs.date) AS last_date
FROM public.roster_schedules rs
LEFT JOIN public.staff_profiles sp ON sp.id = rs.profile_id
WHERE rs.date >= '2026-03-01'
  AND rs.date < '2026-04-01'
  AND sp.id IS NULL
GROUP BY rs.profile_id;
