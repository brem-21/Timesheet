export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; commentId: string } }
) {
  await pool.query(
    `DELETE FROM task_comments WHERE id = $1 AND task_id = $2`,
    [params.commentId, params.id]
  );
  return NextResponse.json({ ok: true });
}
