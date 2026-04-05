export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { loadMaterials, addMaterial } from "@/lib/growthStore";

export async function GET(request: NextRequest) {
  const topicId = request.nextUrl.searchParams.get("topicId");
  if (!topicId) return NextResponse.json({ error: "topicId is required" }, { status: 400 });

  try {
    const materials = await loadMaterials(topicId);
    return NextResponse.json({ materials });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load materials";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { topicId, title, type, url, contentText, sourceUrl } = body;

    if (!topicId || !title || !type) {
      return NextResponse.json({ error: "topicId, title, and type are required" }, { status: 400 });
    }
    if (!["link", "note", "ai_suggestion"].includes(type)) {
      return NextResponse.json({ error: "type must be link, note, or ai_suggestion" }, { status: 400 });
    }

    const material = await addMaterial({ topicId, title, type, url, contentText, sourceUrl });
    return NextResponse.json({ material });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add material";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
