-- Capture live docket_status_history schema.
-- Source of truth: live Supabase PostgREST metadata and service-role read-only sampling on 2026-05-01.

CREATE TABLE IF NOT EXISTS public.docket_status_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    docket_id uuid,
    old_status text,
    new_status text,
    changed_at timestamptz DEFAULT now(),
    changed_by text
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'docket_status_history_pkey'
          AND conrelid = 'public.docket_status_history'::regclass
    ) THEN
        ALTER TABLE public.docket_status_history
            ADD CONSTRAINT docket_status_history_pkey PRIMARY KEY (id);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'docket_status_history_docket_id_fkey'
          AND conrelid = 'public.docket_status_history'::regclass
    ) THEN
        ALTER TABLE public.docket_status_history
            ADD CONSTRAINT docket_status_history_docket_id_fkey
            FOREIGN KEY (docket_id) REFERENCES public.dockets(id) ON DELETE CASCADE;
    END IF;
END
$$;

ALTER TABLE public.docket_status_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'docket_status_history'
          AND policyname = 'Authenticated users can read docket status history'
    ) THEN
        CREATE POLICY "Authenticated users can read docket status history"
            ON public.docket_status_history
            FOR SELECT
            TO authenticated
            USING (true);
    END IF;
END
$$;
