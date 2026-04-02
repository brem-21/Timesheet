export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const cron = (await import("node-cron")).default;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    // 3:00 PM Monday–Friday, Africa/Accra timezone
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
  }
}
