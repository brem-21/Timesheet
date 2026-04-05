export async function register() {
  // Only run in the Node.js runtime — node-cron and kafkajs are Node.js only.
  // Webpack eliminates this block as dead code when compiling for Edge.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const cron = (await import("node-cron")).default;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    // ── 12:00 PM weekday midday Slack reminder ───────────────────────────────
    cron.schedule(
      "0 12 * * 1-5",
      async () => {
        console.log("[Clock-It] Sending 12:00 PM midday check-in to Slack...");
        try {
          const res = await fetch(`${appUrl}/api/reminder/midday`, { method: "POST" });
          const data = await res.json();
          if (data.ok) {
            console.log(`[Clock-It] Midday reminder sent — ${data.inProgress} in-progress, ${data.todo} to-do, ${data.done} done.`);
          } else {
            console.error("[Clock-It] Midday reminder failed:", data.error);
          }
        } catch (err) {
          console.error("[Clock-It] Midday reminder error:", err);
        }
      },
      { timezone: "Africa/Accra" }
    );

    console.log("[Clock-It] ✅ 12:00 PM weekday midday Slack reminder scheduled (Africa/Accra)");

    // ── 3:00 PM weekday Slack reminder ──────────────────────────────────────
    cron.schedule(
      "0 15 * * 1-5",
      async () => {
        console.log("[Clock-It] Sending 3:00 PM daily check-in to Slack...");
        try {
          const res = await fetch(`${appUrl}/api/reminder`, { method: "POST" });
          const data = await res.json();
          if (data.ok) {
            console.log(`[Clock-It] Reminder sent — ${data.jiraTickets} Jira tickets, ${data.meetingTasks} meeting tasks.`);
          } else {
            console.error("[Clock-It] Reminder failed:", data.error);
          }
        } catch (err) {
          console.error("[Clock-It] Reminder error:", err);
        }
      },
      { timezone: "Africa/Accra" }
    );

    console.log("[Clock-It] ✅ 3:00 PM weekday Slack reminder scheduled (Africa/Accra)");

    // ── Kafka event consumer ─────────────────────────────────────────────────
    try {
      const { startEventConsumer } = await import("./lib/eventConsumer");
      await startEventConsumer();
    } catch (err) {
      console.error("[Clock-It] Kafka consumer failed to start (Kafka may not be running):", err);
    }
  }
}
