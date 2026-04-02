import { StandupSummary } from "./utils";

export async function sendStandupToSlack(summary: StandupSummary): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl || webhookUrl.includes("placeholder") || webhookUrl.includes("YOUR")) {
    throw new Error("SLACK_WEBHOOK_URL is not configured.");
  }

  const ticketList = (tickets: StandupSummary["inProgress"]) =>
    tickets.length === 0
      ? "None"
      : tickets.map((t) => `• <${t.url}|${t.key}> ${t.summary}`).join("\n");

  const blockerList =
    summary.blockers.length === 0
      ? "None"
      : summary.blockers.map((t) => `• <${t.url}|${t.key}> ${t.summary} _(${t.priority})_`).join("\n");

  const text = [
    `*Daily Standup — ${summary.userName} — ${summary.date}*`,
    "",
    `✅ *Done yesterday:*\n${ticketList(summary.doneYesterday)}`,
    "",
    `🔄 *In progress today:*\n${ticketList(summary.inProgress)}`,
    "",
    `🚧 *Blockers:*\n${blockerList}`,
  ].join("\n");

  const payload = {
    text,
    unfurl_links: false,
    unfurl_media: false,
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Slack webhook error ${res.status}: ${body}`);
  }
}
