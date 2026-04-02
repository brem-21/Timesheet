import { NextRequest, NextResponse } from "next/server";
import { sendStandupToTeams } from "@/lib/teams";
import { StandupSummary } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const summary: StandupSummary = body.summary;

    if (!summary || !summary.userName) {
      return NextResponse.json(
        { error: "Missing required field: summary" },
        { status: 400 }
      );
    }

    await sendStandupToTeams(summary);
    return NextResponse.json({ success: true, message: "Standup sent to Microsoft Teams successfully." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[/api/standup/teams]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
