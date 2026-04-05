export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { loadTopics } from "@/lib/growthStore";
import { callGemini } from "@/lib/summarize";

export interface AISuggestion {
  title: string;
  url: string;
  type: "article" | "course" | "documentation" | "video" | "book";
  why: string;
}

export async function POST(request: NextRequest) {
  const { topicId } = await request.json();
  if (!topicId) return NextResponse.json({ error: "topicId is required" }, { status: 400 });

  const topics = await loadTopics();
  const topic = topics.find((t) => t.id === topicId);
  if (!topic) return NextResponse.json({ error: "Topic not found" }, { status: 404 });

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 503 });
  }

  const prompt = `You are a learning advisor for a Senior Associate at a technology consulting firm.

Topic: ${topic.label}
${topic.description ? `Context: ${topic.description}` : ""}

Suggest 6 high-quality, publicly accessible learning resources for this topic at Senior Associate level. Return ONLY a JSON array (no markdown fences, no prose):
[
  {
    "title": "Resource title",
    "url": "https://...",
    "type": "article|course|documentation|video|book",
    "why": "One sentence on why this is valuable at Senior Associate level"
  }
]

Prioritise: official documentation, well-known platforms (Coursera, A Cloud Guru, DataCamp, YouTube, O'Reilly), key papers, authoritative blog posts. Prefer free or widely accessible content. No broken or paywalled-only links.`;

  try {
    const raw = await callGemini(prompt);
    const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/, "").trim();
    const suggestions: AISuggestion[] = JSON.parse(cleaned);
    return NextResponse.json({ suggestions, topic: topic.label });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate suggestions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
