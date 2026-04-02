import { pool } from "./db";

export type TaskStatus = "todo" | "in-progress" | "done";
export type TaskPriority = "high" | "medium" | "low";

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface MeetingTask {
  id: string;
  text: string;
  source: string;
  createdAt: number;
  status: TaskStatus;
  priority: TaskPriority;
  assignee?: string;
  reportsTo?: string;
  notes?: string;
  description?: string;
  checklist?: ChecklistItem[];
}

// ── helpers ────────────────────────────────────────────────────────────────────

function rowToTask(r: Record<string, unknown>): MeetingTask {
  return {
    id: r.id as string,
    text: r.text as string,
    source: r.source as string,
    createdAt: Number(r.created_at),
    status: r.status as TaskStatus,
    priority: r.priority as TaskPriority,
    assignee: (r.assignee as string) ?? undefined,
    reportsTo: (r.reports_to as string) ?? undefined,
    notes: (r.notes as string) ?? undefined,
    description: (r.description as string) ?? undefined,
    checklist: (r.checklist as ChecklistItem[]) ?? [],
  };
}

// ── public API ─────────────────────────────────────────────────────────────────

export async function loadTasks(): Promise<MeetingTask[]> {
  const result = await pool.query(`SELECT * FROM tasks ORDER BY created_at DESC`);
  return result.rows.map(rowToTask);
}

export async function addTasks(tasks: MeetingTask[]): Promise<MeetingTask[]> {
  for (const t of tasks) {
    await pool.query(
      `INSERT INTO tasks (id, text, source, created_at, status, priority, assignee, reports_to, notes, description, checklist)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO NOTHING`,
      [
        t.id, t.text, t.source, t.createdAt, t.status, t.priority,
        t.assignee ?? null, t.reportsTo ?? null, t.notes ?? null,
        t.description ?? null, JSON.stringify(t.checklist ?? []),
      ]
    );
  }
  return loadTasks();
}

export async function updateTask(id: string, patch: Partial<MeetingTask>): Promise<MeetingTask[]> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  const colMap: Record<string, string> = {
    text: "text", source: "source", createdAt: "created_at",
    status: "status", priority: "priority", assignee: "assignee",
    reportsTo: "reports_to", notes: "notes", description: "description",
    checklist: "checklist",
  };

  for (const [key, col] of Object.entries(colMap)) {
    if (key in patch) {
      const val = patch[key as keyof MeetingTask];
      fields.push(`${col} = $${idx++}`);
      values.push(key === "checklist" ? JSON.stringify(val) : val);
    }
  }

  if (fields.length > 0) {
    values.push(id);
    await pool.query(
      `UPDATE tasks SET ${fields.join(", ")} WHERE id = $${idx}`,
      values
    );
  }

  return loadTasks();
}

export async function deleteTask(id: string): Promise<MeetingTask[]> {
  await pool.query(`DELETE FROM tasks WHERE id = $1`, [id]);
  return loadTasks();
}

export async function clearTasks(): Promise<void> {
  await pool.query(`DELETE FROM tasks`);
}

export function generateTaskId(): string {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
