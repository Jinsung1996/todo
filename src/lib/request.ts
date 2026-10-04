import { NextRequest, NextResponse } from "next/server";

export async function parseJsonBody(
  request: NextRequest
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; response: NextResponse }> {
  const text = await request.text();
  if (!text) {
    return {
      ok: false,
      response: NextResponse.json({ error: "request body is required" }, { status: 400 }),
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "invalid JSON body" }, { status: 400 }),
    };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "request body must be a JSON object" }, { status: 400 }),
    };
  }

  return { ok: true, data: parsed as Record<string, unknown> };
}
