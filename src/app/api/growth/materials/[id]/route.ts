export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { deleteMaterial } from "@/lib/growthStore";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await deleteMaterial(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete material";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
