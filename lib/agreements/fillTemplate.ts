export type AgreementTemplateDocket = {
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  vehicle_year: string | number | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
};

export type AgreementFillValues = {
  customer_address: string;
};

function valueOrPlaceholder(value: string | number | null | undefined, placeholder: string) {
  if (typeof value === "number") return String(value);
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  return placeholder;
}

export function fillAgreementTemplate(
  templateBody: string,
  docket: AgreementTemplateDocket,
  values: AgreementFillValues
) {
  const replacements: Record<string, string> = {
    customer_first_name: valueOrPlaceholder(docket.customer_first_name, "Customer"),
    customer_last_name: valueOrPlaceholder(docket.customer_last_name, ""),
    customer_email: valueOrPlaceholder(docket.customer_email, "Not provided"),
    customer_phone: valueOrPlaceholder(docket.customer_phone, "Not provided"),
    customer_address: valueOrPlaceholder(values.customer_address, "Address provided at signing"),
    vehicle_year: valueOrPlaceholder(docket.vehicle_year, ""),
    vehicle_make: valueOrPlaceholder(docket.vehicle_make, "Vehicle"),
    vehicle_model: valueOrPlaceholder(docket.vehicle_model, ""),
  };

  return templateBody.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, key: string) => replacements[key] ?? "");
}
