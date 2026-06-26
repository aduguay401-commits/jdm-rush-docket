import { AuthPageShell } from "@/app/account/_components/AuthPageShell";
import { normalizeCustomerNextPath } from "@/lib/customer/auth-shared";
import { RegisterClient } from "./RegisterClient";

export default async function AccountRegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const nextPath = normalizeCustomerNextPath(Array.isArray(params.next) ? params.next[0] : params.next);

  return (
    <AuthPageShell subtitle="Create your account">
      <RegisterClient nextPath={nextPath} />
    </AuthPageShell>
  );
}
