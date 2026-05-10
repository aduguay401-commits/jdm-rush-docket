-- Migration: Add agent_recommendation column to dockets table
-- Context: Overall Notes / Your Recommendation must persist for dealer-only reports.
-- This column is the canonical customer-facing recommendation source going forward.
-- Adam already ran this manually in Supabase; this file documents it for repeatability.
-- Idempotent: safe to run even if the column and backfill already exist.

ALTER TABLE public.dockets
  ADD COLUMN IF NOT EXISTS agent_recommendation text NULL;

UPDATE public.dockets
SET agent_recommendation = research_draft->>'overallNotes'
WHERE agent_recommendation IS NULL
  AND research_draft->>'overallNotes' IS NOT NULL
  AND research_draft->>'overallNotes' != '';
