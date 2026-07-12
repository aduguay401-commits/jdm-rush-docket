import { getCurrentUserRole, requireAdmin } from "@/lib/admin/auth";
import type { CustomerInfoUpdate, DocketActivityEventMetadata } from "@/lib/admin/types";
import { createServerClient } from "@/lib/supabase/server";

type EditableRequestField = keyof CustomerInfoUpdate;

type DocketColumn =
  | "customer_first_name"
  | "customer_last_name"
  | "customer_email"
  | "customer_phone"
  | "vehicle_year"
  | "vehicle_make"
  | "vehicle_model"
  | "vehicle_description"
  | "destination_city"
  | "destination_province"
  | "budget_bracket"
  | "timeline"
  | "additional_notes";

type CurrentDocket = Record<DocketColumn, string | null> & {
  id: string;
  status: string | null;
};

type FieldConfig = {
  column: DocketColumn;
  maxLength: number;
  required?: boolean;
  email?: boolean;
};

const FIELD_CONFIG: Record<EditableRequestField, FieldConfig> = {
  first_name: { column: "customer_first_name", maxLength: 100, required: true },
  last_name: { column: "customer_last_name", maxLength: 100, required: true },
  email: { column: "customer_email", maxLength: 320, required: true, email: true },
  phone: { column: "customer_phone", maxLength: 50 },
  vehicle_year: { column: "vehicle_year", maxLength: 20 },
  vehicle_make: { column: "vehicle_make", maxLength: 100 },
  vehicle_model: { column: "vehicle_model", maxLength: 100 },
  vehicle_description: { column: "vehicle_description", maxLength: 2000 },
  destination_city: { column: "destination_city", maxLength: 100 },
  destination_province: { column: "destination_province", maxLength: 100 },
  budget_bracket: { column: "budget_bracket", maxLength: 100 },
  timeline: { column: "timeline", maxLength: 200 },
  additional_notes: { column: "additional_notes", maxLength: 4000 },
};

const EDITABLE_FIELDS = Object.keys(FIELD_CONFIG) as EditableRequestField[];
const LOCKED_DESTINATION_STATUSES = new Set(["research_in_progress", "report_sent", "decision_made", "sold_in_delivery", "cleared"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hasOwn(object: object, key: string) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function formatFieldName(field: EditableRequestField) {
  return field.replaceAll("_", " ");
}

function normalizeRequestValue(field: EditableRequestField, value: unknown) {
  const config = FIELD_CONFIG[field];

  if (value === null) {
    if (config.required) {
      return { error: `${formatFieldName(field)} is required.` };
    }

    return { value: null };
  }

  if (typeof value !== "string") {
    return { error: `${formatFieldName(field)} must be a string.` };
  }

  const trimmed = value.trim();
  const normalized = config.email ? trimmed.toLowerCase() : trimmed;

  if (config.required && normalized.length === 0) {
    return { error: `${formatFieldName(field)} is required.` };
  }

  if (normalized.length > config.maxLength) {
    return { error: `${formatFieldName(field)} cannot exceed ${config.maxLength} characters.` };
  }

  if (config.email && !EMAIL_PATTERN.test(normalized)) {
    return { error: "Email must be a valid email address." };
  }

  return { value: normalized };
}

function valueChanged(oldValue: string | null, newValue: string | null) {
  return (oldValue ?? null) !== (newValue ?? null);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const auth = await getCurrentUserRole();

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return Response.json({ success: false, error: "Request body must be an object." }, { status: 400 });
  }

  const providedFields = EDITABLE_FIELDS.filter((field) => hasOwn(payload, field));
  if (providedFields.length === 0) {
    return Response.json({ success: false, error: "No customer info fields provided." }, { status: 400 });
  }

  for (const field of EDITABLE_FIELDS) {
    if (FIELD_CONFIG[field].required && !hasOwn(payload, field)) {
      return Response.json({ success: false, error: `${formatFieldName(field)} is required.` }, { status: 400 });
    }
  }

  const normalizedPayload: Partial<Record<EditableRequestField, string | null>> = {};
  for (const field of providedFields) {
    const normalized = normalizeRequestValue(field, (payload as Record<string, unknown>)[field]);
    if ("error" in normalized) {
      return Response.json({ success: false, error: normalized.error }, { status: 400 });
    }

    normalizedPayload[field] = normalized.value;
  }

  const { id } = await context.params;
  const supabase = createServerClient();

  const { data: current, error: currentError } = await supabase
    .from("dockets")
    .select(
      "id, status, customer_first_name, customer_last_name, customer_email, customer_phone, vehicle_year, vehicle_make, vehicle_model, vehicle_description, destination_city, destination_province, budget_bracket, timeline, additional_notes"
    )
    .eq("id", id)
    .maybeSingle<CurrentDocket>();

  if (currentError) {
    return Response.json({ success: false, error: currentError.message }, { status: 500 });
  }

  if (!current) {
    return Response.json({ success: false, error: "Docket not found" }, { status: 404 });
  }

  if (LOCKED_DESTINATION_STATUSES.has(current.status ?? "")) {
    for (const field of ["destination_city", "destination_province"] as const) {
      if (!hasOwn(normalizedPayload, field)) {
        continue;
      }

      const column = FIELD_CONFIG[field].column;
      if (valueChanged(current[column], normalizedPayload[field] ?? null)) {
        return Response.json(
          {
            success: false,
            error: "Destination city cannot be changed after research has begun. Contact support if this is needed.",
          },
          { status: 422 }
        );
      }
    }
  }

  const updates: Partial<Record<DocketColumn, string | null>> = {};
  const metadata: DocketActivityEventMetadata = { changes: {} };
  const changedFields: string[] = [];

  for (const field of providedFields) {
    const column = FIELD_CONFIG[field].column;
    const newValue = normalizedPayload[field] ?? null;

    if (!valueChanged(current[column], newValue)) {
      continue;
    }

    updates[column] = newValue;
    changedFields.push(field);
    metadata.changes[field] = {
      old: current[column],
      new: newValue,
    };
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ success: true, message: "No changes to apply", docket: current });
  }

  const { data: updatedDocket, error: updateError } = await supabase
    .from("dockets")
    .update(updates)
    .eq("id", id)
    .select(
      "id, status, customer_first_name, customer_last_name, customer_email, customer_phone, vehicle_year, vehicle_make, vehicle_model, vehicle_description, destination_city, destination_province, budget_bracket, timeline, additional_notes"
    )
    .maybeSingle<CurrentDocket>();

  if (updateError) {
    return Response.json({ success: false, error: updateError.message }, { status: 500 });
  }

  if (!updatedDocket) {
    return Response.json({ success: false, error: "Docket not found" }, { status: 404 });
  }

  const { error: activityError } = await supabase.from("docket_activity_events").insert({
    docket_id: id,
    event_type: "customer_info_edited",
    event_category: "admin_action",
    actor_type: "admin",
    actor_id: auth.user?.id ?? null,
    actor_email: auth.user?.email ?? null,
    title: "Customer info updated",
    description: `Updated: ${changedFields.join(", ")}`,
    metadata,
  });

  if (activityError) {
    return Response.json({ success: false, error: activityError.message }, { status: 500 });
  }

  return Response.json({ success: true, docket: updatedDocket });
}
