export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; noteId: string } }
) {
  const { title, body } = await req.json();
  if (!body?.trim()) return NextResponse.json({ error: "body required" }, { status: 400 });
  const now = Date.now();
  const r = await pool.query(
    `UPDATE project_notes SET title=$1, body=$2, updated_at=$3
     WHERE id=$4 AND project_id=$5
     RETURNING *`,
    [title?.trim() || null, body.trim(), now, params.noteId, params.id]
  );
  if (r.rows.length === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
  const row = r.rows[0];
  return NextResponse.json({
    note: {
      id: row.id, projectId: row.project_id,
      title: row.title ?? null, body: row.body,
      createdAt: Number(row.created_at), updatedAt: Number(row.updated_at),
    },
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; noteId: string } }
) {
  await pool.query(
    `DELETE FROM project_notes WHERE id=$1 AND project_id=$2`,
    [params.noteId, params.id]
  );
  return NextResponse.json({ ok: true });
}
