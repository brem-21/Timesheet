export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { loadTopics, addCustomTopic, deleteCustomTopic } from "@/lib/growthStore";

export async function GET() {
  try {
    const topics = await loadTopics();
    return NextResponse.json({ topics });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load topics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { label, description } = await request.json();
    if (!label?.trim()) {
      return NextResponse.json({ error: "label is required" }, { status: 400 });
    }
    const topic = await addCustomTopic(label.trim(), description?.trim());
    return NextResponse.json({ topic });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add topic";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    await deleteCustomTopic(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete topic";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
