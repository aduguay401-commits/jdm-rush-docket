-- Migration 018: hygiene defense-in-depth RLS. Adam-run-only.
--
-- DEFENSE-IN-DEPTH ONLY — nothing in the app depends on this at runtime. The
-- server routes already filter void invoices and RLS already denies anon; this
-- makes the database enforce both directly. SQL-editor-safe, idempotent.

-- (1) docket_invoices customer SELECT: also exclude void invoices at the DB layer
-- (the customer routes/pages already filter them; belt-and-suspenders). Recreates
-- the policy from migration 014 with an added status guard.
DROP POLICY IF EXISTS customer_select_own_docket_invoices ON public.docket_invoices;
CREATE POLICY customer_select_own_docket_invoices
  ON public.docket_invoices
  FOR SELECT
  TO authenticated
  USING (
    status <> 'void'
    AND EXISTS (
      SELECT 1
      FROM public.dockets d
      JOIN public.customers c ON c.id = d.customer_id
      WHERE d.id = docket_invoices.docket_id
        AND c.auth_user_id = auth.uid()
    )
  );

-- (2) Explicit anon REVOKEs on the internal/customer-scoped tables. RLS already
-- denies anon on these; this removes the table-level grant too (belt-and-suspenders).
REVOKE ALL ON public.shipments FROM anon;
REVOKE ALL ON public.shipment_stage_history FROM anon;
REVOKE ALL ON public.docket_invoices FROM anon;
REVOKE ALL ON public.intake_events FROM anon;
REVOKE ALL ON public.sms_log FROM anon;
