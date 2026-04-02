import { NextRequest, NextResponse } from "next/server";
import { fetchTickets } from "@/lib/jira";
import { generateCSV } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const month = searchParams.get("month");
  const year = searchParams.get("year");
  const name = searchParams.get("name") ?? "user";

  if (!userId || !month || !year) {
    return NextResponse.json(
      { error: "Missing required parameters: userId, month, year" },
      { status: 400 }
    );
  }

  try {
    const tickets = await fetchTickets(userId, month, year);
    const csv = generateCSV(tickets, name, month, year);

    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
    const filename = `${safeName}_${year}_${month.padStart(2, "0")}_tickets.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[/api/export]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
