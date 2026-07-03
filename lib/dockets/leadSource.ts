export type LeadSource = "exact_quote" | "find_my_jdm";
export type MarketableLeadView = "garage" | "quote" | "find";
export type LeadOrigin = MarketableLeadView | "legacy";

export type LeadSourceDocket = {
  customer_id?: string | null;
  lead_source?: string | null;
};

export const MARKETABLE_LEAD_VIEWS: Array<{
  id: MarketableLeadView;
  label: string;
  description: string;
}> = [
  {
    id: "garage",
    label: "My Garage",
    description: "Customer accounts",
  },
  {
    id: "quote",
    label: "Quote Leads",
    description: "Exact quote origin",
  },
  {
    id: "find",
    label: "Find My JDM",
    description: "Concierge origin",
  },
];

export function getLeadOrigin(docket: LeadSourceDocket): LeadOrigin {
  if (docket.customer_id) {
    return "garage";
  }

  if (docket.lead_source === "exact_quote") {
    return "quote";
  }

  if (docket.lead_source === "find_my_jdm") {
    return "find";
  }

  return "legacy";
}

export function getLeadOriginLabel(docket: LeadSourceDocket) {
  switch (getLeadOrigin(docket)) {
    case "garage":
      return "My Garage";
    case "quote":
      return "Quote Lead";
    case "find":
      return "Find My JDM";
    default:
      return "Unclassified";
  }
}

export function getLeadSourceLabel(leadSource: string | null | undefined) {
  switch (leadSource) {
    case "exact_quote":
      return "Exact Quote";
    case "find_my_jdm":
      return "Find My JDM";
    default:
      return "Unclassified";
  }
}

export function countMarketableLeadViews<TDocket extends LeadSourceDocket>(dockets: TDocket[]) {
  return {
    garage: dockets.filter((docket) => getLeadOrigin(docket) === "garage").length,
    quote: dockets.filter((docket) => getLeadOrigin(docket) === "quote").length,
    find: dockets.filter((docket) => getLeadOrigin(docket) === "find").length,
  } satisfies Record<MarketableLeadView, number>;
}

export function isInMarketableLeadView<TDocket extends LeadSourceDocket>(
  docket: TDocket,
  view: MarketableLeadView,
) {
  return getLeadOrigin(docket) === view;
}
