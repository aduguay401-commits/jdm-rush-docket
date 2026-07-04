import { calculateCardEstimate } from "@/lib/importCalculator";
import { buildAnchorModelKey } from "@/lib/nurture/consent";
import { buildExactModelKey, getModelFamilyKey } from "@/lib/nurture/modelKeys";
import type { JapanStockInventoryRow } from "@/lib/inventory/japanStock";

export type MatchTier = "T1" | "T2" | "T3";

export interface LeadSavedSearchAnchor {
  docket_id: string;
  email: string;
  anchor_ref: string | null;
  anchor_url: string | null;
  anchor_year: number | string | null;
  anchor_make: string | null;
  anchor_model: string | null;
  anchor_model_key: string | null;
  anchor_price_jpy: number | string | null;
  anchor_card_estimate_cad: number | string | null;
  anchor_duty_type: string | null;
  destination_city: string | null;
  price_band_percent: number | string | null;
  fallback_price_band_percent: number | string | null;
  year_window: number | string | null;
  fallback_year_window: number | string | null;
  max_matches: number | string | null;
  active: boolean | null;
}

export interface NurtureMatchCandidate {
  tier: MatchTier;
  ref: string;
  url: string;
  year: number;
  make: string;
  model: string;
  jpy_fob_price: number;
  duty_type: string;
  card_estimate_cad: number;
  price_delta_cad: number;
  price_delta_percent: number;
  year_delta: number;
  exact_model_key: string | null;
  family_model_key: string | null;
  priority: number | null;
  score: number | null;
  inventory_index: number;
}

export interface NurtureMatchConfig {
  exact_model_key: string | null;
  family_model_key: string | null;
  price_band_percent: number;
  fallback_price_band_percent: number;
  year_window: number;
  fallback_year_window: number;
  max_matches: number;
  exchange_rate: number;
}

export interface NurtureMatchSelection {
  status: "matched" | "skipped_insufficient_matches";
  skip_reason?: "skipped_insufficient_matches";
  matches: NurtureMatchCandidate[];
  match_config: NurtureMatchConfig;
}

type TierRule = {
  tier: MatchTier;
  useFamilyKey: boolean;
  priceBandPercent: number;
  yearWindow: number;
};

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function asValidNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeDutyType(value: string | null): "duty-free" | "full-duty" | null {
  if (value === "duty-free" || value === "full-duty") return value;
  return null;
}

function computeAnchorCardEstimate(
  anchor: LeadSavedSearchAnchor,
  exchangeRate: number,
): number {
  const anchorCardEstimateCad = asValidNumber(anchor.anchor_card_estimate_cad);
  if (anchorCardEstimateCad != null) {
    return anchorCardEstimateCad;
  }

  const anchorPriceJPY = asValidNumber(anchor.anchor_price_jpy);
  const dutyType = normalizeDutyType(anchor.anchor_duty_type);
  if (anchorPriceJPY == null || dutyType == null) {
    throw new Error("Anchor is missing card-estimate inputs");
  }

  return calculateCardEstimate({
    vehiclePriceJPY: anchorPriceJPY,
    dutyType,
    exchangeRate,
  });
}

function compareCandidates(anchorExactModelKey: string | null) {
  return (
    left: NurtureMatchCandidate,
    right: NurtureMatchCandidate,
  ): number => {
    const leftExactRank = left.exact_model_key === anchorExactModelKey ? 0 : 1;
    const rightExactRank = right.exact_model_key === anchorExactModelKey ? 0 : 1;
    if (leftExactRank !== rightExactRank) {
      return leftExactRank - rightExactRank;
    }

    if (left.price_delta_cad !== right.price_delta_cad) {
      return left.price_delta_cad - right.price_delta_cad;
    }

    if (left.year_delta !== right.year_delta) {
      return left.year_delta - right.year_delta;
    }

    const leftPriority = left.priority ?? 0;
    const rightPriority = right.priority ?? 0;
    if (leftPriority !== rightPriority) {
      return rightPriority - leftPriority;
    }

    const leftScore = left.score ?? 0;
    const rightScore = right.score ?? 0;
    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }

    return right.inventory_index - left.inventory_index;
  };
}

function buildTierRules(anchor: LeadSavedSearchAnchor): TierRule[] {
  const priceBandPercent = toNumber(anchor.price_band_percent, 0.15);
  const fallbackPriceBandPercent = Math.max(
    toNumber(anchor.fallback_price_band_percent, 0.25),
    0.25,
  );
  const yearWindow = toNumber(anchor.year_window, 3);
  const fallbackYearWindow = Math.max(
    toNumber(anchor.fallback_year_window, 5),
    5,
  );

  return [
    {
      tier: "T1",
      useFamilyKey: false,
      priceBandPercent,
      yearWindow,
    },
    {
      tier: "T2",
      useFamilyKey: false,
      priceBandPercent: fallbackPriceBandPercent,
      yearWindow: fallbackYearWindow,
    },
    {
      tier: "T3",
      useFamilyKey: true,
      priceBandPercent: Math.max(fallbackPriceBandPercent, 0.35),
      yearWindow: Math.max(fallbackYearWindow, 7),
    },
  ];
}

