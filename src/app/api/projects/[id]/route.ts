export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { updateProject, loadProjectStats } from "@/lib/projectStore";
import { pool } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const [projRes, stats] = await Promise.all([
    pool.query(`SELECT * FROM projects WHERE id = $1`, [id]),
    loadProjectStats(id),
  ]);
  if (projRes.rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const p = projRes.rows[0];
  return NextResponse.json({
    project: { id: p.id, name: p.name, description: p.description, color: p.color, createdAt: Number(p.created_at) },
    stats,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const body = await req.json();
  const project = await updateProject(id, body);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ project });
}
