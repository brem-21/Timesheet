import { createConsumer, EVENTS_TOPIC } from "./kafka";
import { pool } from "./db";

// ── Feature catalogue for recommendations ─────────────────────────────────────

const FEATURES = [
  {
    feature: "/meetings",
    label: "Meeting Summaries",
    description: "Summarise transcripts, extract action items, and identify speakers",
  },
  {
    feature: "/performance",
    label: "Performance Hub",
    description: "Generate AI-powered performance insights from your Jira and meeting data",
  },
  {
    feature: "/tasks",
    label: "Task Board",
    description: "Manage and track all meeting action items in one place",
  },
  {
    feature: "/standup",
    label: "Standup Generator",
    description: "Auto-generate daily standup reports and send them to Slack or Teams",
  },
  {
    feature: "/export",
    label: "Export & Reports",
    description: "Export your time logs and generate reports as CSV or PDF",
  },
  {
    feature: "/timelog",
    label: "Time Log",
    description: "Detailed breakdown of all logged time by ticket, date, and session",
  },
  {
    feature: "/overview",
    label: "Dashboard Overview",
    description: "High-level view of your productivity stats across all features",
  },
];

// ── Upsert a raw event row ────────────────────────────────────────────────────

async function persistEvent(e: Record<string, unknown>): Promise<void> {
  await pool.query(
    `INSERT INTO user_events
       (id, type, session_id, path, component, action, os, browser, device_type, ip, referrer, timestamp, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (id) DO NOTHING`,
    [
      e.eventId,
      e.type,
      e.sessionId,
      e.path ?? null,
      e.component ?? null,
      e.action ?? null,
      e.os ?? null,
      e.browser ?? null,
      e.deviceType ?? null,
      e.ip ?? null,
      e.referrer ?? null,
      e.timestamp,
      JSON.stringify(e.metadata ?? {}),
    ]
  );
}

// ── Recommendation engine ─────────────────────────────────────────────────────

async function recomputeRecommendations(): Promise<void> {
  const since = Date.now() - 30 * 24 * 60 * 60 * 1000; // last 30 days

  // Count page views per feature path
  const { rows } = await pool.query<{ path: string; visits: string }>(
    `SELECT path, COUNT(*) AS visits
     FROM user_events
     WHERE timestamp >= $1 AND type = 'page_view' AND path IS NOT NULL
     GROUP BY path`,
    [since]
  );

  const visitMap: Record<string, number> = {};
  for (const row of rows) visitMap[row.path] = Number(row.visits);

  // Count click interactions per feature
  const { rows: clickRows } = await pool.query<{ path: string; clicks: string }>(
    `SELECT path, COUNT(*) AS clicks
     FROM user_events
     WHERE timestamp >= $1 AND type = 'click' AND path IS NOT NULL
     GROUP BY path`,
    [since]
  );
  const clickMap: Record<string, number> = {};
  for (const row of clickRows) clickMap[row.path] = Number(row.clicks);

  const maxVisits = Math.max(...Object.values(visitMap), 1);
  const maxClicks = Math.max(...Object.values(clickMap), 1);

  for (const feat of FEATURES) {
    const visits = visitMap[feat.feature] ?? 0;
    const clicks = clickMap[feat.feature] ?? 0;
    // Weighted score — 70% visit frequency, 30% click frequency
    // Score 0 = heavily used (already familiar), 1 = never touched (most recommended)
    const usageScore = 0.7 * (visits / maxVisits) + 0.3 * (clicks / maxClicks);
    const score = parseFloat((1 - usageScore).toFixed(4));

    await pool.query(
      `INSERT INTO recommendations (feature, label, description, score, last_updated)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (feature) DO UPDATE SET score = $4, last_updated = $5`,
      [feat.feature, feat.label, feat.description, score, Date.now()]
    );
  }
}

// ── Consumer entrypoint ───────────────────────────────────────────────────────

let started = false;

export async function startEventConsumer(): Promise<void> {
  if (started) return;
  started = true;

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
      // Recompute recommendations every 50 events
      if (batchCount % 50 === 0) {
        recomputeRecommendations().catch((err) =>
          console.error("[EventConsumer] Recommendation recompute failed:", err)
        );
      }
    },
  });

  // Initial seeding on startup
  recomputeRecommendations().catch((err) =>
    console.error("[EventConsumer] Initial recommendation seeding failed:", err)
  );

  console.log("[Clock-It] Kafka event consumer started →", EVENTS_TOPIC);
}
