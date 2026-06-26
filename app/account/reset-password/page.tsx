import { AuthPageShell } from "@/app/account/_components/AuthPageShell";
import { ResetPasswordClient } from "./ResetPasswordClient";

export default function ResetPasswordPage() {
  return (
    <AuthPageShell subtitle="Set a new password">
      <ResetPasswordClient />
    </AuthPageShell>
  );
}
