export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { loadProfDev, addProfDev, ProfDevEntry } from "@/lib/profDevStore";

export async function GET() {
  try {
    const entries = await loadProfDev();
    return NextResponse.json(entries);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const entry: ProfDevEntry = {
      id: `pd-${Date.now()}`,
      title: body.title,
      type: body.type ?? "other",
      provider: body.provider,
      completedDate: body.completedDate,
      durationHours: body.durationHours !== undefined ? Number(body.durationHours) : undefined,
      notes: body.notes,
      skills: Array.isArray(body.skills) ? body.skills : [],
      createdAt: Date.now(),
    };
    const updated = await addProfDev(entry);
    return NextResponse.json(updated, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
