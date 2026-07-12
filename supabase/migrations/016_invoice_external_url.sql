-- Migration 016: docket_invoices.external_url — external invoice link (e.g. a
-- QuickBooks Online invoice URL), shown ALONGSIDE the optional PDF upload.
--
-- Adam-run on the production Supabase SQL editor. Idempotent / re-runnable.
-- Customer-visible by design: docket_invoices already grants row SELECT to the
-- owning customer (no column-level restriction), so no RLS change is needed.

ALTER TABLE public.docket_invoices ADD COLUMN IF NOT EXISTS external_url text;
