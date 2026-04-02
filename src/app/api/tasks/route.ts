export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { loadTasks, addTasks, clearTasks } from "@/lib/taskStoreServer";

export async function GET() {
  const tasks = await loadTasks();
  return NextResponse.json({ tasks });
}

export async function POST(request: NextRequest) {
  const { tasks } = await request.json();
  if (!Array.isArray(tasks)) {
    return NextResponse.json({ error: "tasks must be an array" }, { status: 400 });
  }
  const updated = await addTasks(tasks);
  return NextResponse.json({ tasks: updated });
}

export async function DELETE() {
  await clearTasks();
  return NextResponse.json({ ok: true });
}
