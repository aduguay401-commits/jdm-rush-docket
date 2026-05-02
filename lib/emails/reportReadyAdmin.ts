type NullableNumber = number | null | undefined;

export type ReportReadyDealerOptionSummary = {
  optionNumber: number;
  year: string;
  make: string;
  model: string;
  dealerPriceJpy: number;
  totalDeliveredCad: number;
};

export type ReportReadyAuctionSummary = {
  hammerLowJpy: NullableNumber;
  hammerHighJpy: NullableNumber;
  recommendedMaxBidJpy: NullableNumber;
  estimateLowCad: NullableNumber;
  estimateHighCad: NullableNumber;
  midpointCad: NullableNumber;
  auctionSalesCount?: NullableNumber;
  auctionListingsCount: number;
};

export type ReportReadyAdminEmailInput = {
  docketId: string;
  reportUrlToken: string | null;
  customerName: string;
  agentName?: string | null;
  destination: string;
  timeline: string;
  overallNotes: string;
  dealerOptions: ReportReadyDealerOptionSummary[];
  auction: ReportReadyAuctionSummary | null;
};

export type ReportReadyAdminEmail = {
  subject: string;
  html: string;
  text: string;
};

const APP_URL = "https://docket.jdmrushimports.ca";
const BRAND_ORANGE = "#E55125";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatCad(value: NullableNumber) {
  if (!Number.isFinite(value)) {
    return "";
  }

  return `$${Math.round(value as number).toLocaleString("en-CA")} CAD`;
}

function formatCadCompact(value: NullableNumber) {
  if (!Number.isFinite(value)) {
    return "";
  }

  return `$${Math.round((value as number) / 1000)}K`;
}

function formatCadRangeCompact(values: number[]) {
  const validValues = values.filter((value) => Number.isFinite(value));

  if (validValues.length === 0) {
    return "";
  }

  const min = Math.min(...validValues);
  const max = Math.max(...validValues);
  const minK = Math.round(min / 1000);
  const maxK = Math.round(max / 1000);

  return minK === maxK ? `$${minK}K` : `$${minK}-$${maxK}K`;
}

function formatJpy(value: NullableNumber) {
  if (!Number.isFinite(value)) {
    return "";
  }

  return `¥${Math.round(value as number).toLocaleString("ja-JP")}`;
}

function formatVehicleLabel(option: ReportReadyDealerOptionSummary) {
  const year = option.year.trim();
  const make = option.make.trim();
  const model = option.model.trim();

  if (make && model) {
    return [year, make, model].filter(Boolean).join(" ");
  }

  if (model) {
    return [year, model].filter(Boolean).join(" ");
  }

  return [year, "vehicle"].filter(Boolean).join(" ");
}

function getDealerRangeValues(dealerOptions: ReportReadyDealerOptionSummary[]) {
  return dealerOptions
    .map((option) => option.totalDeliveredCad)
    .filter((value) => Number.isFinite(value));
}

function getAuctionRangeValues(auction: ReportReadyAuctionSummary | null) {
  if (!auction) {
    return [];
  }

  const low = Number.isFinite(auction.estimateLowCad) ? (auction.estimateLowCad as number) : null;
  const high = Number.isFinite(auction.estimateHighCad) ? (auction.estimateHighCad as number) : null;

  if (low !== null && high !== null) {
    return [low, high];
  }

  return Number.isFinite(auction.midpointCad) ? [auction.midpointCad as number] : [];
}

function buildSubject(input: ReportReadyAdminEmailInput, hasDealerOptions: boolean, hasAuction: boolean) {
  const customerName = input.customerName.trim() || "Unknown Customer";
  const dealerValues = getDealerRangeValues(input.dealerOptions);
  const auctionValues = getAuctionRangeValues(input.auction);

  if (hasDealerOptions && hasAuction) {
    const range = formatCadRangeCompact([...dealerValues, ...auctionValues]);
    const rangeSuffix = range ? ` · ${range}` : "";
    return `Report sent: ${customerName} · ${input.dealerOptions.length} options + auction${rangeSuffix}`;
  }

  if (hasDealerOptions) {
    const range = formatCadRangeCompact(dealerValues);
    const rangeSuffix = range ? ` · ${range}` : "";
    return `Report sent: ${customerName} · ${input.dealerOptions.length} options${rangeSuffix}`;
  }

  const range = formatCadRangeCompact(auctionValues);
  const rangeSuffix = range ? ` · est. ${range}` : "";
  return `Report sent: ${customerName} · auction research${rangeSuffix}`;
}

