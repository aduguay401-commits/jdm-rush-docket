import { getCustomerAuthCallbackUrl, normalizeCustomerNextPath } from "@/lib/customer/auth";
import { createServerAuthClient } from "@/lib/supabase/server-auth";

type MagicLinkRequestBody = {
  email?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  phone?: unknown;
  next?: unknown;
};

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptionalString(value: unknown) {
  const trimmed = asTrimmedString(value);
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeEmail(value: unknown) {
  const email = asTrimmedString(value).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export async function POST(request: Request) {
  let payload: MagicLinkRequestBody;

  try {
    payload = (await request.json()) as MagicLinkRequestBody;
  } catch {
    return Response.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const email = normalizeEmail(payload.email);

  if (!email) {
    return Response.json({ success: false, error: "A valid email is required" }, { status: 400 });
  }

  const firstName = normalizeOptionalString(payload.firstName);
  const lastName = normalizeOptionalString(payload.lastName);
  const phone = normalizeOptionalString(payload.phone);
  const nextPath = normalizeCustomerNextPath(payload.next);
  const emailRedirectTo = getCustomerAuthCallbackUrl(nextPath);
  const supabase = await createServerAuthClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo,
      data: {
        role: "customer",
        ...(firstName ? { first_name: firstName } : {}),
        ...(lastName ? { last_name: lastName } : {}),
        ...(phone ? { phone } : {}),
      },
    },
  });

  if (error) {
    console.error("[Customer Auth] Failed to send magic link", { email, error: error.message });
    return Response.json({ success: false, error: "Unable to send login link" }, { status: 500 });
  }

  return Response.json({
    success: true,
    message: "If an account can be created for that email, a login link has been sent.",
  });
}
