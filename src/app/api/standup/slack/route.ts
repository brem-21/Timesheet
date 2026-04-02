import { NextRequest, NextResponse } from "next/server";
import { sendStandupToSlack } from "@/lib/slack";
import { StandupSummary } from "@/lib/utils";

export async function POST(request: NextRequest) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl || webhookUrl.includes("placeholder")) {
    return NextResponse.json({ error: "SLACK_WEBHOOK_URL is not configured." }, { status: 500 });
  }

  try {
    const body = await request.json();

    // Support raw text payload (from meeting summary page)
    if (body.text) {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: body.text, unfurl_links: false }),
      });
      if (!res.ok) throw new Error(`Slack error: ${res.status}`);
      return NextResponse.json({ success: true });
    }

    // Support structured standup summary (from dashboard)
    const summary: StandupSummary = body.summary;
    if (!summary?.userName) {
      return NextResponse.json({ error: "Missing summary or text" }, { status: 400 });
    }

    await sendStandupToSlack(summary);
    return NextResponse.json({ success: true, message: "Standup sent to Slack." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[/api/standup/slack]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
