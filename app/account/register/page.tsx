import { AuthPageShell } from "@/app/account/_components/AuthPageShell";
import { normalizeCustomerNextPath } from "@/lib/customer/auth-shared";
import { RegisterClient } from "./RegisterClient";

function getSingleParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export default async function AccountRegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const initialEmail = getSingleParam(params.email)?.trim().toLowerCase() ?? "";
  const nextPath = normalizeCustomerNextPath(getSingleParam(params.next));

  return (
    <AuthPageShell subtitle="Create your account">
      <RegisterClient initialEmail={initialEmail} nextPath={nextPath} />
    </AuthPageShell>
  );
}
