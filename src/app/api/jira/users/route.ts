import { NextRequest, NextResponse } from "next/server";
import { searchUser } from "@/lib/jira";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");

  if (!query || query.trim().length < 2) {
    return NextResponse.json(
      { error: "query must be at least 2 characters" },
      { status: 400 }
    );
  }

  try {
    const users = await searchUser(query.trim());
    return NextResponse.json({ users });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[/api/jira/users]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
