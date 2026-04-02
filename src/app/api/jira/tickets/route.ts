import { NextRequest, NextResponse } from "next/server";
import { fetchTickets } from "@/lib/jira";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const month = searchParams.get("month");
  const year = searchParams.get("year");

  if (!userId || !month || !year) {
    return NextResponse.json(
      { error: "Missing required parameters: userId, month, year" },
      { status: 400 }
    );
  }

  try {
    const tickets = await fetchTickets(userId, month, year);
    return NextResponse.json({ tickets, total: tickets.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[/api/jira/tickets]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
