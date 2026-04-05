import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

// GET /api/projects/[id]/export  — download CSV of tasks + time logs for this project
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const [projectRes, tasksRes, logsRes] = await Promise.all([
    pool.query<{ name: string }>(`SELECT name FROM projects WHERE id = $1`, [params.id]),
    pool.query<{
      id: string; text: string; status: string; priority: string;
      assignee: string | null; description: string | null; created_at: number;
    }>(
      `SELECT id, text, status, priority, assignee, description, created_at
         FROM tasks WHERE project_id = $1 ORDER BY created_at DESC`,
      [params.id]
    ),
    pool.query<{
      id: string; description: string; duration_min: number; logged_date: string;
      task_id: string | null; created_at: number;
    }>(
      `SELECT id, description, duration_min, logged_date, task_id, created_at
         FROM time_logs WHERE project_id = $1 ORDER BY logged_date DESC`,
      [params.id]
    ),
  ]);

  if (projectRes.rows.length === 0) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const projectName = projectRes.rows[0].name;
  const lines: string[] = [];

  // Tasks section
  lines.push("TASKS");
  lines.push("id,text,status,priority,assignee,description,created_at");
  for (const t of tasksRes.rows) {
    lines.push([
      csvCell(t.id),
      csvCell(t.text),
      csvCell(t.status),
      csvCell(t.priority),
      csvCell(t.assignee ?? ""),
      csvCell(t.description ?? ""),
      csvCell(new Date(t.created_at).toISOString()),
    ].join(","));
  }

  lines.push("");

  // Time logs section
  lines.push("TIME LOGS");
  lines.push("id,description,duration_min,hours,logged_date,task_id,created_at");
  for (const l of logsRes.rows) {
    const hours = (l.duration_min / 60).toFixed(2);
    lines.push([
      csvCell(l.id),
      csvCell(l.description),
      String(l.duration_min),
      hours,
      csvCell(l.logged_date),
      csvCell(l.task_id ?? ""),
      csvCell(new Date(l.created_at).toISOString()),
    ].join(","));
  }

  const csv = lines.join("\n");
  const filename = `${projectName.replace(/[^a-z0-9]/gi, "_")}_export.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function csvCell(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
