import { AuthPageShell } from "@/app/account/_components/AuthPageShell";
import { ForgotPasswordClient } from "./ForgotPasswordClient";

export default function ForgotPasswordPage() {
  return (
    <AuthPageShell subtitle="Forgot your password?">
      <ForgotPasswordClient />
    </AuthPageShell>
  );
}
