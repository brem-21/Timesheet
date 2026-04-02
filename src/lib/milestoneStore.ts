import { pool } from "./db";

export type MilestoneStatus = "pending" | "in-progress" | "completed";
export type MilestoneCategory =
  | "technical"
  | "leadership"
  | "delivery"
  | "growth"
  | "communication"
  | "other";

export interface Milestone {
  id: string;
  title: string;
  description?: string;
  targetDate?: string;   // "YYYY-MM-DD"
  completedAt?: string;  // ISO string
  status: MilestoneStatus;
  category: MilestoneCategory;
  createdAt: number;
}

function rowToMilestone(r: Record<string, unknown>): Milestone {
  return {
    id: r.id as string,
    title: r.title as string,
    description: (r.description as string) ?? undefined,
    targetDate: (r.target_date as string) ?? undefined,
    completedAt: (r.completed_at as string) ?? undefined,
    status: r.status as MilestoneStatus,
    category: r.category as MilestoneCategory,
    createdAt: Number(r.created_at),
  };
}

export async function loadMilestones(): Promise<Milestone[]> {
  const result = await pool.query(`SELECT * FROM milestones ORDER BY created_at DESC`);
  return result.rows.map(rowToMilestone);
}

export async function addMilestone(m: Milestone): Promise<Milestone[]> {
  await pool.query(
    `INSERT INTO milestones (id, title, description, target_date, completed_at, status, category, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [m.id, m.title, m.description ?? null, m.targetDate ?? null,
     m.completedAt ?? null, m.status, m.category, m.createdAt]
  );
  return loadMilestones();
}

export async function updateMilestone(id: string, patch: Partial<Milestone>): Promise<Milestone[]> {
  const colMap: Record<string, string> = {
    title: "title", description: "description", targetDate: "target_date",
    completedAt: "completed_at", status: "status", category: "category",
    createdAt: "created_at",
  };

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const [key, col] of Object.entries(colMap)) {
    if (key in patch) {
      fields.push(`${col} = $${idx++}`);
      values.push(patch[key as keyof Milestone] ?? null);
    }
  }

  if (fields.length > 0) {
    values.push(id);
    await pool.query(
      `UPDATE milestones SET ${fields.join(", ")} WHERE id = $${idx}`,
      values
    );
  }

  return loadMilestones();
}

export async function deleteMilestone(id: string): Promise<Milestone[]> {
  await pool.query(`DELETE FROM milestones WHERE id = $1`, [id]);
  return loadMilestones();
}
