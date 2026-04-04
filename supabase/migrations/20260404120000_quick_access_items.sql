-- ============================================================
-- Quick Access: structured credentials per client (Prometric, etc.)
-- Run in Supabase SQL Editor after review.
-- Mirrors fets_vault RLS patterns (staff_profiles.owner_id)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.quick_access_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id            UUID NOT NULL REFERENCES public.staff_profiles(id) ON DELETE CASCADE,
  client_slug         TEXT NOT NULL
                        CHECK (client_slug IN ('prometric', 'pearson', 'psi', 'celpip', 'itts', 'fets')),
  field_type          TEXT NOT NULL
                        CHECK (field_type IN (
                          'url', 'login_id', 'password', 'email', 'contact_phone',
                          'site_code', 'access_code', 'api_key', 'support_pin', 'notes', 'other'
                        )),
  value_text          TEXT NOT NULL,
  label               TEXT,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  source_vault_row_id UUID,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quick_access_owner_client
  ON public.quick_access_items (owner_id, client_slug);
CREATE INDEX IF NOT EXISTS idx_quick_access_owner
  ON public.quick_access_items (owner_id);
CREATE INDEX IF NOT EXISTS idx_quick_access_source_vault
  ON public.quick_access_items (source_vault_row_id)
  WHERE source_vault_row_id IS NOT NULL;

ALTER TABLE public.quick_access_items ENABLE ROW LEVEL SECURITY;

-- SELECT: own rows OR elevated roles (same idea as fets_vault)
DROP POLICY IF EXISTS "quick_access_select" ON public.quick_access_items;
CREATE POLICY "quick_access_select" ON public.quick_access_items
  FOR SELECT TO authenticated
  USING (
    owner_id IN (SELECT id FROM public.staff_profiles WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.staff_profiles sp
      WHERE sp.user_id = auth.uid()
        AND sp.role IN ('super_admin', 'roster_manager')
    )
  );

DROP POLICY IF EXISTS "quick_access_insert" ON public.quick_access_items;
CREATE POLICY "quick_access_insert" ON public.quick_access_items
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id IN (SELECT id FROM public.staff_profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "quick_access_update" ON public.quick_access_items;
CREATE POLICY "quick_access_update" ON public.quick_access_items
  FOR UPDATE TO authenticated
  USING (
    owner_id IN (SELECT id FROM public.staff_profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    owner_id IN (SELECT id FROM public.staff_profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "quick_access_delete" ON public.quick_access_items;
CREATE POLICY "quick_access_delete" ON public.quick_access_items
  FOR DELETE TO authenticated
  USING (
    owner_id IN (SELECT id FROM public.staff_profiles WHERE user_id = auth.uid())
  );

COMMENT ON TABLE public.quick_access_items IS 'Structured quick-access credentials grouped by test vendor; migrated from fets_vault rows in app.';
