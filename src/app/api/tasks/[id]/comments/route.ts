export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const r = await pool.query(
    `SELECT * FROM task_comments WHERE task_id = $1 ORDER BY created_at ASC`,
    [params.id]
  );
  const comments = r.rows.map((row) => ({
    id: row.id,
    taskId: row.task_id,
    body: row.body,
    createdAt: Number(row.created_at),
  }));
  return NextResponse.json({ comments });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { body } = await req.json();
  if (!body?.trim()) return NextResponse.json({ error: "body required" }, { status: 400 });
  const id = `cmt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = Date.now();
  await pool.query(
    `INSERT INTO task_comments (id, task_id, body, created_at) VALUES ($1,$2,$3,$4)`,
    [id, params.id, body.trim(), now]
  );
  return NextResponse.json({
    comment: { id, taskId: params.id, body: body.trim(), createdAt: now },
  }, { status: 201 });
}
