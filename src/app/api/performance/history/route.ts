import { NextRequest, NextResponse } from "next/server";
import {
  loadPerformanceHistory,
  updatePerformanceLabel,
  deletePerformanceEntry,
} from "@/lib/performanceStore";

export async function GET() {
  return NextResponse.json({ history: loadPerformanceHistory() });
}

export async function PATCH(request: NextRequest) {
  const { id, dateLabel } = await request.json();
  if (!id || !dateLabel) {
    return NextResponse.json({ error: "id and dateLabel required" }, { status: 400 });
  }
  const history = updatePerformanceLabel(id, dateLabel);
  return NextResponse.json({ history });
}

export async function DELETE(request: NextRequest) {
  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const history = deletePerformanceEntry(id);
  return NextResponse.json({ history });
}
