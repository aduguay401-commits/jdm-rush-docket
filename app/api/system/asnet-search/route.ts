import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/system/asnet-search
 *
 * Webhook that triggers an ASNET vehicle search via the bot running on the
 * Tokyo VPS. Used by the admin dashboard and automated docket workflows.
 *
 * Body: { make, model, year_min, year_max, mileage_max, price_max, freeword, max_pages }
 * Headers: X-API-Key (shared secret for internal auth)
 */
export async function POST(request: NextRequest) {
  const botUrl = process.env.ASNET_BOT_URL;
  const botKey = process.env.ASNET_BOT_API_KEY;

  if (!botUrl || !botKey) {
    return NextResponse.json(
      { error: "ASNET bot not configured" },
      { status: 503 }
    );
  }

  // Internal auth — prevent public access
  const authHeader = request.headers.get("x-api-key");
  const expectedKey = process.env.INTERNAL_API_KEY;
  if (!authHeader || authHeader !== expectedKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { make, model, year_min, year_max, mileage_max, price_max, freeword, max_pages } = body;

  if (!make && !freeword) {
    return NextResponse.json(
      { error: "At least 'make' or 'freeword' is required" },
      { status: 400 }
    );
  }

  try {
    const controller = new AbortController();
    // Bot search can take 60-120s on the 1GB VPS
    const timeout = setTimeout(() => controller.abort(), 180_000);

    const searchPayload: Record<string, unknown> = {};
    if (make) searchPayload.make = make;
    if (model) searchPayload.model = model;
    if (year_min) searchPayload.year_min = year_min;
    if (year_max) searchPayload.year_max = year_max;
    if (mileage_max) searchPayload.mileage_max = mileage_max;
    if (price_max) searchPayload.price_max = price_max;
    if (freeword) searchPayload.freeword = freeword;
    if (max_pages) searchPayload.max_pages = max_pages;

    const response = await fetch(`${botUrl}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": botKey,
      },
      body: JSON.stringify(searchPayload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Bot returned ${response.status}: ${errorText}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("aborted") || message.includes("AbortError")) {
      return NextResponse.json(
        { error: "Bot search timed out after 180s" },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { error: `Bot unreachable: ${message}` },
      { status: 502 }
    );
  }
}
