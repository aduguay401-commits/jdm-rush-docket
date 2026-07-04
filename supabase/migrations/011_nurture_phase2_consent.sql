-- Migration 011: Nurture Engine Phase 2 - consent ledger + opt-in saved searches
-- Adam-run on production Supabase SQL editor.
-- SQL-editor-safe: no DO blocks, no anonymous dollar-dollar blocks.
-- Idempotent/re-runnable: uses IF NOT EXISTS, DROP ... IF EXISTS, and CREATE OR REPLACE.
--
-- Pre-build live schema gate, 2026-07-04:
-- - public.dockets exists on live Supabase and includes Phase 1 columns:
--   lead_source, lead_source_set_at, lead_source_detail.
-- - public.dockets.id defaults to gen_random_uuid(), confirming gen_random_uuid()
--   is available on live.
-- - Public PostgREST metadata exposes dockets primary/foreign key notes, but not
--   pg_catalog.pg_indexes. Existing dockets indexes visible from applied tracked
--   migrations: dockets_pkey and idx_dockets_customer_id.

ALTER TABLE public.dockets
  ADD COLUMN IF NOT EXISTS marketing_consent boolean;

UPDATE public.dockets
SET marketing_consent = false
WHERE marketing_consent IS NULL;

ALTER TABLE public.dockets
  ALTER COLUMN marketing_consent SET DEFAULT false;

ALTER TABLE public.dockets
  ALTER COLUMN marketing_consent SET NOT NULL;

ALTER TABLE public.dockets
  ADD COLUMN IF NOT EXISTS marketing_consent_granted_at timestamptz;

ALTER TABLE public.dockets
  ADD COLUMN IF NOT EXISTS marketing_consent_source text;

ALTER TABLE public.dockets
  ADD COLUMN IF NOT EXISTS marketing_unsubscribe_token uuid;

UPDATE public.dockets
SET marketing_unsubscribe_token = gen_random_uuid()
WHERE marketing_unsubscribe_token IS NULL;

ALTER TABLE public.dockets
  ALTER COLUMN marketing_unsubscribe_token SET DEFAULT gen_random_uuid();

ALTER TABLE public.dockets
  ALTER COLUMN marketing_unsubscribe_token SET NOT NULL;

ALTER TABLE public.dockets
  ADD COLUMN IF NOT EXISTS marketing_unsubscribed_at timestamptz;

ALTER TABLE public.dockets
  ADD COLUMN IF NOT EXISTS marketing_last_email_at timestamptz;

ALTER TABLE public.dockets DROP CONSTRAINT IF EXISTS dockets_marketing_consent_check;

