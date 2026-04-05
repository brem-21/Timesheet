export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { loadTimeLogsByProject, createTimeLog, deleteTimeLog } from "@/lib/projectStore";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const logs = await loadTimeLogsByProject(params.id);
  return NextResponse.json({ logs });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const { description, durationMin, loggedDate, taskId } = body;
  if (!description?.trim() || !durationMin || !loggedDate) {
    return NextResponse.json({ error: "description, durationMin, and loggedDate required" }, { status: 400 });
  }
  const log = await createTimeLog({
    projectId: params.id,
    taskId: taskId ?? undefined,
    description: description.trim(),
    durationMin: Number(durationMin),
    loggedDate,
  });
  return NextResponse.json({ log }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const { id } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await deleteTimeLog(id);
  return NextResponse.json({ ok: true });
}
