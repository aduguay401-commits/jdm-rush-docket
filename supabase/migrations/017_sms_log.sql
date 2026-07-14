-- Migration 017: sms_log — internal SMS send + delivery telemetry (Twilio).
--
-- Adam-run on the production Supabase SQL editor. Do NOT run automatically.
-- SQL-editor-safe: no DO blocks, no dollar-dollar. Idempotent / re-runnable.
--
-- INTERNAL / agent-only telemetry — customers must NEVER see SMS logs. RLS:
-- service_role ALL + admin/agent SELECT (the agent dashboard reads it with the
-- authenticated agent session, same as email activity). NO customer policy.
--
-- Until this table exists the app FAILS OPEN: sendSMS degrades to console.log,
-- the webhook no-ops, and the dashboard/detail sms_log query is skipped.
--
-- PII: to_last4 stores only the last 4 digits (full number already lives on the
-- docket). docket_id is nullable (SMS may fire without a docket) and ON DELETE SET NULL.

CREATE TABLE IF NOT EXISTS public.sms_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  docket_id uuid REFERENCES public.dockets(id) ON DELETE SET NULL,
  sms_type text NOT NULL,
  to_last4 text,
  body text,
  twilio_sid text,
  status text NOT NULL DEFAULT 'queued',
  error_code text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sms_log DROP CONSTRAINT IF EXISTS sms_log_status_check;
ALTER TABLE public.sms_log
  ADD CONSTRAINT sms_log_status_check
  CHECK (status IN ('queued', 'sent', 'delivered', 'undelivered', 'failed', 'send_error'));

ALTER TABLE public.sms_log DROP CONSTRAINT IF EXISTS sms_log_sms_type_check;
ALTER TABLE public.sms_log
  ADD CONSTRAINT sms_log_sms_type_check
  CHECK (btrim(sms_type) <> '');

CREATE INDEX IF NOT EXISTS idx_sms_log_docket_id_created_at
  ON public.sms_log(docket_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sms_log_twilio_sid
  ON public.sms_log(twilio_sid);

ALTER TABLE public.sms_log ENABLE ROW LEVEL SECURITY;

-- Service role: full access (sendSMS insert, webhook update).
DROP POLICY IF EXISTS sms_log_service_role_all ON public.sms_log;
CREATE POLICY sms_log_service_role_all
  ON public.sms_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Admin/agent read-only (the dashboard reads with the authenticated agent session).
-- Customers get NO policy and are therefore fully denied.
DROP POLICY IF EXISTS admin_agent_read_sms_log ON public.sms_log;
CREATE POLICY admin_agent_read_sms_log
  ON public.sms_log
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
