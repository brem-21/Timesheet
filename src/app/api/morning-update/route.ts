export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
import { randomUUID } from "crypto";
import { getDailyUpdate, upsertDailyUpdate, markDailyUpdateSent, listRecentDailyUpdates } from "@/lib/dailyUpdateStore";
import { sendDailyUpdateToSlack } from "@/lib/slack";

function todayKey() {
  return format(new Date(), "yyyy-MM-dd");
}

function generateId() {
  return `du-${randomUUID()}`;
}

// GET  — fetch today's draft (or most recent updates)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateKey = searchParams.get("date") ?? todayKey();

    if (dateKey === "recent") {
      const updates = await listRecentDailyUpdates(7);
      return NextResponse.json({ updates });
    }

    const update = await getDailyUpdate(dateKey);
    return NextResponse.json({ update });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST — save draft and optionally send to Slack
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { project, done, today, blockers, send = false } = body;
    const dateKey: string = body.dateKey ?? todayKey();

    const existing = await getDailyUpdate(dateKey);

    const update = await upsertDailyUpdate({
      id: existing?.id ?? generateId(),
      dateKey,
      project: project ?? "",
      done: Array.isArray(done) ? done : [],
      today: Array.isArray(today) ? today : [],
      blockers: Array.isArray(blockers) ? blockers : [],
    });

    if (send) {
      await sendDailyUpdateToSlack(update);
      await markDailyUpdateSent(dateKey);
      update.sentAt = Date.now();
    }

    return NextResponse.json({ update, sent: send });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[/api/morning-update]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

