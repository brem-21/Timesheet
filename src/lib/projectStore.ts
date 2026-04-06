import { pool } from "./db";

export interface Project {
  id: string;
  name: string;
  description?: string;
  color: string;
  createdAt: number;
}

export interface TimeLog {
  id: string;
  projectId: string;
  taskId?: string;
  description: string;
  durationMin: number;
  loggedDate: string;
  createdAt: number;
}

function projectId(): string {
  return `proj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
function timeLogId(): string {
  return `tl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function rowToProject(r: Record<string, unknown>): Project {
  return {
    id: r.id as string,
    name: r.name as string,
    description: (r.description as string) ?? undefined,
    color: (r.color as string) ?? "#6366f1",
    createdAt: Number(r.created_at),
  };
}

function rowToTimeLog(r: Record<string, unknown>): TimeLog {
  return {
    id: r.id as string,
    projectId: r.project_id as string,
    taskId: (r.task_id as string) ?? undefined,
    description: r.description as string,
    durationMin: Number(r.duration_min),
    loggedDate: r.logged_date as string,
    createdAt: Number(r.created_at),
  };
}

// Projects CRUD
export async function loadProjects(): Promise<Project[]> {
  const r = await pool.query(`SELECT * FROM projects ORDER BY created_at DESC`);
  return r.rows.map(rowToProject);
}

export async function createProject(name: string, description?: string, color?: string): Promise<Project> {
  const id = projectId();
  const now = Date.now();
  await pool.query(
    `INSERT INTO projects (id, name, description, color, created_at) VALUES ($1,$2,$3,$4,$5)`,
    [id, name, description ?? null, color ?? "#6366f1", now]
  );
  const r = await pool.query(`SELECT * FROM projects WHERE id = $1`, [id]);
  return rowToProject(r.rows[0]);
}

export async function updateProject(id: string, updates: Partial<Pick<Project, "name" | "description" | "color">>): Promise<Project | null> {
  const fields: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;
  if (updates.name !== undefined)        { fields.push(`name = $${idx++}`);        vals.push(updates.name); }
  if (updates.description !== undefined) { fields.push(`description = $${idx++}`); vals.push(updates.description); }
  if (updates.color !== undefined)       { fields.push(`color = $${idx++}`);       vals.push(updates.color); }
  if (fields.length === 0) return null;
  vals.push(id);
  await pool.query(`UPDATE projects SET ${fields.join(", ")} WHERE id = $${idx}`, vals);
  const r = await pool.query(`SELECT * FROM projects WHERE id = $1`, [id]);
  return r.rows.length > 0 ? rowToProject(r.rows[0]) : null;
}

export async function deleteProject(id: string): Promise<void> {
  await pool.query(`DELETE FROM projects WHERE id = $1`, [id]);
}

// Time logs CRUD
export async function loadTimeLogsByProject(projectId: string): Promise<TimeLog[]> {
  const r = await pool.query(
    `SELECT * FROM time_logs WHERE project_id = $1 ORDER BY logged_date DESC, created_at DESC`,
    [projectId]
  );
  return r.rows.map(rowToTimeLog);
}

export async function createTimeLog(log: Omit<TimeLog, "id" | "createdAt">): Promise<TimeLog> {
  const id = timeLogId();
  const now = Date.now();
  await pool.query(
    `INSERT INTO time_logs (id, project_id, task_id, description, duration_min, logged_date, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [id, log.projectId, log.taskId ?? null, log.description, log.durationMin, log.loggedDate, now]
  );
  const r = await pool.query(`SELECT * FROM time_logs WHERE id = $1`, [id]);
  return rowToTimeLog(r.rows[0]);
}

export async function deleteTimeLog(id: string): Promise<void> {
  await pool.query(`DELETE FROM time_logs WHERE id = $1`, [id]);
}

export async function loadProjectStats(projectId: string): Promise<{
  totalMinutes: number; taskCount: number; doneCount: number;
  inProgressCount: number; inReviewCount: number; todoCount: number;
}> {
  const [tl, tc] = await Promise.all([
    pool.query(`SELECT COALESCE(SUM(duration_min),0) AS total FROM time_logs WHERE project_id = $1`, [projectId]),
    pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status='done')::int AS done,
        COUNT(*) FILTER (WHERE status='in-progress')::int AS in_progress,
        COUNT(*) FILTER (WHERE status='in-review')::int AS in_review,
        COUNT(*) FILTER (WHERE status='todo')::int AS todo
      FROM tasks WHERE project_id = $1`, [projectId]),
  ]);
  return {
    totalMinutes: Number(tl.rows[0].total),
    taskCount: Number(tc.rows[0].total),
    doneCount: Number(tc.rows[0].done),
    inProgressCount: Number(tc.rows[0].in_progress),
    inReviewCount: Number(tc.rows[0].in_review),
    todoCount: Number(tc.rows[0].todo),
  };
}
