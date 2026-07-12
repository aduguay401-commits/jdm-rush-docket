// Client-safe shipment stage vocabulary (roadmap Phase 3 §4.2). The order IS the
// forward-only sequence. current_stage defaults to "pre-shipment" at creation.

export const SHIPMENT_STAGES = [
  { slug: "pre-shipment", label: "Pre-shipment" },
  { slug: "purchased", label: "Purchased" },
  { slug: "at-port-japan", label: "At port (Japan), awaiting vessel" },
  { slug: "vessel-booked", label: "Vessel booked / departing" },
  { slug: "departed-japan", label: "Departed Japan / in transit" },
  { slug: "arrived-canada", label: "Arrived at Canadian port" },
  { slug: "clearing-customs", label: "Clearing customs" },
  { slug: "cleared-customs", label: "Cleared customs — awaiting transport" },
  { slug: "on-transport", label: "On transport truck" },
  { slug: "delivered", label: "Delivered" },
] as const;

export type ShipmentStageSlug = (typeof SHIPMENT_STAGES)[number]["slug"];

export type ShipmentStageHistoryItem = {
  id: string;
  old_stage: string | null;
  new_stage: string;
  changed_at: string;
  changed_by: string;
  notes: string | null;
};

export function getStageIndex(slug: string | null | undefined): number {
  return SHIPMENT_STAGES.findIndex((stage) => stage.slug === slug);
}

export function getStageLabel(slug: string | null | undefined): string {
  const found = SHIPMENT_STAGES.find((stage) => stage.slug === slug);
  return found ? found.label : slug ?? "Unknown";
}

export function isValidStage(slug: unknown): slug is ShipmentStageSlug {
  return typeof slug === "string" && SHIPMENT_STAGES.some((stage) => stage.slug === slug);
}

// Forward-only: the target must sit strictly later in the sequence than current.
export function isForwardStage(current: string | null | undefined, next: string): boolean {
  const currentIndex = getStageIndex(current);
  const nextIndex = getStageIndex(next);
  return currentIndex >= 0 && nextIndex >= 0 && nextIndex > currentIndex;
}

// The stages a shipment may still advance TO (everything after the current one).
export function getForwardStages(current: string | null | undefined) {
  const currentIndex = getStageIndex(current);
  return SHIPMENT_STAGES.filter((_, index) => index > currentIndex);
}

// 0..1 progress through the sequence, for a progress bar.
export function getStageProgress(current: string | null | undefined): number {
  const index = getStageIndex(current);
  if (index < 0) {
    return 0;
  }
  return index / (SHIPMENT_STAGES.length - 1);
}
