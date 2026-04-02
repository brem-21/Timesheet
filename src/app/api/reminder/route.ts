import { NextResponse } from "next/server";
import { getCurrentUser, fetchTicketsByRange } from "@/lib/jira";
import { loadTasks } from "@/lib/taskStoreServer";
import { format } from "date-fns";

async function runReminder() {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl || webhookUrl.includes("placeholder")) {
    return NextResponse.json({ error: "SLACK_WEBHOOK_URL not configured" }, { status: 500 });
  }

  try {
    const user = await getCurrentUser();
    const today = format(new Date(), "yyyy-MM-dd");
    const startOfMonth = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd");

    // ── Jira summary ─────────────────────────────────────────────────────────
    const tickets = await fetchTicketsByRange(user.accountId, startOfMonth, today);

    const done       = tickets.filter((t) => t.status.toLowerCase() === "done");
    const inProgress = tickets.filter((t) => t.status.toLowerCase().includes("progress"));
    const inReview   = tickets.filter((t) => t.status.toLowerCase().includes("review"));
    const todo       = tickets.filter((t) => ["to do", "todo", "open"].includes(t.status.toLowerCase()));

    const doneHours       = done.reduce((s, t) => s + t.hours, 0);
    const inProgressHours = inProgress.reduce((s, t) => s + t.hours, 0);
    const inReviewHours   = inReview.reduce((s, t) => s + t.hours, 0);
    const totalHours      = tickets.reduce((s, t) => s + t.hours, 0);

    // ── Meeting tasks summary ────────────────────────────────────────────────
    const allTasks     = loadTasks();
    const openTasks    = allTasks.filter((t) => t.status === "todo");
    const activeTasks  = allTasks.filter((t) => t.status === "in-progress");
    const doneTasks    = allTasks.filter((t) => t.status === "done");
    const highPriority = openTasks.filter((t) => t.priority === "high");

    const taskBullet = (items: typeof allTasks, max = 5) =>
      items.length === 0
        ? "• None"
        : items
            .slice(0, max)
            .map((t) => `• ${t.text}${items.length > max && items.indexOf(t) === max - 1 ? ` _(+${items.length - max} more)_` : ""}`)
            .join("\n");

    const dayName = format(new Date(), "EEEE");
    const dateStr = format(new Date(), "MMMM d, yyyy");

    const ticketLine = (t: { key: string; summary: string; hours: number }) =>
      `• *${t.key}* — ${t.summary} _(${t.hours}h)_`;

    const sections = [
      `🔔 *Daily Check-in — ${user.displayName} — ${dayName}, ${dateStr}*`,
      "",
      `━━━━━━━━━━━━━━━━━━━━`,
      `📊 *Jira Ticket Summary (this month)*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `✅ *Done — ${done.length} ticket${done.length !== 1 ? "s" : ""} · ${doneHours}h logged*`,
      ...done.map(ticketLine),
      "",
      `🔄 *In Progress — ${inProgress.length} ticket${inProgress.length !== 1 ? "s" : ""} · ${inProgressHours}h*`,
      ...(inProgress.length > 0 ? inProgress.map(ticketLine) : ["• None"]),
      "",
      `👀 *In Review — ${inReview.length} ticket${inReview.length !== 1 ? "s" : ""} · ${inReviewHours}h*`,
      ...(inReview.length > 0 ? inReview.map(ticketLine) : ["• None"]),
      "",
      `📋  To Do: *${todo.length} ticket${todo.length !== 1 ? "s" : ""}*`,
      `⏱  Total hours this month: *${totalHours}h*`,
    ];

    if (allTasks.length > 0) {
      sections.push(
        "",
        `━━━━━━━━━━━━━━━━━━━━`,
        `📝 *Meeting Task Summary*`,
        `━━━━━━━━━━━━━━━━━━━━`,
        `📋  Open: *${openTasks.length}*   🔄  Active: *${activeTasks.length}*   ✅  Done: *${doneTasks.length}*`
      );

      if (doneTasks.length > 0) {
        sections.push("", `*✅ Done Tasks:*`, taskBullet(doneTasks));
      }

      if (activeTasks.length > 0) {
        sections.push("", `*🔄 Active Tasks:*`, taskBullet(activeTasks));
      }

      if (highPriority.length > 0) {
        sections.push("", `*🔴 High Priority Open:*`, taskBullet(highPriority));
      } else if (openTasks.length > 0) {
        sections.push("", `*📋 Open Tasks:*`, taskBullet(openTasks));
      }
    }

    sections.push("", `_Reminder at 4:00 PM — Clock-It_`);

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: sections.join("\n"), unfurl_links: false }),
    });

    if (!res.ok) throw new Error(`Slack error: ${res.status}`);

    return NextResponse.json({
      ok: true,
      jiraTickets: tickets.length,
      meetingTasks: allTasks.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[/api/reminder]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return runReminder();
}

export async function POST() {
  return runReminder();
}
