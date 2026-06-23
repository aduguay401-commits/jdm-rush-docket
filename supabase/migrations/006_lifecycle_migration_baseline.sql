-- Migration: Lifecycle baseline schema gaps
-- Context: Captures live schema additions required before customer lifecycle work.
-- Idempotent: safe to run even if the column and table already exist.

ALTER TABLE public.dockets
  ADD COLUMN IF NOT EXISTS vehicle_description text;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
