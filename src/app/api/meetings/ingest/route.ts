import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const PENDING_FILE = path.join(process.cwd(), "data", "pending_transcript.json");

function ensureDir() {
  const dir = path.dirname(PENDING_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Extension POSTs transcript here
export async function POST(req: Request) {
  try {
    const { transcript, meetingLabel } = await req.json();
    if (!transcript) return NextResponse.json({ error: "Missing transcript" }, { status: 400 });
    ensureDir();
    fs.writeFileSync(PENDING_FILE, JSON.stringify({ transcript, meetingLabel: meetingLabel ?? "", timestamp: Date.now() }));
    return NextResponse.json({ ok: true }, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: "Failed to save transcript" }, { status: 500 });
  }
}

// Meetings page GETs transcript (once — clears after reading)
export async function GET() {
  try {
    const raw = fs.readFileSync(PENDING_FILE, "utf-8");
    fs.unlinkSync(PENDING_FILE); // consume it
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({ transcript: null, meetingLabel: "" });
  }
}

// Preflight for extension CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
