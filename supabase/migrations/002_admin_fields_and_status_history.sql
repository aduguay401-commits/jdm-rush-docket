-- Add admin-facing fields and status history tracking for dockets

ALTER TABLE dockets
  ADD COLUMN IF NOT EXISTS admin_notes text,
  ADD COLUMN IF NOT EXISTS is_flagged boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_paused boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS paused_until timestamptz,
  ADD COLUMN IF NOT EXISTS lost_reason text,
  ADD COLUMN IF NOT EXISTS estimated_deal_value numeric;

CREATE TABLE IF NOT EXISTS docket_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  docket_id uuid NOT NULL REFERENCES dockets(id) ON DELETE CASCADE,
  old_status text,
  new_status text,
  changed_by text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE docket_status_history ENABLE ROW LEVEL SECURITY;
