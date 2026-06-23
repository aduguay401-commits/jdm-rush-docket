import { type EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import {
  normalizeCustomerNextPath,
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

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const nextPath = normalizeCustomerNextPath(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const otpType = searchParams.get("type") as EmailOtpType | null;
  const supabase = await createServerAuthClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("[Customer Auth] Code exchange failed", error.message);
      return buildErrorRedirect(request, "Unable to confirm your login link.");
    }
  } else if (tokenHash && otpType) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType });

    if (error) {
      console.error("[Customer Auth] OTP verification failed", error.message);
      return buildErrorRedirect(request, "Unable to confirm your login link.");
    }
  } else {
    return buildErrorRedirect(request, "Login link is missing a verification code.");
  }

  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    console.error("[Customer Auth] Confirmed session missing user", error?.message);
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

    return buildErrorRedirect(request, "Unable to prepare your customer account.");
  }

  return buildRedirect(request, nextPath);
}
