-- Soft archive for resigned staff: keep profile row for payroll/roster history.
-- Use is_active + employment_end_date instead of DELETE from staff_profiles.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'staff_profiles' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.staff_profiles ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'staff_profiles' AND column_name = 'employment_end_date'
  ) THEN
    ALTER TABLE public.staff_profiles ADD COLUMN employment_end_date date NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.staff_profiles.is_active IS 'When false, staff is archived; still shown on roster for months up to employment_end_date.';
COMMENT ON COLUMN public.staff_profiles.employment_end_date IS 'Last day counted for roster/payroll visibility for archived staff (YYYY-MM-DD).';
