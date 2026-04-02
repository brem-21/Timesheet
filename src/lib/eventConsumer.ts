import { createConsumer, EVENTS_TOPIC } from "./kafka";
import { pool } from "./db";

// ── Feature catalogue ─────────────────────────────────────────────────────────

const FEATURES = [
  { feature: "/meetings",    label: "Meeting Summaries",   description: "Summarise transcripts, extract action items, and identify speakers" },
  { feature: "/performance", label: "Performance Hub",     description: "Generate AI-powered performance insights from your Jira and meeting data" },
  { feature: "/tasks",       label: "Task Board",          description: "Manage and track all meeting action items in one place" },
  { feature: "/standup",     label: "Standup Generator",   description: "Auto-generate daily standup reports and send them to Slack or Teams" },
  { feature: "/export",      label: "Export & Reports",    description: "Export your time logs and generate reports as CSV or PDF" },
  { feature: "/timelog",     label: "Time Log",            description: "Detailed breakdown of all logged time by ticket, date, and session" },
  { feature: "/overview",    label: "Dashboard Overview",  description: "High-level view of your productivity stats across all features" },
];

// ── Persist a raw event ───────────────────────────────────────────────────────

async function persistEvent(e: Record<string, unknown>): Promise<void> {
  await pool.query(
    `INSERT INTO user_events
       (id, type, session_id, path, component, action, os, browser, device_type, ip, country, region, city, referrer, timestamp, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     ON CONFLICT (id) DO NOTHING`,
    [
      e.eventId, e.type, e.sessionId,
      e.path ?? null, e.component ?? null, e.action ?? null,
      e.os ?? null, e.browser ?? null, e.deviceType ?? null,
      e.ip ?? null, e.country ?? null, e.region ?? null, e.city ?? null,
      e.referrer ?? null, e.timestamp,
      JSON.stringify(e.metadata ?? {}),
    ]
  );
}

// ── Recommendations ───────────────────────────────────────────────────────────

async function recomputeRecommendations(): Promise<void> {
  const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const { rows: vRows } = await pool.query<{ path: string; visits: string }>(
    `SELECT path, COUNT(*) AS visits FROM user_events WHERE timestamp >= $1 AND type = 'page_view' AND path IS NOT NULL GROUP BY path`, [since]
  );
  const { rows: cRows } = await pool.query<{ path: string; clicks: string }>(
    `SELECT path, COUNT(*) AS clicks FROM user_events WHERE timestamp >= $1 AND type = 'click' AND path IS NOT NULL GROUP BY path`, [since]
  );
  const vm: Record<string, number> = {};
  for (const r of vRows) vm[r.path] = Number(r.visits);
  const cm: Record<string, number> = {};
  for (const r of cRows) cm[r.path] = Number(r.clicks);
  const mv = Math.max(...Object.values(vm), 1);
  const mc = Math.max(...Object.values(cm), 1);
  for (const f of FEATURES) {
    const score = parseFloat((1 - (0.7 * ((vm[f.feature] ?? 0) / mv) + 0.3 * ((cm[f.feature] ?? 0) / mc))).toFixed(4));
    await pool.query(
      `INSERT INTO recommendations (feature, label, description, score, last_updated) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (feature) DO UPDATE SET score=$4, last_updated=$5`,
      [f.feature, f.label, f.description, score, Date.now()]
    );
  }
}

// ── Consumer using manual partition assignment (no group coordinator needed) ──

let started = false;

export async function startEventConsumer(): Promise<void> {
  if (started) return;
  started = true;

  const maxAttempts = 8;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const consumer = await createConsumer("clockit-event-processor");
      await consumer.connect();
      await consumer.subscribe({ topic: EVENTS_TOPIC, fromBeginning: false });

      let batchCount = 0;
      await consumer.run({
        eachBatchAutoResolve: true,
        eachBatch: async ({ batch, resolveOffset, heartbeat }) => {
          for (const message of batch.messages) {
            try {
              if (!message.value) continue;
              const event = JSON.parse(message.value.toString()) as Record<string, unknown>;
              await persistEvent(event);
              resolveOffset(message.offset);
              await heartbeat();
              batchCount++;
            } catch (err) {
              console.error("[EventConsumer] Failed to process message:", err);
            }
          }
          if (batchCount > 0 && batchCount % 50 === 0) {
            recomputeRecommendations().catch(() => {});
          }
        },
      });

      console.log(`[Clock-It] Kafka event consumer started → ${EVENTS_TOPIC}`);
      recomputeRecommendations().catch(() => {});
      return;
    } catch (err) {
      started = false;
      if (attempt === maxAttempts) {
        console.error("[EventConsumer] Giving up after", maxAttempts, "attempts:", (err as Error).message);
        return;
      }
      const delay = Math.min(attempt * 2000, 12000);
      console.warn(`[EventConsumer] Attempt ${attempt} failed (${(err as Error).message}), retrying in ${delay}ms…`);
      await new Promise((r) => setTimeout(r, delay));
      started = true;
    }
  }
}
