import { pool } from "./db";
import { TranscriptSummary } from "./summarize";

const MAX_HISTORY = 5;

export interface SavedSummary {
  id: string;
  savedAt: number;
  summary: TranscriptSummary;
}

function rowToSaved(r: Record<string, unknown>): SavedSummary {
  return {
    id: r.id as string,
    savedAt: Number(r.saved_at),
    summary: r.summary as TranscriptSummary,
  };
}

export async function loadSummaries(): Promise<SavedSummary[]> {
  const result = await pool.query(
    `SELECT * FROM summaries ORDER BY saved_at DESC`
  );
  return result.rows.map(rowToSaved);
}

export async function saveSummary(summary: TranscriptSummary): Promise<SavedSummary[]> {
  const id = `sum-${Date.now()}`;
  const savedAt = Date.now();
  await pool.query(
    `INSERT INTO summaries (id, saved_at, summary) VALUES ($1, $2, $3)`,
    [id, savedAt, JSON.stringify(summary)]
  );
  // Keep only MAX_HISTORY
  await pool.query(`
    DELETE FROM summaries
    WHERE id NOT IN (
      SELECT id FROM summaries ORDER BY saved_at DESC LIMIT $1
    )
  `, [MAX_HISTORY]);
  return loadSummaries();
}

export async function deleteSummary(id: string): Promise<SavedSummary[]> {
  await pool.query(`DELETE FROM summaries WHERE id = $1`, [id]);
  return loadSummaries();
}

export async function updateSummaryLabel(id: string, meetingLabel: string): Promise<SavedSummary[]> {
  await pool.query(
    `UPDATE summaries SET summary = summary || $1::jsonb WHERE id = $2`,
    [JSON.stringify({ meetingLabel }), id]
  );
  return loadSummaries();
}