export function matchLeadSavedSearchToJapanStockInventory(
  anchor: LeadSavedSearchAnchor,
  inventory: JapanStockInventoryRow[],
  exchangeRate: number,
): NurtureMatchSelection {
  const anchorMake = anchor.anchor_make?.trim().toLowerCase() ?? null;
  const anchorYear = asValidNumber(anchor.anchor_year);
  const anchorExactModelKey =
    typeof anchor.anchor_model_key === "string" && anchor.anchor_model_key.trim().length > 0
      ? anchor.anchor_model_key.trim().toLowerCase()
      : buildAnchorModelKey(anchor.anchor_make, anchor.anchor_model);
  const anchorFamilyModelKey = getModelFamilyKey(
    anchor.anchor_make,
    anchor.anchor_model,
    anchorYear,
  );
  const anchorCardEstimateCad = computeAnchorCardEstimate(anchor, exchangeRate);
  const targetMatches = 3;
  const tierRules = buildTierRules(anchor);
  const matches: NurtureMatchCandidate[] = [];
  const seenRefs = new Set<string>();

  for (const tierRule of tierRules) {
    if (matches.length >= targetMatches) break;

    const tierCandidates = inventory
      .map((candidate, inventoryIndex) => {
        const candidateMake = candidate.make.trim().toLowerCase();
        const candidateExactModelKey = buildExactModelKey(candidate.make, candidate.model);
        const candidateFamilyModelKey = getModelFamilyKey(
          candidate.make,
          candidate.model,
          candidate.year,
        );
        const dutyType = normalizeDutyType(candidate.duty_type);
        const candidateYear = asValidNumber(candidate.year);
        const candidatePrice = asValidNumber(candidate.jpy_fob_price);

        if (
          !anchorMake ||
          !anchorExactModelKey ||
          anchorYear == null ||
          dutyType == null ||
          candidateYear == null ||
          candidatePrice == null ||
          candidate.ref === anchor.anchor_ref ||
          candidateMake !== anchorMake ||
          seenRefs.has(candidate.ref)
        ) {
          return null;
        }

        const matchesExactKey =
          candidateExactModelKey != null && candidateExactModelKey === anchorExactModelKey;
        const matchesFamilyKey =
          candidateFamilyModelKey != null && candidateFamilyModelKey === anchorFamilyModelKey;

        if (
          (tierRule.useFamilyKey && !matchesFamilyKey) ||
          (!tierRule.useFamilyKey && !matchesExactKey)
        ) {
          return null;
        }

        const candidateCardEstimateCad = calculateCardEstimate({
          vehiclePriceJPY: candidatePrice,
          dutyType,
          exchangeRate,
        });
        const priceDeltaCad = Math.abs(candidateCardEstimateCad - anchorCardEstimateCad);
        const priceDeltaPercent =
          anchorCardEstimateCad === 0 ? Number.POSITIVE_INFINITY : priceDeltaCad / anchorCardEstimateCad;
        const yearDelta = Math.abs(candidateYear - anchorYear);

        if (
          priceDeltaPercent > tierRule.priceBandPercent ||
          yearDelta > tierRule.yearWindow
        ) {
          return null;
        }

        const candidateMatch: NurtureMatchCandidate = {
          tier: tierRule.tier,
          ref: candidate.ref,
          url: candidate.url,
          year: candidateYear,
          make: candidate.make,
          model: candidate.model,
          jpy_fob_price: candidatePrice,
          duty_type: dutyType,
          card_estimate_cad: candidateCardEstimateCad,
          price_delta_cad: priceDeltaCad,
          price_delta_percent: priceDeltaPercent,
          year_delta: yearDelta,
          exact_model_key: candidateExactModelKey,
          family_model_key: candidateFamilyModelKey,
          priority: candidate.priority,
          score: candidate.score,
          inventory_index: inventoryIndex,
        };

        return candidateMatch;
      })
      .filter((candidate): candidate is NurtureMatchCandidate => candidate != null)
      .sort(compareCandidates(anchorExactModelKey));

    for (const candidate of tierCandidates) {
      if (matches.length >= targetMatches) break;
      if (seenRefs.has(candidate.ref)) continue;
      matches.push(candidate);
      seenRefs.add(candidate.ref);
    }
  }

  const match_config: NurtureMatchConfig = {
    exact_model_key: anchorExactModelKey,
    family_model_key: anchorFamilyModelKey,
    price_band_percent: toNumber(anchor.price_band_percent, 0.15),
    fallback_price_band_percent: toNumber(anchor.fallback_price_band_percent, 0.25),
    year_window: toNumber(anchor.year_window, 3),
    fallback_year_window: toNumber(anchor.fallback_year_window, 5),
    max_matches: toNumber(anchor.max_matches, 3),
    exchange_rate: exchangeRate,
  };

  if (matches.length < targetMatches) {
    return {
      status: "skipped_insufficient_matches",
      skip_reason: "skipped_insufficient_matches",
      matches,
      match_config,
    };
  }

  return {
    status: "matched",
    matches,
    match_config,
  };
}
