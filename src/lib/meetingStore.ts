import { pool } from "./db";

export interface MeetingMeta {
  source: string;
  speakers: string[];
  date: string;
}

export async function loadMeetings(): Promise<MeetingMeta[]> {
  const result = await pool.query<MeetingMeta>(
    `SELECT source, speakers, date FROM meetings ORDER BY date DESC`
  );
  return result.rows;
}

export async function saveMeetingMeta(meta: MeetingMeta): Promise<void> {
  await pool.query(
    `INSERT INTO meetings (source, speakers, date)
     VALUES ($1, $2, $3)
     ON CONFLICT (source) DO UPDATE SET speakers = EXCLUDED.speakers, date = EXCLUDED.date`,
    [meta.source, meta.speakers, meta.date]
  );
}

export async function getMeetingSpeakers(source: string): Promise<string[]> {
  const result = await pool.query<{ speakers: string[] }>(
    `SELECT speakers FROM meetings WHERE source = $1`,
    [source]
  );
  return result.rows[0]?.speakers ?? [];
}
