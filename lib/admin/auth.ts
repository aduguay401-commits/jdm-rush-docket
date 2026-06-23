import { type User } from "@supabase/supabase-js";

import { createServerAuthClient } from "@/lib/supabase/server-auth";

export type ProfileRole = "admin" | "agent" | "customer";

type ProfileRoleRow = {
  role: string | null;
};

type CurrentUserRole =
  | { user: User; role: ProfileRole | null }
  | { user: null; role: null };

function isProfileRole(role: string | null | undefined): role is ProfileRole {
  return role === "admin" || role === "agent" || role === "customer";
}

export async function getCurrentUserRole(): Promise<CurrentUserRole> {
  const supabase = await createServerAuthClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) {
    return { user: null, role: null };
  }

  const byId = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<ProfileRoleRow>();

  if (byId.error) {
    return { user, role: null };
  }

  if (isProfileRole(byId.data?.role)) {
    return { user, role: byId.data.role };
  }

  const byUserId = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle<ProfileRoleRow>();

  if (byUserId.error) {
    return { user, role: null };
  }

  const role = isProfileRole(byUserId.data?.role) ? byUserId.data.role : null;

  return { user, role };
}

export async function requireAdmin() {
  const auth = await getCurrentUserRole();
  return auth.user && auth.role === "admin";
}

export async function requireAdminOrAgent() {
  const auth = await getCurrentUserRole();
  return auth.user && (auth.role === "admin" || auth.role === "agent");
}

export async function requireCustomer() {
  const auth = await getCurrentUserRole();
  return auth.user && auth.role === "customer";
}
