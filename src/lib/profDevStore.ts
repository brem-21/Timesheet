import { pool } from "./db";

export type ProfDevType =
  | "course"
  | "certification"
  | "book"
  | "workshop"
  | "conference"
  | "mentoring"
  | "presentation"
  | "shadowing"
  | "other";

export interface ProfDevEntry {
  id: string;
  title: string;
  type: ProfDevType;
  provider?: string;
  completedDate: string;   // "YYYY-MM-DD"
  durationHours?: number;
  notes?: string;
  skills?: string[];
  createdAt: number;
}

function rowToEntry(r: Record<string, unknown>): ProfDevEntry {
  return {
    id: r.id as string,
    title: r.title as string,
    type: r.type as ProfDevType,
    provider: (r.provider as string) ?? undefined,
    completedDate: r.completed_date as string,
    durationHours: r.duration_hours != null ? Number(r.duration_hours) : undefined,
    notes: (r.notes as string) ?? undefined,
    skills: (r.skills as string[]) ?? [],
    createdAt: Number(r.created_at),
  };
}

export async function loadProfDev(): Promise<ProfDevEntry[]> {
  const result = await pool.query(`SELECT * FROM profdev ORDER BY created_at DESC`);
  return result.rows.map(rowToEntry);
}

export async function addProfDev(e: ProfDevEntry): Promise<ProfDevEntry[]> {
  await pool.query(
    `INSERT INTO profdev (id, title, type, provider, completed_date, duration_hours, notes, skills, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [e.id, e.title, e.type, e.provider ?? null, e.completedDate,
     e.durationHours ?? null, e.notes ?? null, e.skills ?? [], e.createdAt]
  );
  return loadProfDev();
}

export async function updateProfDev(id: string, patch: Partial<ProfDevEntry>): Promise<ProfDevEntry[]> {
  const colMap: Record<string, string> = {
    title: "title", type: "type", provider: "provider",
    completedDate: "completed_date", durationHours: "duration_hours",
    notes: "notes", skills: "skills", createdAt: "created_at",
  };

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const [key, col] of Object.entries(colMap)) {
    if (key in patch) {
      fields.push(`${col} = $${idx++}`);
      values.push(patch[key as keyof ProfDevEntry] ?? null);
    }
  }

  if (fields.length > 0) {
    values.push(id);
    await pool.query(
      `UPDATE profdev SET ${fields.join(", ")} WHERE id = $${idx}`,
      values
    );
  }

  return loadProfDev();
}

export async function deleteProfDev(id: string): Promise<ProfDevEntry[]> {
  await pool.query(`DELETE FROM profdev WHERE id = $1`, [id]);
  return loadProfDev();
}
