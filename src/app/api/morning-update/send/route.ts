export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { format } from "date-fns";
import { getDailyUpdate, markDailyUpdateSent } from "@/lib/dailyUpdateStore";
import { sendDailyUpdateToSlack } from "@/lib/slack";

async function sendTodayUpdate() {
  const dateKey = format(new Date(), "yyyy-MM-dd");
  const update = await getDailyUpdate(dateKey);

  if (!update) {
    return NextResponse.json({ error: "No update drafted for today." }, { status: 404 });
  }

  await sendDailyUpdateToSlack(update);
  await markDailyUpdateSent(dateKey);

  return NextResponse.json({ ok: true, dateKey });
}

export async function GET() {
  try {
    return await sendTodayUpdate();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[/api/morning-update/send]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  try {
    return await sendTodayUpdate();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[/api/morning-update/send]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
