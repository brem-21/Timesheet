export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { loadMilestones, addMilestone, Milestone } from "@/lib/milestoneStore";

export async function GET() {
  try {
    const milestones = await loadMilestones();
    return NextResponse.json(milestones);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const milestone: Milestone = {
      id: `milestone-${Date.now()}`,
      title: body.title,
      description: body.description,
      targetDate: body.targetDate,
      completedAt: body.completedAt,
      status: body.status ?? "pending",
      category: body.category ?? "other",
      createdAt: Date.now(),
    };
    const updated = await addMilestone(milestone);
    return NextResponse.json(updated, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
