export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { saveAttempt, loadAttemptsByTopic } from "@/lib/growthStore";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { quizId, topicId, dateKey, answers } = body;

    if (!quizId || !topicId || !dateKey || !Array.isArray(answers)) {
      return NextResponse.json({ error: "quizId, topicId, dateKey, and answers are required" }, { status: 400 });
    }

    const correctQ = answers.filter((a: { isCorrect: boolean }) => a.isCorrect).length;
    const totalQ = answers.length;
    const score = totalQ > 0 ? Math.round((correctQ / totalQ) * 100) : 0;

    const attempt = await saveAttempt({
      quizId,
      topicId,
      dateKey,
      answers,
      score,
      totalQ,
      correctQ,
      completedAt: Date.now(),
    });

    const history = await loadAttemptsByTopic(topicId);

    return NextResponse.json({ attempt, score, correctQ, totalQ, history });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save attempt";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
