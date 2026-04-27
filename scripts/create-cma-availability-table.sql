-- CMA Exam Seat Availability Tracker
-- Stores scraped Prometric center availability per exam part.
-- Unique constraint on (center_id, exam_part) so the scraper can upsert cleanly.
--
-- Run against your Supabase project:
--   node scripts/run-sql.js --query "$(cat scripts/create-cma-availability-table.sql)"
-- Or paste directly in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.cma_availability (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id       TEXT NOT NULL,                 -- e.g. 'cochin', 'calicut'
  center_location TEXT,                          -- human-readable city/state
  exam_part       TEXT NOT NULL CHECK (exam_part IN ('1', '2')),
  exam_date       DATE,                          -- nearest available date (nullable)
  status          TEXT NOT NULL DEFAULT 'unknown'
                    CHECK (status IN ('available', 'limited', 'unavailable', 'unknown')),
  available_seats INTEGER,                       -- NULL if count not scraped
  notes           TEXT,                          -- scraper error messages or extra info
  scraped_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT cma_availability_center_part_unique UNIQUE (center_id, exam_part)
);

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cma_availability_updated_at ON public.cma_availability;
CREATE TRIGGER cma_availability_updated_at
  BEFORE UPDATE ON public.cma_availability
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Index for fast lookups by center and status
CREATE INDEX IF NOT EXISTS idx_cma_availability_center
  ON public.cma_availability (center_id);

CREATE INDEX IF NOT EXISTS idx_cma_availability_status
  ON public.cma_availability (status);

CREATE INDEX IF NOT EXISTS idx_cma_availability_scraped_at
  ON public.cma_availability (scraped_at DESC);

-- Row Level Security
ALTER TABLE public.cma_availability ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "cma_availability_read_authenticated"
  ON public.cma_availability
  FOR SELECT
  TO authenticated
  USING (true);

-- Only service role (scraper) can insert/update/delete
CREATE POLICY "cma_availability_write_service_role"
  ON public.cma_availability
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Seed placeholder rows so the widget shows something before the first scrape
INSERT INTO public.cma_availability (center_id, center_location, exam_part, status, notes)
VALUES
  ('cochin',     'Kochi, Kerala',              '1', 'unknown', 'Awaiting first scrape'),
  ('cochin',     'Kochi, Kerala',              '2', 'unknown', 'Awaiting first scrape'),
  ('calicut',    'Kozhikode, Kerala',          '1', 'unknown', 'Awaiting first scrape'),
  ('calicut',    'Kozhikode, Kerala',          '2', 'unknown', 'Awaiting first scrape'),
  ('trivandrum', 'Thiruvananthapuram, Kerala', '1', 'unknown', 'Awaiting first scrape'),
  ('trivandrum', 'Thiruvananthapuram, Kerala', '2', 'unknown', 'Awaiting first scrape'),
  ('bangalore',  'Bengaluru, Karnataka',       '1', 'unknown', 'Awaiting first scrape'),
  ('bangalore',  'Bengaluru, Karnataka',       '2', 'unknown', 'Awaiting first scrape'),
  ('chennai',    'Chennai, Tamil Nadu',        '1', 'unknown', 'Awaiting first scrape'),
  ('chennai',    'Chennai, Tamil Nadu',        '2', 'unknown', 'Awaiting first scrape')
ON CONFLICT (center_id, exam_part) DO NOTHING;
