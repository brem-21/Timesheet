import { randomUUID } from "crypto";
import { pool } from "./db";

export interface DailyUpdate {
  id: string;
  dateKey: string;
  project: string;
  done: string[];
  today: string[];
  blockers: string[];
  sentAt: number | null;
  createdAt: number;
  updatedAt: number;
}

function rowToUpdate(r: Record<string, unknown>): DailyUpdate {
  return {
    id: r.id as string,
    dateKey: r.date_key as string,
    project: (r.project as string) ?? "",
    done: (r.done as string[]) ?? [],
    today: (r.today as string[]) ?? [],
    blockers: (r.blockers as string[]) ?? [],
    sentAt: r.sent_at != null ? Number(r.sent_at) : null,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
  };
}

export async function getDailyUpdate(dateKey: string): Promise<DailyUpdate | null> {
  const result = await pool.query(`SELECT * FROM daily_updates WHERE date_key = $1`, [dateKey]);
  return result.rows.length > 0 ? rowToUpdate(result.rows[0]) : null;
}

export async function upsertDailyUpdate(
  update: Omit<DailyUpdate, "sentAt" | "createdAt" | "updatedAt">
): Promise<DailyUpdate> {
  const now = Date.now();
  await pool.query(
    `INSERT INTO daily_updates (id, date_key, project, done, today, blockers, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
     ON CONFLICT (date_key) DO UPDATE
       SET project    = EXCLUDED.project,
           done       = EXCLUDED.done,
           today      = EXCLUDED.today,
           blockers   = EXCLUDED.blockers,
           updated_at = $7`,
    [
      update.id,
      update.dateKey,
      update.project || null,
      JSON.stringify(update.done),
      JSON.stringify(update.today),
      JSON.stringify(update.blockers),
      now,
    ]
  );
  const row = await getDailyUpdate(update.dateKey);
  return row!;
}

export async function markDailyUpdateSent(dateKey: string): Promise<void> {
  await pool.query(
    `UPDATE daily_updates SET sent_at = $1 WHERE date_key = $2`,
    [Date.now(), dateKey]
  );
}

export async function listRecentDailyUpdates(limit = 7): Promise<DailyUpdate[]> {
  const result = await pool.query(
    `SELECT * FROM daily_updates ORDER BY date_key DESC LIMIT $1`,
    [limit]
  );
  return result.rows.map(rowToUpdate);
}
