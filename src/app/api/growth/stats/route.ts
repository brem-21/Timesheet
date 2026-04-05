export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { loadGrowthStats } from "@/lib/growthStore";

export async function GET(request: NextRequest) {
  const startDate = request.nextUrl.searchParams.get("startDate") ?? undefined;
  const endDate = request.nextUrl.searchParams.get("endDate") ?? undefined;

  try {
    const stats = await loadGrowthStats(startDate, endDate);
    return NextResponse.json({ stats });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load growth stats";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
