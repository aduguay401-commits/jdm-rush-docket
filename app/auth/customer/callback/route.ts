import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

import {
  normalizeCustomerNextPath,
  EmailAlreadyLinkedError,
  provisionCustomerAccount,
  SoftDeletedCustomerError,
  SOFT_DELETED_CUSTOMER_MESSAGE,
} from "@/lib/customer/auth";

function setRedirectTarget(response: NextResponse, request: NextRequest, path: string) {
  response.headers.set("Location", new URL(path, request.url).toString());
  return response;
}

function buildErrorPath(message: string) {
  const params = new URLSearchParams({ auth: "error", message });
  return `/account?${params.toString()}`;
}

function buildLoginErrorPath(message: string) {
  const params = new URLSearchParams({ auth: "error", message });
  return `/account/login?${params.toString()}`;
}

function createResponseBoundAuthClient(request: NextRequest, response: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options as CookieOptions);
          });

          Object.entries(headers).forEach(([key, value]) => {
            response.headers.set(key, value);
          });
        },
      },
    }
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const nextPath = normalizeCustomerNextPath(searchParams.get("next"));
  const code = searchParams.get("code");
  const response = NextResponse.redirect(new URL(nextPath, request.url));
  const supabase = createResponseBoundAuthClient(request, response);

  if (!code) {
    return setRedirectTarget(response, request, buildErrorPath("Login link is missing a verification code."));
  }

  const { data: codeExchangeData, error: codeExchangeError } = await supabase.auth.exchangeCodeForSession(code);
  const redirectType = (codeExchangeData as typeof codeExchangeData & { redirectType?: string }).redirectType;

  if (codeExchangeError) {
    console.error("[Customer Auth] Code exchange failed", codeExchangeError.message);
    return setRedirectTarget(response, request, buildErrorPath("Unable to confirm your login link."));
  }

  const { data, error: userError } = await supabase.auth.getUser();

  if (userError || !data.user) {
    console.error("[Customer Auth] Confirmed session missing user", userError?.message);
    return setRedirectTarget(response, request, buildErrorPath("Unable to load your account."));
  }

  try {
    await provisionCustomerAccount(data.user);
  } catch (provisionError) {
    console.error("[Customer Auth] Customer provisioning failed", provisionError);
    await supabase.auth.signOut();

    if (provisionError instanceof SoftDeletedCustomerError) {
      return setRedirectTarget(response, request, buildLoginErrorPath(SOFT_DELETED_CUSTOMER_MESSAGE));
    }

    if (provisionError instanceof EmailAlreadyLinkedError) {
      return setRedirectTarget(
        response,
        request,
        buildLoginErrorPath("This email is already linked to another account. Please sign in with that account or contact JDM Rush.")
      );
    }

    return setRedirectTarget(response, request, buildErrorPath("Unable to prepare your customer account."));
  }

  if (redirectType === "recovery") {
    return setRedirectTarget(response, request, "/account/reset-password");
  }

  return response;
}
