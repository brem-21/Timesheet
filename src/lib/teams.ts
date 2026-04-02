import { StandupSummary, Ticket } from "./utils";

function ticketFacts(tickets: Ticket[]) {
  if (tickets.length === 0) return [{ title: "", value: "None" }];
  return tickets.map((t) => ({
    title: t.key,
    value: `[${t.summary}](${t.url}) — ${t.status}`,
  }));
}

export async function sendStandupToTeams(summary: StandupSummary): Promise<void> {
  const webhookUrl = process.env.TEAMS_WEBHOOK_URL;
  if (!webhookUrl || webhookUrl.includes("placeholder") || webhookUrl.includes("YOUR")) {
    throw new Error("TEAMS_WEBHOOK_URL is not configured.");
  }

  // Teams Adaptive Card payload
  const payload = {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            {
              type: "TextBlock",
              size: "Large",
              weight: "Bolder",
              text: `Daily Standup — ${summary.userName}`,
              wrap: true,
              color: "Accent",
            },
            {
              type: "TextBlock",
              size: "Small",
              isSubtle: true,
              text: summary.date,
              spacing: "None",
            },
            {
              type: "Container",
              style: "emphasis",
              items: [
                {
                  type: "TextBlock",
                  weight: "Bolder",
                  text: "✅ Done Yesterday",
                  wrap: true,
                },
                {
                  type: "FactSet",
                  facts: ticketFacts(summary.doneYesterday),
                },
              ],
              spacing: "Medium",
            },
            {
              type: "Container",
              style: "accent",
              items: [
                {
                  type: "TextBlock",
                  weight: "Bolder",
                  text: "🔄 In Progress Today",
                  wrap: true,
                },
                {
                  type: "FactSet",
                  facts: ticketFacts(summary.inProgress),
                },
              ],
              spacing: "Medium",
            },
            {
              type: "Container",
              style: "attention",
              items: [
                {
                  type: "TextBlock",
                  weight: "Bolder",
                  text: "🚧 Blockers",
                  wrap: true,
                },
                {
                  type: "FactSet",
                  facts:
                    summary.blockers.length === 0
                      ? [{ title: "", value: "None" }]
                      : summary.blockers.map((t) => ({
                          title: t.key,
                          value: `[${t.summary}](${t.url}) — Priority: ${t.priority}`,
                        })),
                },
              ],
              spacing: "Medium",
            },
          ],
          actions: [
            {
              type: "Action.OpenUrl",
              title: "Open Jira Board",
              url: `${process.env.JIRA_BASE_URL ?? "https://jira.atlassian.net"}`,
            },
          ],
        },
      },
    ],
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Teams webhook error ${res.status}: ${body}`);
  }
}
