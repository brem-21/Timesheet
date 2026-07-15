export async function register() {
  // Only run in the Node.js runtime — node-cron and kafkajs are Node.js only.
  // Webpack eliminates this block as dead code when compiling for Edge.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const cron = (await import("node-cron")).default;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    // ── 8:00 AM weekday morning daily update ────────────────────────────────
    cron.schedule(
      "0 8 * * 1-5",
      async () => {
        console.log("[ProfDev] Sending 8:00 AM morning daily update to Slack...");
        try {
          const res = await fetch(`${appUrl}/api/morning-update/send`, { method: "POST" });
          const data = await res.json();
          if (data.ok) {
            console.log(`[ProfDev] Morning update sent for ${data.dateKey}.`);
          } else {
            console.error("[ProfDev] Morning update failed:", data.error);
          }
        } catch (err) {
          console.error("[ProfDev] Morning update error:", err);
        }
      },
      { timezone: "Africa/Accra" }
    );

    console.log("[ProfDev] ✅ 8:00 AM weekday morning update scheduled (Africa/Accra)");

    // ── 12:00 PM weekday midday Slack reminder ───────────────────────────────
    cron.schedule(
      "0 12 * * 1-5",
      async () => {
        console.log("[ProfDev] Sending 12:00 PM midday check-in to Slack...");
        try {
          const res = await fetch(`${appUrl}/api/reminder/midday`, { method: "POST" });
          const data = await res.json();
          if (data.ok) {
            console.log(`[ProfDev] Midday reminder sent — ${data.inProgress} in-progress, ${data.todo} to-do, ${data.done} done.`);
          } else {
            console.error("[ProfDev] Midday reminder failed:", data.error);
          }
        } catch (err) {
          console.error("[ProfDev] Midday reminder error:", err);
        }
      },
      { timezone: "Africa/Accra" }
    );

    console.log("[ProfDev] ✅ 12:00 PM weekday midday Slack reminder scheduled (Africa/Accra)");

    // ── 3:00 PM weekday Slack reminder ──────────────────────────────────────
    cron.schedule(
      "0 15 * * 1-5",
      async () => {
        console.log("[ProfDev] Sending 3:00 PM daily check-in to Slack...");
        try {
          const res = await fetch(`${appUrl}/api/reminder`, { method: "POST" });
          const data = await res.json();
          if (data.ok) {
            console.log(`[ProfDev] Reminder sent — ${data.jiraTickets} Jira tickets, ${data.meetingTasks} meeting tasks.`);
          } else {
            console.error("[ProfDev] Reminder failed:", data.error);
          }
        } catch (err) {
          console.error("[ProfDev] Reminder error:", err);
        }
      },
      { timezone: "Africa/Accra" }
    );

    console.log("[ProfDev] ✅ 3:00 PM weekday Slack reminder scheduled (Africa/Accra)");

    // ── Kafka event consumer ─────────────────────────────────────────────────
    try {
      const { startEventConsumer } = await import("./lib/eventConsumer");
      await startEventConsumer();
    } catch (err) {
      console.error("[ProfDev] Kafka consumer failed to start (Kafka may not be running):", err);
    }
  }
}
