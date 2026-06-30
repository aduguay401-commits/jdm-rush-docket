import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

import {
  EmailAlreadyLinkedError,
  normalizeCustomerNextPath,
  provisionCustomerAccount,
  SoftDeletedCustomerError,
  SOFT_DELETED_CUSTOMER_MESSAGE,
} from "@/lib/customer/auth";

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

function getRequestOrigin(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
  const protocol = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "") ?? "https";

  return `${protocol}://${host}`;
}

function getRedirectUrl(request: NextRequest, path: string) {
  return new URL(path, getRequestOrigin(request));
}

function setRedirectTarget(response: NextResponse, request: NextRequest, path: string) {
  response.headers.set("Location", getRedirectUrl(request, path).toString());
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

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = getFormString(formData.get("email")).toLowerCase();
  const password = getFormString(formData.get("password"), { trim: false });
  const nextPath = normalizeCustomerNextPath(getFormString(formData.get("next")));
  const response = NextResponse.redirect(getRedirectUrl(request, nextPath), { status: 303 });
  const supabase = createResponseBoundAuthClient(request, response);

  if (!email || !password) {
    return setRedirectTarget(response, request, buildLoginPath(INVALID_LOGIN_MESSAGE, nextPath));
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    return setRedirectTarget(response, request, buildLoginPath(INVALID_LOGIN_MESSAGE, nextPath));
  }

  const { data, error: userError } = await supabase.auth.getUser();

  if (userError || !data.user) {
    console.error("[Customer Auth] Password login session missing user", userError?.message);
    await supabase.auth.signOut();
    return setRedirectTarget(response, request, buildLoginPath("Unable to load your account.", nextPath));
  }

  try {
    await provisionCustomerAccount(data.user);
  } catch (provisionError) {
    console.error("[Customer Auth] Password login customer provisioning failed", provisionError);
    await supabase.auth.signOut();

    if (provisionError instanceof SoftDeletedCustomerError) {
      return setRedirectTarget(response, request, buildLoginPath(SOFT_DELETED_CUSTOMER_MESSAGE, nextPath));
    }

    if (provisionError instanceof EmailAlreadyLinkedError) {
      return setRedirectTarget(
        response,
        request,
        buildLoginPath("This email is already linked to another account. Please sign in with that account or contact JDM Rush.", nextPath)
      );
    }

    return setRedirectTarget(response, request, buildLoginPath("Unable to prepare your customer account.", nextPath));
  }

  return response;
}
