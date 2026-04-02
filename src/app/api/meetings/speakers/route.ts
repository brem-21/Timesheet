import { NextResponse } from "next/server";
import { loadMeetings } from "@/lib/meetingStore";

export async function GET() {
  return NextResponse.json({ meetings: loadMeetings() });
}
