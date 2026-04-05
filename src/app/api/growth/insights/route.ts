export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  loadTopics, loadAttemptsByTopic, getLatestInsight, saveInsight,
  GrowthInsight, QuizAnswer
} from "@/lib/growthStore";
import { callGemini } from "@/lib/summarize";

export async function GET(request: NextRequest) {
  const topicId = request.nextUrl.searchParams.get("topicId");
  if (!topicId) return NextResponse.json({ error: "topicId is required" }, { status: 400 });

  try {
    const insight = await getLatestInsight(topicId);
    const attempts = await loadAttemptsByTopic(topicId);
    return NextResponse.json({ insight, attemptCount: attempts.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load insights";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { topicId } = await request.json();
    if (!topicId) return NextResponse.json({ error: "topicId is required" }, { status: 400 });

    const topics = await loadTopics();
    const topic = topics.find((t) => t.id === topicId);
    if (!topic) return NextResponse.json({ error: "Topic not found" }, { status: 404 });

    const attempts = await loadAttemptsByTopic(topicId);

    if (attempts.length === 0) {
      const insight = await saveInsight({
        topicId,
        generatedAt: Date.now(),
        avgScore: undefined,
        trend: "insufficient_data",
        takeaways: [],
        improvements: [`Complete at least one daily quiz for ${topic.label} to generate insights`],
        weaknesses: [],
        summaryText: `No quiz attempts yet for ${topic.label}. Take the daily quiz to start tracking your progress.`,
      });
      return NextResponse.json({ insight });
    }

    // Compute aggregate stats
    const scores = attempts.map((a) => a.score);
    const avgScore = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
    const last7 = scores.slice(0, 7);

    // Identify weakest questions (most often answered wrong)
    const questionWrongCounts: Record<string, number> = {};
    const questionTotalCounts: Record<string, number> = {};
    for (const attempt of attempts) {
      for (const ans of (attempt.answers as QuizAnswer[])) {
        questionTotalCounts[ans.questionId] = (questionTotalCounts[ans.questionId] ?? 0) + 1;
        if (!ans.isCorrect) {
          questionWrongCounts[ans.questionId] = (questionWrongCounts[ans.questionId] ?? 0) + 1;
        }
      }
    }
    const weakQuestionIds = Object.entries(questionWrongCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([id, wrong]) => `${id} (wrong ${wrong}/${questionTotalCounts[id]} times)`);

    if (!process.env.GEMINI_API_KEY) {
      // Compute a simple fallback insight without AI
      const trend: GrowthInsight["trend"] = last7.length < 3 ? "insufficient_data"
        : last7[0] > last7[last7.length - 1] ? "improving"
        : last7[0] < last7[last7.length - 1] ? "declining"
        : "stable";

      const insight = await saveInsight({
        topicId,
        generatedAt: Date.now(),
        avgScore,
        trend,
        takeaways: avgScore >= 70 ? [`Consistently scoring above 70% in ${topic.label}`] : [],
        weaknesses: avgScore < 60 ? [`Average score below 60% in ${topic.label} — needs focused study`] : [],
        improvements: [`Continue daily quizzes to build a stronger performance trend`],
        summaryText: `${attempts.length} quiz attempts recorded for ${topic.label}. Average score: ${avgScore}%.`,
      });
      return NextResponse.json({ insight });
    }

    const prompt = `You are a learning coach analyzing quiz performance for a Senior Associate.

Topic: ${topic.label}
Total attempts: ${attempts.length}
Average score: ${avgScore}%
Score trend (most recent first, last ${last7.length} attempts): ${last7.join(", ")}%
Most often wrong questions: ${weakQuestionIds.length > 0 ? weakQuestionIds.join("; ") : "insufficient data"}

Produce a JSON object (no markdown fences, no prose):
{
  "trend": "improving|declining|stable|insufficient_data",
  "takeaways": ["max 3 strings — what they already know well based on scores"],
  "weaknesses": ["max 3 strings — specific knowledge gaps inferred from low scores and wrong questions"],
  "improvements": ["max 3 strings — concrete, actionable next steps to improve"],
  "summary_text": "2-3 sentence overall candid assessment for a Senior Associate"
}`;

    const raw = await callGemini(prompt);
    const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(cleaned);

    const insight = await saveInsight({
      topicId,
      generatedAt: Date.now(),
      avgScore,
      trend: parsed.trend ?? "insufficient_data",
      takeaways: parsed.takeaways ?? [],
      improvements: parsed.improvements ?? [],
      weaknesses: parsed.weaknesses ?? [],
      summaryText: parsed.summary_text ?? "",
    });

    return NextResponse.json({ insight });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate insights";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
