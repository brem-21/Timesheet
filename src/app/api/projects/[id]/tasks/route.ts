export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const r = await pool.query(
    `SELECT * FROM tasks WHERE project_id = $1 ORDER BY created_at DESC`,
    [params.id]
  );
  const tasks = r.rows.map((row) => ({
    id: row.id,
    text: row.text,
    source: row.source,
    status: row.status,
    priority: row.priority,
    assignee: row.assignee ?? undefined,
    notes: row.notes ?? undefined,
    description: row.description ?? undefined,
    checklist: row.checklist ?? [],
    projectId: row.project_id,
    createdAt: Number(row.created_at),
  }));
  return NextResponse.json({ tasks });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const { text, priority = "medium", assignee, notes, description, checklist = [] } = body;
  if (!text?.trim()) return NextResponse.json({ error: "text required" }, { status: 400 });
  const id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = Date.now();
  await pool.query(
    `INSERT INTO tasks (id, text, source, created_at, status, priority, assignee, notes, description, checklist, project_id)
     VALUES ($1,$2,$3,$4,'todo',$5,$6,$7,$8,$9,$10)`,
    [id, text.trim(), "manual", now, priority, assignee ?? null, notes ?? null, description ?? null, JSON.stringify(checklist), params.id]
  );
  const r = await pool.query(`SELECT * FROM tasks WHERE id = $1`, [id]);
  const row = r.rows[0];
  return NextResponse.json({ task: {
    id: row.id, text: row.text, source: row.source, status: row.status, priority: row.priority,
    assignee: row.assignee, notes: row.notes, description: row.description, checklist: row.checklist,
    projectId: row.project_id, createdAt: Number(row.created_at),
  }}, { status: 201 });
}
