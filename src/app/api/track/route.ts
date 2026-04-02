export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { UAParser } from "ua-parser-js";
import { publishEvent } from "@/lib/kafka";
import { startEventConsumer } from "@/lib/eventConsumer";

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

// Boot consumer once per process — fire and forget
const g = globalThis as unknown as { _consumerBooted?: boolean };
if (!g._consumerBooted) {
  g._consumerBooted = true;
  startEventConsumer().catch((err) =>
    console.error("[Clock-It] Kafka consumer boot failed:", err)
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const ua = req.headers.get("user-agent") ?? "";
    const parser = new UAParser(ua);
    const uaResult = parser.getResult();

    const os = [uaResult.os.name, uaResult.os.version].filter(Boolean).join(" ") || "Unknown";
    const browser = [uaResult.browser.name, uaResult.browser.major].filter(Boolean).join(" ") || "Unknown";
    const deviceType = uaResult.device.type ?? "desktop";

    const event = {
      eventId: body.eventId ?? `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: body.type ?? "page_view",
      sessionId: body.sessionId ?? "anon",
      path: body.path ?? null,
      component: body.component ?? null,
      action: body.action ?? null,
      referrer: body.referrer ?? null,
      metadata: body.metadata ?? {},
      os,
      browser,
      deviceType,
      ip: getClientIp(req),
      timestamp: body.timestamp ?? Date.now(),
    };

    await publishEvent(event);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/track]", err);
    return NextResponse.json({ ok: false });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
