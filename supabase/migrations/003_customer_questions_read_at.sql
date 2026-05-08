-- Migration: Add read_at column to customer_questions table
-- Context: Column exists in production but was missing from canonical schema.
-- This migration captures it for repeatability.
-- Idempotent: safe to run even if column already exists.

ALTER TABLE public.customer_questions
  ADD COLUMN IF NOT EXISTS read_at timestamp with time zone NULL;

CREATE INDEX IF NOT EXISTS idx_customer_questions_docket_unread
  ON public.customer_questions (docket_id)
  WHERE read_at IS NULL;
