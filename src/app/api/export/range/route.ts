import { NextRequest, NextResponse } from "next/server";
import { fetchTicketsByRange } from "@/lib/jira";
import { generateCSVByRange } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const name = searchParams.get("name") ?? "user";

  if (!userId || !startDate || !endDate) {
    return NextResponse.json({ error: "Missing userId, startDate, or endDate" }, { status: 400 });
  }

  try {
    const tickets = await fetchTicketsByRange(userId, startDate, endDate);
    const csv = generateCSVByRange(tickets, name, startDate, endDate);
    const filename = `clockit_${name.replace(/\s+/g, "_")}_${startDate}_${endDate}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
