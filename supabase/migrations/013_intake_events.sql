-- Migration 013: intake_events — per-IP rate-limit ledger for the public intake
-- endpoints (spam guardrails Layer 2: /api/system/quote + /api/system/intake).
--
-- Adam-run on the production Supabase SQL editor. Do NOT run automatically.
-- SQL-editor-safe: no DO blocks, no dollar-dollar anonymous blocks.
-- Idempotent / re-runnable: IF NOT EXISTS + DROP ... IF EXISTS throughout.
--
-- The intake endpoints access this table with the SERVICE ROLE, which bypasses
-- RLS. RLS is still enabled (locking the table to every other role) and an
-- explicit service_role policy is included so the migration is fully
-- self-contained (lifecycle-0.4 lesson: never leave RLS on with no policy).
--
-- Until this table exists the endpoints FAIL-OPEN: Layer 2 is skipped (logged),
-- never blocking intake or 500ing — so deploy order can never break the forms.

CREATE TABLE IF NOT EXISTS public.intake_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip text NOT NULL,
  email text,
  endpoint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.intake_events DROP CONSTRAINT IF EXISTS intake_events_ip_check;

ALTER TABLE public.intake_events
  ADD CONSTRAINT intake_events_ip_check
  CHECK (btrim(ip) <> '');

-- Primary access path: count rows for one IP within the last hour.
CREATE INDEX IF NOT EXISTS idx_intake_events_ip_created_at
  ON public.intake_events(ip, created_at DESC);

-- Secondary: time-range sweeps / future retention pruning.
CREATE INDEX IF NOT EXISTS idx_intake_events_created_at
  ON public.intake_events(created_at DESC);

ALTER TABLE public.intake_events ENABLE ROW LEVEL SECURITY;

-- Service role only (endpoints use the service-role client). anon/authenticated
-- get no policy and are therefore fully denied.
DROP POLICY IF EXISTS intake_events_service_role_all ON public.intake_events;

CREATE POLICY intake_events_service_role_all
  ON public.intake_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
