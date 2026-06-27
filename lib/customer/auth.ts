import "server-only";

import { type User } from "@supabase/supabase-js";

import { getCurrentUserRole } from "@/lib/admin/auth";
import { createServerClient } from "@/lib/supabase/server";
import { createServerAuthClient } from "@/lib/supabase/server-auth";

export {
  DEFAULT_CUSTOMER_NEXT_PATH,
  getCustomerAuthCallbackUrl,
  normalizeCustomerNextPath,
} from "@/lib/customer/auth-shared";

type CustomerMetadata = {
  first_name?: unknown;
  last_name?: unknown;
  full_name?: unknown;
  name?: unknown;
  phone?: unknown;
};

type ProfileRoleRow = {
  id: string;
  role: string | null;
};

type CustomerStatusRow = {
  deleted_at: string | null;
};

export const SOFT_DELETED_CUSTOMER_MESSAGE = "This customer account is disabled.";

type CustomerEmailLinkRow = {
  auth_user_id: string | null;
};

type CustomerAccountRow = {
  id: string;
};

type ClaimableDocketRow = {
  id: string;
  customer_email: string | null;
};

export class SoftDeletedCustomerError extends Error {
  constructor() {
    super(SOFT_DELETED_CUSTOMER_MESSAGE);
    this.name = "SoftDeletedCustomerError";
  }
}

export class EmailAlreadyLinkedError extends Error {
  constructor() {
    super("Customer email is already linked to another auth user");
    this.name = "EmailAlreadyLinkedError";
  }
}

function metadataString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function splitDisplayName(value: string | null) {
  if (!value) {
    return { firstName: null, lastName: null };
  }

  const parts = value.split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return { firstName: null, lastName: null };
  }

  return {
    firstName: parts[0] ?? null,
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : null,
  };
}

function getCustomerNames(metadata: CustomerMetadata) {
  const explicitFirstName = metadataString(metadata.first_name);
  const explicitLastName = metadataString(metadata.last_name);

  if (explicitFirstName || explicitLastName) {
    return { firstName: explicitFirstName, lastName: explicitLastName };
  }

  return splitDisplayName(metadataString(metadata.full_name) ?? metadataString(metadata.name));
}

async function getExistingProfile(userId: string) {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle<ProfileRoleRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

async function getCustomerStatusForUser(userId: string) {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("customers")
    .select("deleted_at")
    .eq("auth_user_id", userId)
    .maybeSingle<CustomerStatusRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

async function assertCustomerIsActive(userId: string) {
  const customer = await getCustomerStatusForUser(userId);

  if (customer?.deleted_at) {
    throw new SoftDeletedCustomerError();
  }
}

async function assertEmailIsAvailableForUser(email: string, userId: string) {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("customers")
    .select("auth_user_id")
    .eq("email", email)
    .maybeSingle<CustomerEmailLinkRow>();

  if (error) {
    throw new Error(error.message);
  }

  if (data && data.auth_user_id !== userId) {
    throw new EmailAlreadyLinkedError();
  }
}

async function claimDocketsForCustomer(customerId: string, email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return 0;
  }

  const supabase = createServerClient();
  const { data: claimableDockets, error: selectError } = await supabase
    .from("dockets")
    .select("id, customer_email")
    .is("customer_id", null)
    .returns<ClaimableDocketRow[]>();

  if (selectError) {
    throw new Error(selectError.message);
  }

  const docketIds = (claimableDockets ?? [])
    .filter((docket) => docket.customer_email?.trim().toLowerCase() === normalizedEmail)
    .map((docket) => docket.id);

  if (docketIds.length === 0) {
    return 0;
  }

  const { error: updateError } = await supabase
    .from("dockets")
    .update({ customer_id: customerId })
    .in("id", docketIds);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return docketIds.length;
}

export async function provisionCustomerAccount(user: User) {
  const email = user.email?.trim().toLowerCase();

  if (!email) {
    throw new Error("Confirmed customer auth user is missing an email address");
  }

  const now = new Date().toISOString();
  const metadata = (user.user_metadata ?? {}) as CustomerMetadata;
  const { firstName, lastName } = getCustomerNames(metadata);
  const phone = metadataString(metadata.phone);
  const supabase = createServerClient();

  await assertCustomerIsActive(user.id);
  await assertEmailIsAvailableForUser(email, user.id);

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .upsert(
      {
        auth_user_id: user.id,
        email,
        first_name: firstName,
        last_name: lastName,
        phone,
        last_login_at: now,
      },
      { onConflict: "auth_user_id" }
    )
    .select("id")
    .single<CustomerAccountRow>();

  if (customerError) {
    throw new Error(customerError.message);
  }

  await claimDocketsForCustomer(customer.id, email);

  const existingProfile = await getExistingProfile(user.id);

  if (existingProfile?.role === "admin" || existingProfile?.role === "agent") {
    return;
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      role: "customer",
    },
    { onConflict: "id" }
  );

  if (profileError) {
    throw new Error(profileError.message);
  }
}

export async function getCurrentCustomerSession() {
  const auth = await getCurrentUserRole();

  if (!auth.user || auth.role !== "customer") {
    return { user: null, role: auth.role, isCustomer: false, disabled: false } as const;
  }

  const customer = await getCustomerStatusForUser(auth.user.id);

  if (customer?.deleted_at) {
    const supabase = await createServerAuthClient();
    await supabase.auth.signOut();

    return { user: null, role: null, isCustomer: false, disabled: true } as const;
  }

  return { user: auth.user, role: auth.role, isCustomer: true, disabled: false } as const;
}
