import { pool } from "./db";

const MAX_HISTORY = 5;

export interface SavedPerformance {
  id: string;
  savedAt: number;
  dateLabel: string;
  rangeLabel: string;
  startDate: string;
  endDate: string;
  stats: Record<string, number | string>;
  insights: string;
}

function rowToSaved(r: Record<string, unknown>): SavedPerformance {
  return {
    id: r.id as string,
    savedAt: Number(r.saved_at),
    dateLabel: r.date_label as string,
    rangeLabel: r.range_label as string,
    startDate: r.start_date as string,
    endDate: r.end_date as string,
    stats: r.stats as Record<string, number | string>,
    insights: r.insights as string,
  };
}

export async function loadPerformanceHistory(): Promise<SavedPerformance[]> {
  const result = await pool.query(
    `SELECT * FROM performance_history ORDER BY saved_at DESC`
  );
  return result.rows.map(rowToSaved);
}

export async function savePerformanceEntry(
  entry: Omit<SavedPerformance, "id" | "savedAt">
): Promise<SavedPerformance[]> {
  const id = `perf-${Date.now()}`;
  const savedAt = Date.now();
  await pool.query(
    `INSERT INTO performance_history (id, saved_at, date_label, range_label, start_date, end_date, stats, insights)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, savedAt, entry.dateLabel, entry.rangeLabel,
     entry.startDate, entry.endDate, JSON.stringify(entry.stats), entry.insights]
  );
  // Keep only MAX_HISTORY
  await pool.query(`
    DELETE FROM performance_history
    WHERE id NOT IN (
      SELECT id FROM performance_history ORDER BY saved_at DESC LIMIT $1
    )
  `, [MAX_HISTORY]);
  return loadPerformanceHistory();
}

export async function updatePerformanceLabel(id: string, dateLabel: string): Promise<SavedPerformance[]> {
  await pool.query(
    `UPDATE performance_history SET date_label = $1 WHERE id = $2`,
    [dateLabel, id]
  );
  return loadPerformanceHistory();
}

export async function deletePerformanceEntry(id: string): Promise<SavedPerformance[]> {
  await pool.query(`DELETE FROM performance_history WHERE id = $1`, [id]);
  return loadPerformanceHistory();
}
