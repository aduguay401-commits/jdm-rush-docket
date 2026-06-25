import { NextRequest, NextResponse } from "next/server";

import { createServerAuthClient } from "@/lib/supabase/server-auth";

export async function POST(request: NextRequest) {
  const supabase = await createServerAuthClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/account/login", request.url), { status: 303 });
}
