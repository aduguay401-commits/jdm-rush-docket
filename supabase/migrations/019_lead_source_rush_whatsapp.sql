-- Migration 019: allow lead_source = 'rush_whatsapp'
--
-- Rush (the WhatsApp sales agent) files leads through /api/system/intake, the
-- same endpoint the Find My JDM form uses, so until now every Rush lead was
-- recorded as find_my_jdm and only distinguishable by a tag in the notes.
--
-- RUN THIS BEFORE DEPLOYING THE CODE CHANGE. The CHECK constraint below is
-- what permits the new value; ship the route first and every Rush lead INSERT
-- fails, which silently loses real customers.
--
-- Also repairs migration 010: its constraint line lost its quotes somewhere
-- (`IN (exact_quote, find_my_jdm)` — bare identifiers, not string literals),
-- so that statement could not have applied as committed. Re-stating the whole
-- constraint here makes the DB correct regardless of which version is live.
--
-- Wrapped in a transaction deliberately: DROP-then-ADD run loose would leave
-- dockets with NO lead_source constraint at all if the ADD failed validation.

BEGIN;

ALTER TABLE public.dockets DROP CONSTRAINT IF EXISTS dockets_lead_source_check;

ALTER TABLE public.dockets
  ADD CONSTRAINT dockets_lead_source_check
  CHECK (
    lead_source IS NULL
    OR lead_source IN ('exact_quote', 'find_my_jdm', 'rush_whatsapp')
  );

COMMIT;

-- Verification (should return exactly one row showing all three values):
--   SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conname = 'dockets_lead_source_check';
