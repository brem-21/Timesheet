export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: { id: string; taskId: string } }) {
  const body = await req.json();
  const allowed = ["text", "status", "priority", "assignee", "notes", "description", "checklist"];
  const fields: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;
  for (const key of allowed) {
    if (key in body) {
      const col = key === "checklist" ? "checklist" : key;
      fields.push(`${col} = $${idx++}`);
      vals.push(key === "checklist" ? JSON.stringify(body[key]) : body[key]);
    }
  }
  if (fields.length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  vals.push(params.taskId);
  vals.push(params.id);
  await pool.query(`UPDATE tasks SET ${fields.join(", ")} WHERE id = $${idx} AND project_id = $${idx + 1}`, vals);
  // Re-fetch is tricky with parameterized update; just re-read
  const r = await pool.query(`SELECT * FROM tasks WHERE id = $1`, [params.taskId]);
  if (r.rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const row = r.rows[0];
  return NextResponse.json({ task: {
    id: row.id, text: row.text, source: row.source, status: row.status, priority: row.priority,
    assignee: row.assignee, notes: row.notes, description: row.description, checklist: row.checklist,
    projectId: row.project_id, createdAt: Number(row.created_at),
  }});
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; taskId: string } }) {
  await pool.query(`DELETE FROM tasks WHERE id = $1 AND project_id = $2`, [params.taskId, params.id]);
  return NextResponse.json({ ok: true });
}
