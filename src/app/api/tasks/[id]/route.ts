import { NextRequest, NextResponse } from "next/server";
import { updateTask, deleteTask } from "@/lib/taskStoreServer";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const patch = await request.json();
  const tasks = updateTask(params.id, patch);
  return NextResponse.json({ tasks });
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const tasks = deleteTask(params.id);
  return NextResponse.json({ tasks });
}
