import { NextResponse } from "next/server";
import { logActivity, getLastActivityTime, getActivitySummary } from "@/lib/activityStore";

export async function POST(req: Request) {
  try {
    const { path, type, title } = await req.json();
    logActivity({ path: path ?? "/", title, timestamp: Date.now(), type: type ?? "page" });
  } catch {}
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const last = getLastActivityTime();
  const since = Date.now() - 24 * 60 * 60 * 1000; // last 24h
  const summary = getActivitySummary(since);
  return NextResponse.json({ lastActivity: last, summary });
}
