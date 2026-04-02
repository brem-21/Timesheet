import { NextRequest, NextResponse } from "next/server";
import { fetchTicketsByRange } from "@/lib/jira";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!userId || !startDate || !endDate) {
    return NextResponse.json(
      { error: "Missing required parameters: userId, startDate, endDate" },
      { status: 400 }
    );
  }

  try {
    const tickets = await fetchTicketsByRange(userId, startDate, endDate);
    return NextResponse.json({ tickets, total: tickets.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[/api/jira/tickets-range]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
