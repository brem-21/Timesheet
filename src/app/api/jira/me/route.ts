import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/jira";

export async function GET() {
  try {
    const user = await getCurrentUser();
    return NextResponse.json({ user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[/api/jira/me]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
