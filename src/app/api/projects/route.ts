export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { loadProjects, createProject, deleteProject } from "@/lib/projectStore";

export async function GET() {
  const projects = await loadProjects();
  return NextResponse.json({ projects });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, description, color } = body;
  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });
  const project = await createProject(name.trim(), description?.trim(), color);
  return NextResponse.json({ project }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const { id } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await deleteProject(id);
  return NextResponse.json({ ok: true });
}
