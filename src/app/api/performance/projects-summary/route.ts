export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export interface ProjectSummaryItem {
  id: string;
  name: string;
  color: string;
  totalMinutes: number;
  taskCount: number;
  tasksDone: number;
  tasksInProgress: number;
  tasksInReview: number;
  tasksTodo: number;
  completionRate: number;
  logEntries: number;
}

// GET /api/performance/projects-summary?startDate=&endDate=
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("startDate") ?? "";
  const endDate = searchParams.get("endDate") ?? "";

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "startDate and endDate required" }, { status: 400 });
  }

  // All projects
  const projRes = await pool.query<{ id: string; name: string; color: string }>(
    `SELECT id, name, color FROM projects ORDER BY created_at DESC`
  );

  if (projRes.rows.length === 0) return NextResponse.json({ projects: [] });

  const projectIds = projRes.rows.map((p) => p.id);

  // Time logs in range per project
  const logsRes = await pool.query<{ project_id: string; total_min: number; log_count: number }>(
    `SELECT project_id, SUM(duration_min)::int AS total_min, COUNT(*)::int AS log_count
       FROM time_logs
      WHERE project_id = ANY($1)
        AND logged_date BETWEEN $2 AND $3
      GROUP BY project_id`,
    [projectIds, startDate, endDate]
  );

  // Task stats per project (current snapshot)
  const tasksRes = await pool.query<{
    project_id: string; total: number; done: number; in_progress: number; in_review: number; todo: number;
  }>(
    `SELECT project_id,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status='done')::int AS done,
            COUNT(*) FILTER (WHERE status='in-progress')::int AS in_progress,
            COUNT(*) FILTER (WHERE status='in-review')::int AS in_review,
            COUNT(*) FILTER (WHERE status='todo')::int AS todo
       FROM tasks
      WHERE project_id = ANY($1)
      GROUP BY project_id`,
    [projectIds]
  );

  const logsMap = Object.fromEntries(logsRes.rows.map((r) => [r.project_id, r]));
  const tasksMap = Object.fromEntries(tasksRes.rows.map((r) => [r.project_id, r]));

  const projects: ProjectSummaryItem[] = projRes.rows.map((p) => {
    const tl = logsMap[p.id];
    const tk = tasksMap[p.id];
    const taskCount = tk?.total ?? 0;
    const tasksDone = tk?.done ?? 0;
    return {
      id: p.id,
      name: p.name,
      color: p.color,
      totalMinutes: tl?.total_min ?? 0,
      logEntries: tl?.log_count ?? 0,
      taskCount,
      tasksDone,
      tasksInProgress: tk?.in_progress ?? 0,
      tasksInReview: tk?.in_review ?? 0,
      tasksTodo: tk?.todo ?? 0,
      completionRate: taskCount > 0 ? Math.round((tasksDone / taskCount) * 100) : 0,
    };
  });

  // Sort by time logged descending
  projects.sort((a, b) => b.totalMinutes - a.totalMinutes);

  const totalMinutesAll = projects.reduce((s, p) => s + p.totalMinutes, 0);
  const totalTasksDone = projects.reduce((s, p) => s + p.tasksDone, 0);
  const totalTasks = projects.reduce((s, p) => s + p.taskCount, 0);

  return NextResponse.json({
    projects,
    totals: {
      totalMinutes: totalMinutesAll,
      taskCount: totalTasks,
      tasksDone: totalTasksDone,
      completionRate: totalTasks > 0 ? Math.round((totalTasksDone / totalTasks) * 100) : 0,
    },
  });
}
