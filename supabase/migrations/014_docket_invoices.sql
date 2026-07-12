-- Migration 014: docket_invoices — per-docket invoice ledger (lifecycle chain B).
--
-- Adam-run on the production Supabase SQL editor. Do NOT run automatically.
-- SQL-editor-safe: no DO blocks, no dollar-dollar anonymous blocks.
-- Idempotent / re-runnable: IF NOT EXISTS + DROP ... IF EXISTS throughout.
--
-- Access model:
--   * The agent/admin app reads + writes with the SERVICE ROLE (bypasses RLS).
--   * Authenticated customers may SELECT only invoices on dockets they own,
--     joined auth.uid() -> customers -> dockets exactly like the migration-009
--     child-table policies (marcus_questions / customer_questions).
--
-- Until this table exists the app FAILS OPEN: the agent ledger renders a quiet
-- "not yet enabled" state and the customer page shows the empty state — nothing
-- 500s, so deploy order is safe.

CREATE TABLE IF NOT EXISTS public.docket_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  docket_id uuid NOT NULL REFERENCES public.dockets(id) ON DELETE CASCADE,
  invoice_type text NOT NULL,
  label text NOT NULL,
  amount_cad numeric,
  status text NOT NULL DEFAULT 'unpaid',
  issued_at date,
  paid_at timestamptz,
  file_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.docket_invoices DROP CONSTRAINT IF EXISTS docket_invoices_type_check;
ALTER TABLE public.docket_invoices
  ADD CONSTRAINT docket_invoices_type_check
  CHECK (invoice_type IN ('deposit', 'balance', 'transport', 'other'));

ALTER TABLE public.docket_invoices DROP CONSTRAINT IF EXISTS docket_invoices_status_check;
ALTER TABLE public.docket_invoices
  ADD CONSTRAINT docket_invoices_status_check
  CHECK (status IN ('unpaid', 'paid', 'void'));

ALTER TABLE public.docket_invoices DROP CONSTRAINT IF EXISTS docket_invoices_label_check;
ALTER TABLE public.docket_invoices
  ADD CONSTRAINT docket_invoices_label_check
  CHECK (btrim(label) <> '');

CREATE INDEX IF NOT EXISTS idx_docket_invoices_docket_id_created_at
  ON public.docket_invoices(docket_id, created_at DESC);

ALTER TABLE public.docket_invoices ENABLE ROW LEVEL SECURITY;

-- Service role: full access for the agent/admin app.
DROP POLICY IF EXISTS docket_invoices_service_role_all ON public.docket_invoices;
CREATE POLICY docket_invoices_service_role_all
  ON public.docket_invoices
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated customers: read-only, own dockets only (join auth.uid -> customers -> dockets).
DROP POLICY IF EXISTS customer_select_own_docket_invoices ON public.docket_invoices;
CREATE POLICY customer_select_own_docket_invoices
  ON public.docket_invoices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.dockets d
      JOIN public.customers c ON c.id = d.customer_id
      WHERE d.id = docket_invoices.docket_id
        AND c.auth_user_id = auth.uid()
    )
  );
