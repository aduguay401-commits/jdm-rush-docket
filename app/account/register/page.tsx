import { AuthPageShell } from "@/app/account/_components/AuthPageShell";
import { RegisterClient } from "./RegisterClient";

export default function AccountRegisterPage() {
  return (
    <AuthPageShell subtitle="Create your account">
      <RegisterClient />
    </AuthPageShell>
  );
}
