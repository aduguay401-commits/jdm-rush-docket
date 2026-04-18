import { createServerAuthClient } from "@/lib/supabase/server-auth";

type ProfileRoleRow = {
  role: string | null;
};

export async function getCurrentUserRole() {
  const supabase = await createServerAuthClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) {
    return { user: null, role: null } as const;
  }

  const byId = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<ProfileRoleRow>();

  if (byId.error) {
    return { user, role: null } as const;
  }

  return { user, role: byId.data?.role ?? null } as const;
}

export async function requireAdmin() {
  const auth = await getCurrentUserRole();
  return auth.user && auth.role === "admin";
}
