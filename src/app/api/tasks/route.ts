import { NextRequest, NextResponse } from "next/server";
import { loadTasks, addTasks, saveTasks } from "@/lib/taskStoreServer";

export async function GET() {
  const tasks = loadTasks();
  return NextResponse.json({ tasks });
}

export async function POST(request: NextRequest) {
  const { tasks } = await request.json();
  if (!Array.isArray(tasks)) {
    return NextResponse.json({ error: "tasks must be an array" }, { status: 400 });
  }
  const updated = addTasks(tasks);
  return NextResponse.json({ tasks: updated });
}

export async function DELETE() {
  saveTasks([]);
  return NextResponse.json({ ok: true });
}