function renderSummaryLines(input: ReportReadyAdminEmailInput, hasDealerOptions: boolean, hasAuction: boolean) {
  const dealerValues = getDealerRangeValues(input.dealerOptions);
  const auctionValues = getAuctionRangeValues(input.auction);
  const lines: string[] = [];

  if (hasDealerOptions && hasAuction) {
    lines.push(`🚗 ${input.dealerOptions.length} dealer options · 🔨 Auction research included`);

    const dealerRange = formatCadRangeCompact(dealerValues);
    if (dealerRange) {
      lines.push(`💰 Dealer range: ${dealerRange} CAD delivered`);
    }

    if (input.auction?.midpointCad) {
      lines.push(`💰 Auction estimate: ~${formatCadCompact(input.auction.midpointCad)} CAD (midpoint)`);
    }
  } else if (hasDealerOptions) {
    lines.push(`🚗 ${input.dealerOptions.length} dealer options · No auction lots`);

    const dealerRange = formatCadRangeCompact(dealerValues);
    if (dealerRange) {
      lines.push(`💰 Price range: ${dealerRange} CAD delivered`);
    }
  } else if (hasAuction && input.auction) {
    lines.push("🔨 Auction research · No dealer options");

    const hammerRange =
      input.auction.hammerLowJpy && input.auction.hammerHighJpy
        ? `${formatJpy(input.auction.hammerLowJpy)} – ${formatJpy(input.auction.hammerHighJpy)}`
        : "";
    const maxBid = formatJpy(input.auction.recommendedMaxBidJpy);
    if (hammerRange || maxBid) {
      lines.push(
        `💰 ${hammerRange ? `Hammer range: ${hammerRange}` : ""}${
          hammerRange && maxBid ? " · " : ""
        }${maxBid ? `Recommended max bid: ${maxBid}` : ""}`
      );
    }

    const deliveredRange = formatCadRangeCompact(auctionValues);
    const midpoint = formatCadCompact(input.auction.midpointCad);
    if (deliveredRange || midpoint) {
      lines.push(
        `💰 Estimated delivered: ${deliveredRange || midpoint} CAD${midpoint ? ` (midpoint ~${midpoint})` : ""}`
      );
    }
  }

  if (input.destination.trim()) {
    lines.push(`📍 Destination: ${input.destination.trim()}`);
  }

  if (input.timeline.trim()) {
    lines.push(`⏱ Timeline: ${input.timeline.trim()}`);
  }

  return lines;
}

function renderHtmlListItems(lines: string[]) {
  return lines
    .map(
      (line) =>
        `<div style="margin:0 0 8px 0;font-size:15px;line-height:1.5;color:#ffffff;">${escapeHtml(line)}</div>`
    )
    .join("");
}

function renderDealerOptionsHtml(dealerOptions: ReportReadyDealerOptionSummary[]) {
  if (dealerOptions.length === 0) {
    return "";
  }

  const sortedOptions = [...dealerOptions].sort((a, b) => a.totalDeliveredCad - b.totalDeliveredCad);
  const items = sortedOptions
    .map((option) => {
      const parts = [
        escapeHtml(formatVehicleLabel(option)),
        escapeHtml(formatJpy(option.dealerPriceJpy)),
        escapeHtml(formatCad(option.totalDeliveredCad)),
      ].filter(Boolean);

      return `<li style="margin:0 0 8px 0;color:#ffffff;line-height:1.5;">${parts.join(" · ")}</li>`;
    })
    .join("");

  return `<h2 style="margin:24px 0 10px 0;font-size:16px;line-height:1.3;color:#ffffff;">Dealer options (sorted by price, low to high):</h2><ul style="margin:0;padding-left:20px;">${items}</ul>`;
}

function renderDealerOptionsText(dealerOptions: ReportReadyDealerOptionSummary[]) {
  if (dealerOptions.length === 0) {
    return "";
  }

  const sortedOptions = [...dealerOptions].sort((a, b) => a.totalDeliveredCad - b.totalDeliveredCad);
  const lines = sortedOptions.map((option) => {
    return `- ${formatVehicleLabel(option)} · ${formatJpy(option.dealerPriceJpy)} · ${formatCad(
      option.totalDeliveredCad
    )}`;
  });

  return `Dealer options (sorted by price, low to high):\n${lines.join("\n")}`;
}

function renderAuctionHtml(auction: ReportReadyAuctionSummary | null) {
  if (!auction) {
    return "";
  }

  const lines = [
    auction.hammerLowJpy && auction.hammerHighJpy
      ? `Hammer range: ${formatJpy(auction.hammerLowJpy)} – ${formatJpy(auction.hammerHighJpy)}`
      : "",
    auction.recommendedMaxBidJpy ? `Recommended max bid: ${formatJpy(auction.recommendedMaxBidJpy)}` : "",
    Number.isFinite(auction.auctionSalesCount)
      ? `${auction.auctionSalesCount} recent auction sales analyzed`
      : "",
    auction.auctionListingsCount > 0 ? `${auction.auctionListingsCount} current weekly listings included` : "",
  ].filter(Boolean);

  if (lines.length === 0) {
    return "";
  }

  const items = lines
    .map((line) => `<li style="margin:0 0 8px 0;color:#ffffff;line-height:1.5;">${escapeHtml(line)}</li>`)
    .join("");

  return `<h2 style="margin:24px 0 10px 0;font-size:16px;line-height:1.3;color:#ffffff;">Auction option:</h2><ul style="margin:0;padding-left:20px;">${items}</ul>`;
}

