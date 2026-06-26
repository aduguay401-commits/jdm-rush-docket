import { NextRequest, NextResponse } from "next/server";

import {
  normalizeCustomerNextPath,
  EmailAlreadyLinkedError,
  provisionCustomerAccount,
  SoftDeletedCustomerError,
} from "@/lib/customer/auth";
import { createServerAuthClient } from "@/lib/supabase/server-auth";

function buildRedirect(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url));
}

function buildErrorRedirect(request: NextRequest, message: string) {
  const url = new URL("/account", request.url);
  url.searchParams.set("auth", "error");
  url.searchParams.set("message", message);
  return NextResponse.redirect(url);
}

function buildLoginErrorRedirect(request: NextRequest, message: string) {
  const url = new URL("/account/login", request.url);
  url.searchParams.set("auth", "error");
  url.searchParams.set("message", message);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const nextPath = normalizeCustomerNextPath(searchParams.get("next"));
  const code = searchParams.get("code");
  const supabase = await createServerAuthClient();

  if (!code) {
    return buildErrorRedirect(request, "Login link is missing a verification code.");
  }

  const { error: codeExchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (codeExchangeError) {
    console.error("[Customer Auth] Code exchange failed", codeExchangeError.message);
    return buildErrorRedirect(request, "Unable to confirm your login link.");
  }

  const { data, error: userError } = await supabase.auth.getUser();

  if (userError || !data.user) {
    console.error("[Customer Auth] Confirmed session missing user", userError?.message);
    return buildErrorRedirect(request, "Unable to load your account.");
  }

  try {
    await provisionCustomerAccount(data.user);
  } catch (provisionError) {
    console.error("[Customer Auth] Customer provisioning failed", provisionError);
    await supabase.auth.signOut();

    if (provisionError instanceof SoftDeletedCustomerError) {
      return buildErrorRedirect(request, "This customer account is disabled.");
    }

    if (provisionError instanceof EmailAlreadyLinkedError) {
      return buildLoginErrorRedirect(
        request,
        "This email is already linked to another account. Please sign in with that account or contact JDM Rush."
      );
    }

    return buildErrorRedirect(request, "Unable to prepare your customer account.");
  }

  return buildRedirect(request, nextPath);
}
