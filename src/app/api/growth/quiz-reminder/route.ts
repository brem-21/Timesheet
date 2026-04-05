export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { format } from "date-fns";
import { loadTopics, getQuiz } from "@/lib/growthStore";

// Lightweight pre-generation for the reminder — delegates real generation to the quiz API
async function pregenerateQuiz(topicId: string, topicLabel: string, dateKey: string): Promise<void> {
  // Trigger the quiz route to generate and cache — reuses the full lesson+question pipeline
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  await fetch(`${baseUrl}/api/growth/quiz?topicId=${topicId}&date=${dateKey}`).catch(() => null);
  void topicLabel; // used for typing only
}

export async function GET() {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl || webhookUrl.includes("placeholder")) {
    return NextResponse.json({ error: "SLACK_WEBHOOK_URL not configured" }, { status: 500 });
  }

  const today = new Date();
  const dateKey = format(today, "yyyy-MM-dd");
  const dayName = format(today, "EEEE");
  const dateStr = format(today, "MMMM d, yyyy");

  const topics = await loadTopics();

  // Pre-generate quizzes for all topics that don't have one yet today
  if (process.env.GEMINI_API_KEY) {
    for (const topic of topics) {
      const existing = await getQuiz(topic.id, dateKey);
      if (!existing) {
        try {
          await pregenerateQuiz(topic.id, topic.label, dateKey);
        } catch {
          // Non-fatal — quiz can be generated on demand from the UI
        }
      }
    }
  }

  const topicList = topics.map((t) => `• ${t.label}`).join("\n");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const slackText = [
    `🧠 *Daily Learning Quiz — ${dayName}, ${dateStr}*`,
    `_Time to sharpen your skills! Today's quizzes are ready across ${topics.length} topics._`,
    "",
    "━━━━━━━━━━━━━━━━━━━━",
    `📚 *Topics available today:*`,
    topicList,
    "━━━━━━━━━━━━━━━━━━━━",
    `👉 *Take your quiz:* ${appUrl}/growth`,
    "",
    "_Senior Associate difficulty · Sent by Clock-It every weekday at noon_",
  ].join("\n");

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: slackText, unfurl_links: false }),
  });

  if (!res.ok) {
    const body = await res.text();
    return NextResponse.json({ error: `Slack error ${res.status}: ${body}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: `Quiz reminder sent for ${dateStr} (${topics.length} topics)` });
}
