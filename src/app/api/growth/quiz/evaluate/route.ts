export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { callGemini } from "@/lib/summarize";
import type { QuizQuestion } from "@/lib/growthStore";

interface EvaluateBody {
  question: QuizQuestion;
  answer: string;
  topicLabel: string;
}

interface EvaluateResult {
  score: number;       // 0-100
  isCorrect: boolean;  // score >= 60
  feedback: string;    // 2-4 sentences
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as EvaluateBody;
  const { question, answer, topicLabel } = body;

  if (!question || !answer?.trim()) {
    return NextResponse.json({ error: "question and answer are required" }, { status: 400 });
  }

  if (!process.env.GEMINI_API_KEY) {
    // Graceful fallback: mark as attempted, neutral score
    return NextResponse.json<EvaluateResult>({
      score: 50,
      isCorrect: false,
      feedback: "AI evaluation unavailable. Configure GEMINI_API_KEY for automated scoring. Review the expected answer yourself.",
    });
  }

  const questionTypeLabel =
    question.type === "sql_write" ? "SQL query"
    : question.type === "code_write" ? `code (${question.language ?? "any language"})`
    : "written answer";

  const expectedPart = question.expectedAnswer
    ? `\n\nModel answer / key points:\n${question.expectedAnswer}`
    : "";

  const prompt = `You are a Senior Associate-level technical interviewer evaluating a ${questionTypeLabel} answer for the topic: ${topicLabel}.

Question:
${question.text}${expectedPart}

Candidate's answer:
\`\`\`
${answer.trim()}
\`\`\`

Evaluate the answer and return ONLY a JSON object (no markdown fences):
{
  "score": <integer 0-100>,
  "feedback": "<2-4 sentences: what was correct, what was missing or wrong, and one concrete improvement>"
}

Scoring rubric:
- 90-100: Correct, efficient, well-explained, production-ready
- 70-89: Mostly correct, minor gaps or inefficiencies
- 50-69: Partially correct, missing key concepts or edge cases
- 30-49: Shows some understanding but significant errors
- 0-29: Incorrect or irrelevant

Be direct and specific — reference actual code/SQL/concepts from the answer.`;

  try {
    const raw = await callGemini(prompt);
    const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed: { score: number; feedback: string } = JSON.parse(cleaned);
    const score = Math.max(0, Math.min(100, Math.round(parsed.score)));
    return NextResponse.json<EvaluateResult>({
      score,
      isCorrect: score >= 60,
      feedback: parsed.feedback,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Evaluation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
