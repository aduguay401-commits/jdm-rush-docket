function normalizeKeyPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeModelText(value: string): string {
  return value.trim().toLowerCase();
}

type FamilyRule = {
  familyKey: string;
  make: string;
  patterns: RegExp[];
  minYear: number;
  maxYear: number;
};

const FAMILY_RULES: FamilyRule[] = [
  {
    familyKey: "nissan-skyline-r32-r34",
    make: "nissan",
    patterns: [/\bskyline\b/, /\bgt[-\s]?r\b/, /\bgtr\b/],
    minYear: 1989,
    maxYear: 2002,
  },
  {
    familyKey: "nissan-silvia-s13-s15",
    make: "nissan",
    patterns: [/\bsilvia\b/, /\b180sx\b/, /\b200sx\b/, /\b240sx\b/, /\bs13\b/, /\bs14\b/, /\bs15\b/],
    minYear: 1988,
    maxYear: 2002,
  },
  {
    familyKey: "mazda-rx-7-fc-fd",
    make: "mazda",
    patterns: [/\brx[-\s]?7\b/, /\bfc3s\b/, /\bfd3s\b/, /\bsavanna\b/],
    minYear: 1985,
    maxYear: 2002,
  },
  {
    familyKey: "toyota-supra-a80-a90",
    make: "toyota",
    patterns: [/\bsupra\b/, /\ba80\b/, /\ba90\b/, /\bmk4\b/, /\bmk5\b/],
    minYear: 1993,
    maxYear: 2025,
  },
];

export function buildExactModelKey(
  make: string | null,
  model: string | null,
): string | null {
  const parts = [make, model]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map(normalizeKeyPart)
    .filter(Boolean);

  return parts.length > 0 ? parts.join(":") : null;
}

export function getModelFamilyKey(
  make: string | null,
  model: string | null,
  year: number | null,
): string | null {
  const exactKey = buildExactModelKey(make, model);
  if (!make || !model || year == null || !Number.isFinite(year)) {
    return exactKey;
  }

  const normalizedMake = normalizeKeyPart(make);
  const normalizedModel = normalizeModelText(model);

  for (const rule of FAMILY_RULES) {
    if (
      normalizedMake === rule.make &&
      year >= rule.minYear &&
      year <= rule.maxYear &&
      rule.patterns.some((pattern) => pattern.test(normalizedModel))
    ) {
      return rule.familyKey;
    }
  }

  return exactKey;
}
