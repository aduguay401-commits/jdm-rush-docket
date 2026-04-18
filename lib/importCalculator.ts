export type VehicleType = "regular" | "suv";
export type DutyType = "duty-free" | "full-duty";
export type DestinationCity =
  | "victoria-bc"
  | "duncan-bc"
  | "richmond-bc"
  | "kamloops-bc"
  | "kelowna-bc"
  | "okanagan-bc"
  | "regina-sk"
  | "saskatoon-sk"
  | "winnipeg-mb"
  | "toronto-on"
  | "calgary-ab"
  | "edmonton-ab"
  | "montreal-qc";

type Province = "BC" | "SK" | "MB" | "ON" | "AB" | "QC";

export type CalculatorInput = {
  vehiclePriceJPY: number;
  destinationCity: DestinationCity;
  vehicleType: VehicleType;
  dutyType: DutyType;
  exchangeRate: number;
};

export type FeeBreakdown = {
  input: CalculatorInput;
  destinationLabel: string;
  province: Province;
  vehicleValueCAD: number;
  dealerPriceCAD: number;
  shippingInsuranceJPY: number;
  shippingInsuranceCAD: number;
  exportAgentFeeJPY: number;
  exportAgentFeeCAD: number;
  jdmRushFeeCAD: number;
  dutyRate: number;
  dutyCAD: number;
  exciseTaxCAD: number;
  gstRate: number;
  gstCAD: number;
  wwsTerminalFeeCAD: number;
  brokerageFeeCAD: number;
  networkFeeCAD: number;
  financeAdminFeeCAD: number;
  transportCostCAD: number;
  valueForDutyCAD: number;
  valueForGSTCAD: number;
  pstRate: number;
  pstCAD: number;
  totalDeliveredCAD: number;
};

const FEES = {
  shippingInsuranceJPY: 250000,
  exciseTaxCAD: 100,
  gstRate: 0.05,
  wwsTerminalFeeCAD: 508.77,
  brokerageFeeCAD: 375,
  networkFeeCAD: 800,
  financeAdminFeeCAD: 225,
} as const;

const DUTY_RATES: Record<DutyType, number> = {
  "duty-free": 0,
  "full-duty": 0.061,
};

const PST_RATES: Record<Province, number> = {
  BC: 0.07,
  SK: 0.06,
  MB: 0.07,
  ON: 0.08,
  AB: 0,
  QC: 0.09975,
};

const TRANSPORT_COSTS: Record<
  VehicleType,
  Record<DestinationCity, { cost: number; province: Province; label: string }>
> = {
  regular: {
    "victoria-bc": { cost: 603.75, province: "BC", label: "Victoria, Vancouver Island" },
    "duncan-bc": { cost: 708.75, province: "BC", label: "Duncan, Vancouver Island" },
    "richmond-bc": { cost: 262.5, province: "BC", label: "Richmond" },
    "kamloops-bc": { cost: 630, province: "BC", label: "Kamloops" },
    "kelowna-bc": { cost: 630, province: "BC", label: "Kelowna" },
    "okanagan-bc": { cost: 630, province: "BC", label: "Okanagan" },
    "regina-sk": { cost: 1785, province: "SK", label: "Regina" },
    "saskatoon-sk": { cost: 1785, province: "SK", label: "Saskatoon & Surrounding" },
    "winnipeg-mb": { cost: 1785, province: "MB", label: "Winnipeg & Surrounding" },
    "toronto-on": { cost: 2300, province: "ON", label: "Toronto/Ottawa & Surrounding" },
    "calgary-ab": { cost: 787.5, province: "AB", label: "Calgary/Airdrie & Surrounding" },
    "edmonton-ab": { cost: 787.5, province: "AB", label: "Edmonton/Sherwood Park & Surrounding" },
    "montreal-qc": { cost: 2205, province: "QC", label: "Montreal & Surrounding" },
  },
  suv: {
    "victoria-bc": { cost: 761.25, province: "BC", label: "Victoria, Vancouver Island" },
    "duncan-bc": { cost: 866.25, province: "BC", label: "Duncan, Vancouver Island" },
    "richmond-bc": { cost: 420, province: "BC", label: "Richmond" },
    "kamloops-bc": { cost: 787.5, province: "BC", label: "Kamloops" },
    "kelowna-bc": { cost: 787.5, province: "BC", label: "Kelowna" },
    "okanagan-bc": { cost: 787.5, province: "BC", label: "Okanagan" },
    "regina-sk": { cost: 1935, province: "SK", label: "Regina" },
    "saskatoon-sk": { cost: 1935, province: "SK", label: "Saskatoon & Surrounding" },
    "winnipeg-mb": { cost: 1935, province: "MB", label: "Winnipeg & Surrounding" },
    "toronto-on": { cost: 2510, province: "ON", label: "Toronto/Ottawa & Surrounding" },
    "calgary-ab": { cost: 945, province: "AB", label: "Calgary/Airdrie & Surrounding" },
    "edmonton-ab": { cost: 945, province: "AB", label: "Edmonton/Sherwood Park & Surrounding" },
    "montreal-qc": { cost: 2520, province: "QC", label: "Montreal & Surrounding" },
  },
};

