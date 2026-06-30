import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

import {
  EmailAlreadyLinkedError,
  normalizeCustomerNextPath,
  provisionCustomerAccount,
  SoftDeletedCustomerError,
  SOFT_DELETED_CUSTOMER_MESSAGE,
} from "@/lib/customer/auth";
import { getAppBaseUrl } from "@/lib/urls";

const INVALID_LOGIN_MESSAGE = "Invalid email or password.";

function getFormString(value: FormDataEntryValue | null, { trim = true } = {}) {
  if (typeof value !== "string") {
    return "";
  }

  return trim ? value.trim() : value;
}

function buildLoginPath(message: string, nextPath: string) {
  const params = new URLSearchParams({ auth: "error", message });

  if (nextPath !== "/account") {
    params.set("next", nextPath);
  }

  return `/account/login?${params.toString()}`;
}

function getTrustedAppOrigin() {
  return new URL(getAppBaseUrl()).origin;
}

function requestOriginMatchesTrustedApp(request: NextRequest) {
  const trustedOrigin = getTrustedAppOrigin();
  const origin = request.headers.get("origin");

  if (origin) {
    return origin === trustedOrigin;
  }

  const referer = request.headers.get("referer");
  if (!referer) {
    return false;
  }

  try {
    return new URL(referer).origin === trustedOrigin;
  } catch {
    return false;
  }
}

function getRedirectUrl(path: string) {
  return new URL(path, getAppBaseUrl());
}

function setRedirectTarget(response: NextResponse, path: string) {
  response.headers.set("Location", getRedirectUrl(path).toString());
  return response;
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
            const cookieOptions = options as CookieOptions;

            request.cookies.set(name, value);
            response.cookies.set(name, value, {
              ...cookieOptions,
              // Supabase browser auth flows need JS-readable auth cookies; keep the supabase-ssr HttpOnly default.
              secure: process.env.NODE_ENV === "production" ? true : cookieOptions.secure,
            });
          });

          Object.entries(headers).forEach(([key, value]) => {
            response.headers.set(key, value);
          });
        },
      },
    }
  );
}

export async function POST(request: NextRequest) {
  if (!requestOriginMatchesTrustedApp(request)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const formData = await request.formData();
  const email = getFormString(formData.get("email")).toLowerCase();
  const password = getFormString(formData.get("password"), { trim: false });
  const nextPath = normalizeCustomerNextPath(getFormString(formData.get("next")));
  const response = NextResponse.redirect(getRedirectUrl(nextPath), { status: 303 });
  const supabase = createResponseBoundAuthClient(request, response);

  if (!email || !password) {
    return setRedirectTarget(response, buildLoginPath(INVALID_LOGIN_MESSAGE, nextPath));
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    return setRedirectTarget(response, buildLoginPath(INVALID_LOGIN_MESSAGE, nextPath));
  }

  const { data, error: userError } = await supabase.auth.getUser();

  if (userError || !data.user) {
    console.error("[Customer Auth] Password login session missing user", userError?.message);
    await supabase.auth.signOut();
    return setRedirectTarget(response, buildLoginPath("Unable to load your account.", nextPath));
  }

  try {
    await provisionCustomerAccount(data.user);
  } catch (provisionError) {
    console.error("[Customer Auth] Password login customer provisioning failed", provisionError);
    await supabase.auth.signOut();

    if (provisionError instanceof SoftDeletedCustomerError) {
      return setRedirectTarget(response, buildLoginPath(SOFT_DELETED_CUSTOMER_MESSAGE, nextPath));
    }

    if (provisionError instanceof EmailAlreadyLinkedError) {
      return setRedirectTarget(
        response,
        buildLoginPath("This email is already linked to another account. Please sign in with that account or contact JDM Rush.", nextPath)
      );
    }

    return setRedirectTarget(response, buildLoginPath("Unable to prepare your customer account.", nextPath));
  }

  return response;
}