ALTER TABLE public.dockets
  ADD CONSTRAINT dockets_marketing_consent_check
  CHECK (
    marketing_consent = false
    OR (
      marketing_consent_granted_at IS NOT NULL
      AND marketing_consent_source IS NOT NULL
      AND btrim(marketing_consent_source) <> ''
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_dockets_marketing_unsubscribe_token
  ON public.dockets(marketing_unsubscribe_token);

CREATE TABLE IF NOT EXISTS public.lead_consent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  docket_id uuid NOT NULL REFERENCES public.dockets(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_source text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  email text NOT NULL,
  ip_hash text,
  user_agent text,
  token uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.lead_consent_events DROP CONSTRAINT IF EXISTS lead_consent_events_event_type_check;

ALTER TABLE public.lead_consent_events
  ADD CONSTRAINT lead_consent_events_event_type_check
  CHECK (event_type IN ('opt_in', 'unsubscribe', 'resubscribe', 'admin_suppress'));

ALTER TABLE public.lead_consent_events DROP CONSTRAINT IF EXISTS lead_consent_events_event_source_check;

ALTER TABLE public.lead_consent_events
  ADD CONSTRAINT lead_consent_events_event_source_check
  CHECK (btrim(event_source) <> '');

ALTER TABLE public.lead_consent_events DROP CONSTRAINT IF EXISTS lead_consent_events_email_check;

ALTER TABLE public.lead_consent_events
  ADD CONSTRAINT lead_consent_events_email_check
  CHECK (btrim(email) <> '');

ALTER TABLE public.lead_consent_events
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;

UPDATE public.lead_consent_events
SET metadata = '{}'::jsonb
WHERE metadata IS NULL;

ALTER TABLE public.lead_consent_events
  ALTER COLUMN metadata SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lead_consent_events_docket_occurred
  ON public.lead_consent_events(docket_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_consent_events_token
  ON public.lead_consent_events(token)
  WHERE token IS NOT NULL;

CREATE OR REPLACE FUNCTION public.prevent_lead_consent_events_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
  RAISE EXCEPTION 'lead_consent_events is append-only';
END;
$fn$;

DROP TRIGGER IF EXISTS lead_consent_events_append_only_update ON public.lead_consent_events;

CREATE TRIGGER lead_consent_events_append_only_update
  BEFORE UPDATE ON public.lead_consent_events
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_lead_consent_events_mutation();

CREATE OR REPLACE FUNCTION public.prevent_direct_lead_consent_events_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.dockets
    WHERE id = OLD.docket_id
  ) THEN
    RAISE EXCEPTION 'lead_consent_events is append-only; delete the parent docket for right-to-erasure purges';
  END IF;

  RETURN OLD;
END;
$fn$;

DROP TRIGGER IF EXISTS lead_consent_events_append_only_delete ON public.lead_consent_events;

CREATE TRIGGER lead_consent_events_append_only_delete
  BEFORE DELETE ON public.lead_consent_events
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_direct_lead_consent_events_delete();

ALTER TABLE public.lead_consent_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.lead_saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  docket_id uuid NOT NULL REFERENCES public.dockets(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  email text NOT NULL,
  anchor_ref text,
  anchor_url text,
  anchor_year integer,
  anchor_make text,
  anchor_model text,
  anchor_model_key text,
  anchor_price_jpy bigint,
  anchor_card_estimate_cad numeric,
  anchor_duty_type text,
  destination_city text,
  price_band_percent numeric NOT NULL DEFAULT 0.15,
  fallback_price_band_percent numeric NOT NULL DEFAULT 0.25,
  year_window integer NOT NULL DEFAULT 3,
  fallback_year_window integer NOT NULL DEFAULT 5,
  max_matches integer NOT NULL DEFAULT 3,
  active boolean NOT NULL DEFAULT false,
  last_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_saved_searches DROP CONSTRAINT IF EXISTS lead_saved_searches_email_check;

ALTER TABLE public.lead_saved_searches
  ADD CONSTRAINT lead_saved_searches_email_check
  CHECK (btrim(email) <> '');

ALTER TABLE public.lead_saved_searches DROP CONSTRAINT IF EXISTS lead_saved_searches_dials_check;

ALTER TABLE public.lead_saved_searches
  ADD CONSTRAINT lead_saved_searches_dials_check
  CHECK (
    price_band_percent > 0
    AND fallback_price_band_percent >= price_band_percent
    AND year_window > 0
    AND fallback_year_window >= year_window
    AND max_matches > 0
  );

CREATE INDEX IF NOT EXISTS idx_lead_saved_searches_docket_id
  ON public.lead_saved_searches(docket_id);

CREATE INDEX IF NOT EXISTS idx_lead_saved_searches_customer_id
  ON public.lead_saved_searches(customer_id)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lead_saved_searches_active
  ON public.lead_saved_searches(active, last_sent_at);

CREATE INDEX IF NOT EXISTS idx_lead_saved_searches_email_lower
  ON public.lead_saved_searches(lower(email));

CREATE OR REPLACE FUNCTION public.set_lead_saved_searches_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS lead_saved_searches_set_updated_at ON public.lead_saved_searches;

CREATE TRIGGER lead_saved_searches_set_updated_at
  BEFORE UPDATE ON public.lead_saved_searches
  FOR EACH ROW
  EXECUTE FUNCTION public.set_lead_saved_searches_updated_at();

ALTER TABLE public.lead_saved_searches ENABLE ROW LEVEL SECURITY;
