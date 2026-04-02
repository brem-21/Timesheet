import { NextRequest, NextResponse } from "next/server";
import { loadSummaries, deleteSummary, updateSummaryLabel } from "@/lib/summaryStore";

export async function GET() {
  return NextResponse.json({ summaries: loadSummaries() });
}

export async function PATCH(request: NextRequest) {
  const { id, meetingLabel } = await request.json();
  if (!id || !meetingLabel?.trim()) {
    return NextResponse.json({ error: "id and meetingLabel required" }, { status: 400 });
  }
  const summaries = updateSummaryLabel(id, meetingLabel.trim());
  return NextResponse.json({ summaries });
}

export async function DELETE(request: NextRequest) {
  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const summaries = deleteSummary(id);
  return NextResponse.json({ summaries });
}
