export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export interface Recommendation {
  feature: string;
  label: string;
  description: string;
  score: number;
}

export async function GET() {
  try {
    const { rows } = await pool.query<Recommendation>(
      `SELECT feature, label, description, ROUND(score::numeric, 4) AS score
       FROM recommendations
       ORDER BY score DESC
       LIMIT 3`
    );
    return NextResponse.json({ recommendations: rows });
  } catch (err) {
    console.error("[/api/recommendations]", err);
    return NextResponse.json({ recommendations: [] });
  }
}
