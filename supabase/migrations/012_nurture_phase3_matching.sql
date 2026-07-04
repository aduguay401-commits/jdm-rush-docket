-- Migration 012: Nurture Engine Phase 3A - matching engine send ledger
-- Adam-run on production Supabase SQL editor.
-- SQL-editor-safe: no DO blocks, no anonymous dollar-dollar blocks.
-- Idempotent/re-runnable: uses IF NOT EXISTS, DROP ... IF EXISTS, and CREATE OR REPLACE where applicable.

CREATE TABLE IF NOT EXISTS public.nurture_email_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  saved_search_id uuid NOT NULL REFERENCES public.lead_saved_searches(id) ON DELETE CASCADE,
  docket_id uuid NOT NULL REFERENCES public.dockets(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  status text NOT NULL,
  subject text,
  inventory_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  match_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nurture_email_sends DROP CONSTRAINT IF EXISTS nurture_email_sends_status_check;

ALTER TABLE public.nurture_email_sends
  ADD CONSTRAINT nurture_email_sends_status_check
  CHECK (
    status IN (
      'sent',
      'skipped_insufficient_matches',
      'skipped_unsubscribed',
      'failed'
    )
  );

ALTER TABLE public.nurture_email_sends DROP CONSTRAINT IF EXISTS nurture_email_sends_recipient_email_check;

ALTER TABLE public.nurture_email_sends
  ADD CONSTRAINT nurture_email_sends_recipient_email_check
  CHECK (btrim(recipient_email) <> '');

ALTER TABLE public.nurture_email_sends DROP CONSTRAINT IF EXISTS nurture_email_sends_inventory_refs_check;

ALTER TABLE public.nurture_email_sends
  ADD CONSTRAINT nurture_email_sends_inventory_refs_check
  CHECK (jsonb_typeof(inventory_refs) = 'array');

ALTER TABLE public.nurture_email_sends DROP CONSTRAINT IF EXISTS nurture_email_sends_match_config_check;

ALTER TABLE public.nurture_email_sends
  ADD CONSTRAINT nurture_email_sends_match_config_check
  CHECK (jsonb_typeof(match_config) = 'object');

CREATE INDEX IF NOT EXISTS idx_nurture_email_sends_saved_search_id
  ON public.nurture_email_sends(saved_search_id);

CREATE INDEX IF NOT EXISTS idx_nurture_email_sends_docket_id
  ON public.nurture_email_sends(docket_id);

CREATE INDEX IF NOT EXISTS idx_nurture_email_sends_status_created_at
  ON public.nurture_email_sends(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_nurture_email_sends_recipient_email_lower
  ON public.nurture_email_sends(lower(recipient_email));

ALTER TABLE public.nurture_email_sends ENABLE ROW LEVEL SECURITY;
