export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const r = await pool.query(
    `SELECT * FROM project_notes WHERE project_id = $1 ORDER BY updated_at DESC`,
    [params.id]
  );
  const notes = r.rows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    title: row.title ?? null,
    body: row.body,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  }));
  return NextResponse.json({ notes });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { title, body } = await req.json();
  if (!body?.trim()) return NextResponse.json({ error: "body required" }, { status: 400 });
  const id = `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = Date.now();
  await pool.query(
    `INSERT INTO project_notes (id, project_id, title, body, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$5)`,
    [id, params.id, title?.trim() || null, body.trim(), now]
  );
  return NextResponse.json({
    note: {
      id, projectId: params.id,
      title: title?.trim() || null, body: body.trim(),
      createdAt: now, updatedAt: now,
    },
  }, { status: 201 });
}
