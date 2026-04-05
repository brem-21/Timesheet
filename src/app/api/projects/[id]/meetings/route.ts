import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

// GET  /api/projects/[id]/meetings  — list meetings linked to this project
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { rows } = await pool.query<{
    id: string; saved_at: number; label: string | null; date: string | null;
  }>(
    `SELECT s.id, s.saved_at,
            s.summary->>'meetingLabel' AS label,
            s.summary->>'date'        AS date
       FROM project_meetings pm
       JOIN summaries s ON s.id = pm.meeting_id
      WHERE pm.project_id = $1
      ORDER BY s.saved_at DESC`,
    [params.id]
  );
  return NextResponse.json({ meetings: rows });
}

// POST /api/projects/[id]/meetings  — link a meeting (body: { meetingId })
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { meetingId } = await req.json();
  if (!meetingId) return NextResponse.json({ error: "meetingId required" }, { status: 400 });

  await pool.query(
    `INSERT INTO project_meetings (project_id, meeting_id, linked_at)
     VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING`,
    [params.id, meetingId, Date.now()]
  );
  return NextResponse.json({ ok: true });
}

// DELETE /api/projects/[id]/meetings  — unlink a meeting (body: { meetingId })
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { meetingId } = await req.json();
  if (!meetingId) return NextResponse.json({ error: "meetingId required" }, { status: 400 });

  await pool.query(
    `DELETE FROM project_meetings WHERE project_id = $1 AND meeting_id = $2`,
    [params.id, meetingId]
  );
  return NextResponse.json({ ok: true });
}
