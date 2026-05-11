CREATE TABLE docket_activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  docket_id UUID NOT NULL REFERENCES dockets(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_category TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id UUID,
  actor_email TEXT,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX docket_activity_events_docket_id_idx ON docket_activity_events(docket_id);
CREATE INDEX docket_activity_events_created_at_idx ON docket_activity_events(created_at DESC);
CREATE INDEX docket_activity_events_event_type_idx ON docket_activity_events(event_type);

ALTER TABLE docket_activity_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY 'docket_activity_events_service_role_all'
  ON docket_activity_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY 'docket_activity_events_authenticated_select'
  ON docket_activity_events
  FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON TABLE docket_activity_events IS 'Generic audit log for docket-related events. Used for tracking admin actions, edits, and future event types.';
