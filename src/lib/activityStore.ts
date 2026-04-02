import { pool } from "./db";

const MAX_ENTRIES = 2000;

export interface ActivityEntry {
  path: string;
  title?: string;
  timestamp: number;
  type: "page" | "api" | "browser";
}

export async function logActivity(entry: ActivityEntry): Promise<void> {
  await pool.query(
    `INSERT INTO activity (path, title, timestamp, type) VALUES ($1, $2, $3, $4)`,
    [entry.path, entry.title ?? null, entry.timestamp, entry.type]
  );
  // Trim to MAX_ENTRIES
  await pool.query(`
    DELETE FROM activity
    WHERE id NOT IN (
      SELECT id FROM activity ORDER BY timestamp DESC LIMIT $1
    )
  `, [MAX_ENTRIES]);
}

export async function getLastActivityTime(): Promise<number | null> {
  const result = await pool.query<{ timestamp: string }>(
    `SELECT timestamp FROM activity ORDER BY timestamp DESC LIMIT 1`
  );
  return result.rows[0] ? Number(result.rows[0].timestamp) : null;
}

export interface ActivitySummaryEntry {
  path: string;
  count: number;
  lastVisit: number;
}

export async function getActivitySummary(sinceMs: number): Promise<ActivitySummaryEntry[]> {
  const result = await pool.query<{ path: string; count: string; last_visit: string }>(
    `SELECT path, COUNT(*) AS count, MAX(timestamp) AS last_visit
     FROM activity
     WHERE timestamp >= $1
     GROUP BY path
     ORDER BY last_visit DESC`,
    [sinceMs]
  );
  return result.rows.map((r) => ({
    path: r.path,
    count: Number(r.count),
    lastVisit: Number(r.last_visit),
  }));
}
