-- Migration 015: shipments + shipment_stage_history (lifecycle Phase 3, Stage 3.1/3.2).
--
-- Adam-run on the production Supabase SQL editor. Do NOT run automatically.
-- Bundle this paste with migration 014. SQL-editor-safe: no DO blocks, no
-- dollar-dollar anonymous blocks. Idempotent / re-runnable throughout.
--
-- Column separation (customer-visible vs internal):
--   internal_notes is the one internal column. RLS is row-level only, so we ALSO
--   restrict it at the SCHEMA level: authenticated is granted SELECT on every
--   column EXCEPT internal_notes. Combined with the row policy, a customer can
--   read only their own shipment's non-internal columns — even via a direct query.
--   The service role (agent/admin app) bypasses RLS and keeps full access.
--
-- Until these tables exist the app FAILS OPEN: Move to Delivery still transitions
-- (shipment auto-create is skipped + logged), the agent panel shows a quiet
-- "not enabled" state, and the customer page shows the pre-shipment empty state.

CREATE TABLE IF NOT EXISTS public.shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  docket_id uuid NOT NULL REFERENCES public.dockets(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  vessel_name text,
  voyage_number text,
  bill_of_lading text,
  container_number text,
  port_of_loading text,
  port_of_discharge text,
  estimated_departure_date date,
  estimated_arrival_date date,
  actual_departure_date date,
  actual_arrival_date date,
  internal_notes text,
  current_stage text NOT NULL DEFAULT 'pre-shipment',
  stage_updated_at timestamptz NOT NULL DEFAULT now(),
  customer_visible_notes text,
  marine_traffic_url text
);

-- One shipment per docket (also guarantees Move-to-Delivery idempotency at the DB level).
CREATE UNIQUE INDEX IF NOT EXISTS idx_shipments_docket_id ON public.shipments(docket_id);

CREATE TABLE IF NOT EXISTS public.shipment_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  old_stage text,
  new_stage text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by text NOT NULL,
  changed_by_email text,
  notes text
);

CREATE INDEX IF NOT EXISTS idx_shipment_stage_history_shipment_id_changed_at
  ON public.shipment_stage_history(shipment_id, changed_at DESC);

ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_stage_history ENABLE ROW LEVEL SECURITY;

-- ── shipments RLS ──
DROP POLICY IF EXISTS shipments_service_role_all ON public.shipments;
CREATE POLICY shipments_service_role_all
  ON public.shipments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS customer_select_own_shipments ON public.shipments;
CREATE POLICY customer_select_own_shipments
  ON public.shipments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.dockets d
      JOIN public.customers c ON c.id = d.customer_id
      WHERE d.id = shipments.docket_id
        AND c.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS admin_agent_read_all_shipments ON public.shipments;
CREATE POLICY admin_agent_read_all_shipments
  ON public.shipments
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

-- Column-level separation: authenticated may read every column EXCEPT internal_notes.
REVOKE SELECT ON public.shipments FROM authenticated;
GRANT SELECT (
  id, docket_id, created_at, updated_at,
  vessel_name, voyage_number, bill_of_lading, container_number,
  port_of_loading, port_of_discharge,
  estimated_departure_date, estimated_arrival_date,
  actual_departure_date, actual_arrival_date,
  current_stage, stage_updated_at, customer_visible_notes, marine_traffic_url
) ON public.shipments TO authenticated;

-- ── shipment_stage_history RLS: service role only (internal audit trail) ──
DROP POLICY IF EXISTS shipment_stage_history_service_role_all ON public.shipment_stage_history;
CREATE POLICY shipment_stage_history_service_role_all
  ON public.shipment_stage_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
