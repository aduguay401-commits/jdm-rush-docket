import { type User } from "@supabase/supabase-js";

import { getCurrentUserRole } from "@/lib/admin/auth";
import { createServerClient } from "@/lib/supabase/server";
import { getAppBaseUrl } from "@/lib/urls";

type CustomerMetadata = {
  first_name?: unknown;
  last_name?: unknown;
  full_name?: unknown;
  name?: unknown;
  phone?: unknown;
};

type ProfileRoleRow = {
  id: string;
  user_id: string | null;
  role: string | null;
};

const DEFAULT_CUSTOMER_NEXT_PATH = "/account";

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

export function normalizeCustomerNextPath(value: unknown) {
  if (typeof value !== "string") {
    return DEFAULT_CUSTOMER_NEXT_PATH;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return DEFAULT_CUSTOMER_NEXT_PATH;
  }

  try {
    const baseUrl = new URL(getAppBaseUrl());
    const resolvedUrl = new URL(trimmed, baseUrl);

    if (resolvedUrl.origin !== baseUrl.origin) {
      return DEFAULT_CUSTOMER_NEXT_PATH;
    }

    return `${resolvedUrl.pathname}${resolvedUrl.search}`;
  } catch {
    return DEFAULT_CUSTOMER_NEXT_PATH;
  }
}

export function getCustomerAuthCallbackUrl(nextPath = DEFAULT_CUSTOMER_NEXT_PATH) {
  const callbackUrl = new URL("/auth/customer/callback", getAppBaseUrl());
  callbackUrl.searchParams.set("next", normalizeCustomerNextPath(nextPath));
  return callbackUrl.toString();
}

async function getExistingProfile(userId: string) {
  const supabase = createServerClient();

  const byId = await supabase
    .from("profiles")
    .select("id, user_id, role")
    .eq("id", userId)
    .maybeSingle<ProfileRoleRow>();

  if (byId.error) {
    throw new Error(byId.error.message);
  }

  if (byId.data) {
    return byId.data;
  }

  const byUserId = await supabase
    .from("profiles")
    .select("id, user_id, role")
    .eq("user_id", userId)
    .maybeSingle<ProfileRoleRow>();

  if (byUserId.error) {
    throw new Error(byUserId.error.message);
  }

  return byUserId.data ?? null;
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

  const { error: customerError } = await supabase.from("customers").upsert(
    {
      auth_user_id: user.id,
      email,
      first_name: firstName,
      last_name: lastName,
      phone,
      last_login_at: now,
    },
    { onConflict: "auth_user_id" }
  );

  if (customerError) {
    throw new Error(customerError.message);
  }

  const existingProfile = await getExistingProfile(user.id);

  if (existingProfile?.role === "admin" || existingProfile?.role === "agent") {
    return;
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: existingProfile?.id ?? user.id,
      user_id: user.id,
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
    return { user: null, role: auth.role, isCustomer: false } as const;
  }

  return { user: auth.user, role: auth.role, isCustomer: true } as const;
}
