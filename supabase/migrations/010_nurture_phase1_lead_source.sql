-- Nurture Engine Phase 1: immutable lead source segmentation.
-- Adam-run production migration. Additive only; does not mutate selected_path or lifecycle fields.

ALTER TABLE public.dockets
  ADD COLUMN IF NOT EXISTS lead_source text;

ALTER TABLE public.dockets
  ADD COLUMN IF NOT EXISTS lead_source_set_at timestamptz;

ALTER TABLE public.dockets
  ADD COLUMN IF NOT EXISTS lead_source_detail jsonb DEFAULT '{}'::jsonb;

UPDATE public.dockets
SET lead_source_detail = '{}'::jsonb
WHERE lead_source_detail IS NULL;

ALTER TABLE public.dockets
  ALTER COLUMN lead_source_detail SET DEFAULT '{}'::jsonb;

ALTER TABLE public.dockets
  ALTER COLUMN lead_source_detail SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'dockets_lead_source_check'
      AND conrelid = 'public.dockets'::regclass
  ) THEN
    ALTER TABLE public.dockets
      ADD CONSTRAINT dockets_lead_source_check
      CHECK (lead_source IS NULL OR lead_source IN ('exact_quote', 'find_my_jdm'));
  END IF;
END;
$$;

UPDATE public.dockets
SET
  lead_source = 'exact_quote',
  lead_source_set_at = COALESCE(lead_source_set_at, created_at, now()),
  lead_source_detail = COALESCE(lead_source_detail, '{}'::jsonb) || jsonb_build_object(
    'backfilled_from', 'selected_path_quote_endpoint'
  )
WHERE lead_source IS NULL
  AND selected_path = 'quote-endpoint';

CREATE OR REPLACE FUNCTION public.prevent_dockets_lead_source_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
    AND OLD.lead_source IS NOT NULL
    AND NEW.lead_source IS DISTINCT FROM OLD.lead_source
  THEN
    RAISE EXCEPTION 'dockets.lead_source is immutable once set';
  END IF;

  IF NEW.lead_source IS NOT NULL AND NEW.lead_source_set_at IS NULL THEN
    NEW.lead_source_set_at = now();
  END IF;

  IF NEW.lead_source_detail IS NULL THEN
    NEW.lead_source_detail = '{}'::jsonb;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dockets_lead_source_immutable ON public.dockets;

CREATE TRIGGER dockets_lead_source_immutable
  BEFORE INSERT OR UPDATE OF lead_source, lead_source_set_at, lead_source_detail
  ON public.dockets
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_dockets_lead_source_change();