const DESTINATION_CITY_ALIASES: Record<string, DestinationCity> = {
  // Canonical slugs
  "victoria-bc": "victoria-bc",
  "duncan-bc": "duncan-bc",
  "richmond-bc": "richmond-bc",
  "kamloops-bc": "kamloops-bc",
  "kelowna-bc": "kelowna-bc",
  "okanagan-bc": "okanagan-bc",
  "regina-sk": "regina-sk",
  "saskatoon-sk": "saskatoon-sk",
  "winnipeg-mb": "winnipeg-mb",
  "toronto-on": "toronto-on",
  "calgary-ab": "calgary-ab",
  "edmonton-ab": "edmonton-ab",
  "montreal-qc": "montreal-qc",

  // Human-readable aliases
  victoria: "victoria-bc",
  duncan: "duncan-bc",
  richmond: "richmond-bc",
  kamloops: "kamloops-bc",
  kelowna: "kelowna-bc",
  okanagan: "okanagan-bc",
  regina: "regina-sk",
  saskatoon: "saskatoon-sk",
  winnipeg: "winnipeg-mb",
  toronto: "toronto-on",
  ottawa: "toronto-on",
  calgary: "calgary-ab",
  edmonton: "edmonton-ab",
  montreal: "montreal-qc",
  vancouver: "richmond-bc",
  halifax: "montreal-qc",

  // Province variants
  "victoria bc": "victoria-bc",
  "duncan bc": "duncan-bc",
  "richmond bc": "richmond-bc",
  "kamloops bc": "kamloops-bc",
  "kelowna bc": "kelowna-bc",
  "okanagan bc": "okanagan-bc",
  "regina sk": "regina-sk",
  "saskatoon sk": "saskatoon-sk",
  "winnipeg mb": "winnipeg-mb",
  "toronto on": "toronto-on",
  "ottawa on": "toronto-on",
  "calgary ab": "calgary-ab",
  "edmonton ab": "edmonton-ab",
  "montreal qc": "montreal-qc",
  "vancouver bc": "richmond-bc",
  "halifax ns": "montreal-qc",

  // Comma variants
  "victoria, bc": "victoria-bc",
  "duncan, bc": "duncan-bc",
  "richmond, bc": "richmond-bc",
  "kamloops, bc": "kamloops-bc",
  "kelowna, bc": "kelowna-bc",
  "okanagan, bc": "okanagan-bc",
  "regina, sk": "regina-sk",
  "saskatoon, sk": "saskatoon-sk",
  "winnipeg, mb": "winnipeg-mb",
  "toronto, on": "toronto-on",
  "ottawa, on": "toronto-on",
  "calgary, ab": "calgary-ab",
  "edmonton, ab": "edmonton-ab",
  "montreal, qc": "montreal-qc",
  "vancouver, bc": "richmond-bc",
  "halifax, ns": "montreal-qc",
};

const PROVINCE_SUFFIX_PATTERN = /(?:,\s*|\s+)(bc|ab|sk|mb|on|qc|ns)$/i;

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function getJdmRushFee(vehicleValueCAD: number): number {
  if (vehicleValueCAD <= 10000) return 1000;
  if (vehicleValueCAD <= 20000) return 1500;
  if (vehicleValueCAD <= 30000) return 2000;
  return 3500;
}