function renderAuctionText(auction: ReportReadyAuctionSummary | null) {
  if (!auction) {
    return "";
  }

  const lines = [
    auction.hammerLowJpy && auction.hammerHighJpy
      ? `- Hammer range: ${formatJpy(auction.hammerLowJpy)} - ${formatJpy(auction.hammerHighJpy)}`
      : "",
    auction.recommendedMaxBidJpy ? `- Recommended max bid: ${formatJpy(auction.recommendedMaxBidJpy)}` : "",
    Number.isFinite(auction.auctionSalesCount)
      ? `- ${auction.auctionSalesCount} recent auction sales analyzed`
      : "",
    auction.auctionListingsCount > 0 ? `- ${auction.auctionListingsCount} current weekly listings included` : "",
  ].filter(Boolean);

  return lines.length > 0 ? `Auction option:\n${lines.join("\n")}` : "";
}

function renderRecommendationHtml(overallNotes: string) {
  const notes = overallNotes.trim();

  if (!notes) {
    return "";
  }

  return `<h2 style="margin:24px 0 10px 0;font-size:16px;line-height:1.3;color:#ffffff;">Agent recommendation:</h2><blockquote style="margin:0;padding:14px 16px;border-left:3px solid ${BRAND_ORANGE};background:#151515;color:#dddddd;font-style:italic;line-height:1.6;">${escapeHtml(
    notes
  ).replace(/\n/g, "<br>")}</blockquote>`;
}

function renderRecommendationText(overallNotes: string) {
  const notes = overallNotes.trim();

  return notes ? `Agent recommendation:\n${notes}` : "";
}

export function buildReportReadyAdminEmail(input: ReportReadyAdminEmailInput): ReportReadyAdminEmail {
  const hasDealerOptions = input.dealerOptions.length > 0;
  const hasAuction = input.auction !== null;
  const subject = buildSubject(input, hasDealerOptions, hasAuction);
  const customerName = input.customerName.trim() || "Unknown Customer";
  const agentLabel = input.agentName?.trim() || "The agent";
  const opening =
    agentLabel === "The agent"
      ? `The agent just sent ${customerName}'s research report.`
      : `${agentLabel} just sent ${customerName}'s research report.`;
  const summaryLines = renderSummaryLines(input, hasDealerOptions, hasAuction);
  const reportUrl = input.reportUrlToken ? `${APP_URL}/report/${encodeURIComponent(input.reportUrlToken)}` : null;
  const dashboardUrl = `${APP_URL}/admin/dashboard?docket=${encodeURIComponent(input.docketId)}`;

  const ctaHtml = `<div style="margin-top:28px;padding-top:18px;border-top:1px solid #262626;">
    ${
      reportUrl
        ? `<p style="margin:0 0 10px 0;"><a href="${reportUrl}" style="color:${BRAND_ORANGE};text-decoration:underline;font-weight:600;">→ View customer report</a></p>`
        : ""
    }
    <p style="margin:0;"><a href="${dashboardUrl}" style="color:${BRAND_ORANGE};text-decoration:underline;font-weight:600;">→ Open docket in dashboard</a></p>
  </div>`;

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#0d0d0d;font-family:Arial,Helvetica,sans-serif;color:#ffffff;">
    <div style="max-width:640px;margin:0 auto;padding:28px 20px;">
      <p style="margin:0 0 18px 0;font-size:16px;line-height:1.5;color:#ffffff;">${escapeHtml(opening)}</p>
      <div style="margin:0;padding:16px 18px;background:#151515;border:1px solid #262626;border-radius:8px;">
        ${renderHtmlListItems(summaryLines)}
      </div>
      ${renderRecommendationHtml(input.overallNotes)}
      ${renderDealerOptionsHtml(input.dealerOptions)}
      ${renderAuctionHtml(input.auction)}
      ${ctaHtml}
      <p style="margin:28px 0 0 0;color:#888888;font-size:13px;">— JDM Rush System</p>
    </div>
  </body>
</html>`;

  const ctaText = [
    reportUrl ? `→ View customer report: ${reportUrl}` : "",
    `→ Open docket in dashboard: ${dashboardUrl}`,
  ].filter(Boolean);
  const textSections = [
    opening,
    summaryLines.join("\n"),
    renderRecommendationText(input.overallNotes),
    renderDealerOptionsText(input.dealerOptions),
    renderAuctionText(input.auction),
    ctaText.join("\n"),
    "— JDM Rush System",
  ].filter(Boolean);

  return {
    subject,
    html,
    text: textSections.join("\n\n"),
  };
}
