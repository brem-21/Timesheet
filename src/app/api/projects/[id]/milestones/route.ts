export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { loadMilestonesByProject } from "@/lib/milestoneStore";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const milestones = await loadMilestonesByProject(params.id);
    return NextResponse.json({ milestones });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
