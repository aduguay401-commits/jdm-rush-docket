import { NextRequest } from "next/server";

import { getCurrentCustomerSession } from "@/lib/customer/auth";
import { createServerAuthClient } from "@/lib/supabase/server-auth";

type MessagePayload = {
  docketId?: unknown;
  message?: unknown;
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  const session = await getCurrentCustomerSession();

  if (!session.isCustomer || !session.user) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let payload: MessagePayload;

  try {
    payload = (await request.json()) as MessagePayload;
  } catch {
    return Response.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const docketId = normalizeText(payload.docketId);
  const message = normalizeText(payload.message);

  if (!docketId) {
    return Response.json({ success: false, error: "docketId is required" }, { status: 400 });
  }

  if (!message) {
    return Response.json({ success: false, error: "message is required" }, { status: 400 });
  }

  const supabase = await createServerAuthClient();
  const { data: docket, error: docketError } = await supabase
    .from("dockets")
    .select("id")
    .eq("id", docketId)
    .maybeSingle<{ id: string }>();

  if (docketError) {
    return Response.json({ success: false, error: docketError.message }, { status: 500 });
  }

  if (!docket) {
    return Response.json({ success: false, error: "Docket not found" }, { status: 404 });
  }

  const sixtySecondsAgo = new Date(Date.now() - 60_000).toISOString();
  const { data: recentDuplicate, error: duplicateError } = await supabase
    .from("customer_questions")
    .select("id")
    .eq("docket_id", docket.id)
    .eq("question_text", message)
    .gte("created_at", sixtySecondsAgo)
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (duplicateError) {
    return Response.json({ success: false, error: duplicateError.message }, { status: 500 });
  }

  if (recentDuplicate) {
    return Response.json({ success: true, duplicate: true });
  }

  const { error: insertError } = await supabase.from("customer_questions").insert({
    docket_id: docket.id,
    question_text: message,
  });

  if (insertError) {
    return Response.json({ success: false, error: insertError.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
