import "server-only";

// Column separation lives here so it is impossible to accidentally SELECT
// internal_notes on a customer path: the customer list NEVER includes it.
export const SHIPMENT_CUSTOMER_COLUMNS =
  "id, docket_id, vessel_name, voyage_number, bill_of_lading, container_number, port_of_loading, port_of_discharge, estimated_departure_date, estimated_arrival_date, actual_departure_date, actual_arrival_date, current_stage, stage_updated_at, customer_visible_notes, marine_traffic_url, updated_at";

// Full row (agent/service-role only) — adds the internal columns.
export const SHIPMENT_AGENT_COLUMNS = `${SHIPMENT_CUSTOMER_COLUMNS}, internal_notes, created_at`;

// Agent-editable whitelist (never current_stage — that advances via the guarded
// forward-only route — and never docket_id / timestamps).
export const SHIPMENT_EDITABLE_FIELDS = [
  "vessel_name",
  "voyage_number",
  "bill_of_lading",
  "container_number",
  "port_of_loading",
  "port_of_discharge",
  "estimated_departure_date",
  "estimated_arrival_date",
  "actual_departure_date",
  "actual_arrival_date",
  "marine_traffic_url",
  "customer_visible_notes",
  "internal_notes",
] as const;

// A missing shipments/shipment_stage_history table (migration 015 not yet run)
// must degrade to a quiet "not enabled" state, never a 500.
export function isMissingShipmentsTable(error: { message?: string | null } | null | undefined): boolean {
  const message = (error?.message ?? "").toLowerCase();
  return (
    message.includes("shipment") ||
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    message.includes("relation")
  );
}
