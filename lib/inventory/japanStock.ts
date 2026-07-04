import "server-only";

export const JAPAN_STOCK_INVENTORY_URL =
  process.env.NEXT_PUBLIC_INVENTORY_JSON_URL ??
  "https://pub-bdd20802389040418fff72581ee2390d.r2.dev/inventory.json";

export interface JapanStockInventoryRow {
  ref: string;
  url: string;
  year: number;
  make: string;
  model: string;
  transmission: string | null;
  drivetrain: string | null;
  fuel: string | null;
  images: unknown[];
  jpy_fob_price: number;
  engine_size_cc: string | null;
  steering: string | null;
  ext_color: string | null;
  auction_grade: string | null;
  registration_year_month: string | null;
  manufacture_year_month: string | null;
  duty_type: string;
  priority: number | null;
  mileage_km: number | null;
  score: number | null;
  specs?: unknown;
}

export type JapanStockInventory = JapanStockInventoryRow[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asNullableString(value: unknown): string | null {
  if (value == null) return null;
  return asString(value);
}

function asNullableNumber(value: unknown): number | null {
  if (value == null) return null;
  return asNumber(value);
}

export function isJapanStockInventoryRow(
  value: unknown,
): value is JapanStockInventoryRow {
  if (!isRecord(value)) return false;

  return (
    asString(value.ref) != null &&
    asString(value.url) != null &&
    asNumber(value.year) != null &&
    asString(value.make) != null &&
    asString(value.model) != null &&
    asNumber(value.jpy_fob_price) != null &&
    asString(value.duty_type) != null
  );
}

export function normalizeJapanStockInventoryRow(
  value: Record<string, unknown>,
): JapanStockInventoryRow | null {
  if (!isJapanStockInventoryRow(value)) return null;

  const images = Array.isArray(value.images) ? value.images : [];

  return {
    ref: value.ref,
    url: value.url,
    year: value.year,
    make: value.make,
    model: value.model,
    transmission: asNullableString(value.transmission),
    drivetrain: asNullableString(value.drivetrain),
    fuel: asNullableString(value.fuel),
    images,
    jpy_fob_price: value.jpy_fob_price,
    engine_size_cc: asNullableString(value.engine_size_cc),
    steering: asNullableString(value.steering),
    ext_color: asNullableString(value.ext_color),
    auction_grade: asNullableString(value.auction_grade),
    registration_year_month: asNullableString(value.registration_year_month),
    manufacture_year_month: asNullableString(value.manufacture_year_month),
    duty_type: value.duty_type,
    priority: asNullableNumber(value.priority),
    mileage_km: asNullableNumber(value.mileage_km),
    score: asNullableNumber(value.score),
    ...(Object.prototype.hasOwnProperty.call(value, "specs")
      ? { specs: value.specs }
      : {}),
  };
}

export async function fetchJapanStockInventory(): Promise<JapanStockInventory> {
  const res = await fetch(JAPAN_STOCK_INVENTORY_URL, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(
      `Failed to fetch Japan Stock inventory: ${res.status} ${res.statusText}`,
    );
  }

  const data: unknown = await res.json();
  if (!Array.isArray(data)) {
    throw new Error("Japan Stock inventory is not an array");
  }

  return data
    .filter(isRecord)
    .map((row) => normalizeJapanStockInventoryRow(row))
    .filter((row): row is JapanStockInventoryRow => row != null);
}
