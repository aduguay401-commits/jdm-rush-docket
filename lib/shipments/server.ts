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
export function isMissingShipmentsTable(
  error: { message?: string | null; code?: string | null } | null | undefined,
): boolean {
  if (!error) {
    return false;
  }
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();
  // Postgres undefined_table (42P01) or PostgREST schema-cache miss (PGRST205),
  // scoped to the shipments tables so an unrelated error can't masquerade as fail-open.
  if ((code === "42P01" || code === "PGRST205") && message.includes("shipment")) {
    return true;
  }
  return (
    message.includes('relation "public.shipments" does not exist') ||
    message.includes('relation "public.shipment_stage_history" does not exist') ||
    message.includes("could not find the table 'public.shipments'") ||
    message.includes("could not find the table 'public.shipment_stage_history'")
  );
}
