-- Migration: Customers table and customer auth link
-- Context: Stage 0.2 foundation for customer lifecycle magic-link login.
-- Idempotent: safe to run even if the table, column, index, and RLS state already exist.

CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  first_name text,
  last_name text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz,
  deleted_at timestamptz
);

ALTER TABLE public.dockets ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id);
CREATE INDEX IF NOT EXISTS idx_dockets_customer_id ON public.dockets(customer_id);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