function getExportAgentFeeJPY(priceJPY: number): number {
  if (priceJPY <= 1000000) {
    return 50000;
  }
  if (priceJPY <= 3000000) {
    return 50000 + (priceJPY - 1000000) * 0.08;
  }
  if (priceJPY <= 5000000) {
    return 50000 + 2000000 * 0.08 + (priceJPY - 3000000) * 0.05;
  }
  return 50000 + 2000000 * 0.08 + 2000000 * 0.05 + (priceJPY - 5000000) * 0.03;
}

export function normalizeDestinationCity(raw: string): DestinationCity | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const cleaned = trimmed.toLowerCase().replace(/\s+/g, " ");
  const withoutProvince = cleaned.replace(PROVINCE_SUFFIX_PATTERN, "").trim();
  const cleanedSlug = cleaned.replace(/\s+/g, "-");
  const withoutProvinceSlug = withoutProvince.replace(/\s+/g, "-");

  return (
    DESTINATION_CITY_ALIASES[cleaned] ??
    DESTINATION_CITY_ALIASES[cleanedSlug] ??
    DESTINATION_CITY_ALIASES[withoutProvince] ??
    DESTINATION_CITY_ALIASES[withoutProvinceSlug] ??
    null
  );
}

export function calculateImportCost(input: CalculatorInput): FeeBreakdown {
  const transportData = TRANSPORT_COSTS[input.vehicleType][input.destinationCity];
  const dutyRate = DUTY_RATES[input.dutyType];
  const pstRate = PST_RATES[transportData.province];

  const vehicleValueCAD = input.vehiclePriceJPY * input.exchangeRate;
  const shippingInsuranceCAD = FEES.shippingInsuranceJPY * input.exchangeRate;
  const exportAgentFeeJPY = getExportAgentFeeJPY(input.vehiclePriceJPY);
  const exportAgentFeeCAD = exportAgentFeeJPY * input.exchangeRate;
  const jdmRushFeeCAD = getJdmRushFee(vehicleValueCAD);

  const valueForDutyCAD = vehicleValueCAD + shippingInsuranceCAD;
  const dutyCAD = valueForDutyCAD * dutyRate;
  const valueForGSTCAD = vehicleValueCAD + dutyCAD + FEES.exciseTaxCAD;
  const gstCAD = valueForGSTCAD * FEES.gstRate;
  const pstCAD = vehicleValueCAD * pstRate;

  const totalDeliveredCAD =
    vehicleValueCAD +
    shippingInsuranceCAD +
    dutyCAD +
    FEES.exciseTaxCAD +
    gstCAD +
    FEES.wwsTerminalFeeCAD +
    FEES.brokerageFeeCAD +
    jdmRushFeeCAD +
    exportAgentFeeCAD +
    FEES.networkFeeCAD +
    FEES.financeAdminFeeCAD +
    transportData.cost;

  return {
    input,
    destinationLabel: transportData.label,
    province: transportData.province,
    vehicleValueCAD: round2(vehicleValueCAD),
    dealerPriceCAD: round2(vehicleValueCAD),
    shippingInsuranceJPY: FEES.shippingInsuranceJPY,
    shippingInsuranceCAD: round2(shippingInsuranceCAD),
    exportAgentFeeJPY: round2(exportAgentFeeJPY),
    exportAgentFeeCAD: round2(exportAgentFeeCAD),
    jdmRushFeeCAD: round2(jdmRushFeeCAD),
    dutyRate: round2(dutyRate),
    dutyCAD: round2(dutyCAD),
    exciseTaxCAD: FEES.exciseTaxCAD,
    gstRate: FEES.gstRate,
    gstCAD: round2(gstCAD),
    wwsTerminalFeeCAD: FEES.wwsTerminalFeeCAD,
    brokerageFeeCAD: FEES.brokerageFeeCAD,
    networkFeeCAD: FEES.networkFeeCAD,
    financeAdminFeeCAD: FEES.financeAdminFeeCAD,
    transportCostCAD: round2(transportData.cost),
    valueForDutyCAD: round2(valueForDutyCAD),
    valueForGSTCAD: round2(valueForGSTCAD),
    pstRate: round2(pstRate),
    pstCAD: round2(pstCAD),
    totalDeliveredCAD: round2(totalDeliveredCAD),
  };
}
