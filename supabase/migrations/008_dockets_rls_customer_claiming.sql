-- Migration: Dockets RLS policies for customer lifecycle access
-- Context: Stage 0.3 enables customer-owned docket access while preserving admin/agent reads.
-- Idempotent: policies are dropped before create so Adam can safely re-run this migration.
-- Note: public.profiles is keyed by id = auth.users.id; there is no profiles.user_id column.

ALTER TABLE public.dockets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customers_read_own_dockets ON public.dockets;
CREATE POLICY customers_read_own_dockets ON public.dockets
  FOR SELECT
  TO authenticated
  USING (
    customer_id = (
      SELECT id
      FROM public.customers
      WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS customers_update_own_dockets ON public.dockets;
CREATE POLICY customers_update_own_dockets ON public.dockets
  FOR UPDATE
  TO authenticated
  USING (
    customer_id = (
      SELECT id
      FROM public.customers
      WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    customer_id = (
      SELECT id
      FROM public.customers
      WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS admin_agent_read_all_dockets ON public.dockets;
CREATE POLICY admin_agent_read_all_dockets ON public.dockets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'agent')
    )
  );
