export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { format } from "date-fns";

async function runMiddayReminder() {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl || webhookUrl.includes("placeholder")) {
    return NextResponse.json({ error: "SLACK_WEBHOOK_URL not configured" }, { status: 500 });
  }

  try {
    const now = new Date();
    const dayName = format(now, "EEEE");
    const dateStr = format(now, "MMMM d, yyyy");
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const text = [
      `🎯 *Daily Assessment — ${dayName}, ${dateStr}*`,
      `_It's midday. Time to test your consulting edge._`,
      "",
      `━━━━━━━━━━━━━━━━━━━━`,
      `Today's assessment is a real-world business problem combining all your topics — Data Engineering, SQL, Python, ML, Cloud, Consulting, and more.`,
      "",
      `You'll be evaluated as a Senior Associate at BCG/McKinsey/Bain on:`,
      `  • *Technicality* — depth and accuracy of your technical solution`,
      `  • *Logic* — MECE structure, clear cause-effect reasoning`,
      `  • *Problem-solving* — hypothesis-driven approach, root-cause prioritisation`,
      `  • *Delivery* — executive-ready language, actionable recommendations`,
      "",
      `━━━━━━━━━━━━━━━━━━━━`,
      `👉 *Take today's assessment:* ${appUrl}/growth`,
      `_Select any topic → Daily Assessment tab_`,
      "",
      `_Midday assessment reminder — Clock-It_`,
    ].join("\n");

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, unfurl_links: false }),
    });

    if (!res.ok) throw new Error(`Slack error: ${res.status}`);

    return NextResponse.json({ ok: true, message: `Assessment reminder sent for ${dateStr}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[/api/reminder/midday]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() { return runMiddayReminder(); }
export async function POST() { return runMiddayReminder(); }
