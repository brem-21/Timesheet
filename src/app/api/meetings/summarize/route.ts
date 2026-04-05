export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { parseTranscript, extractiveSummarize, geminiSummarize, callGemini, extractDateFromTranscript, isPersonName } from "@/lib/summarize";
import { addTasks, generateTaskId, MeetingTask, TaskPriority } from "@/lib/taskStoreServer";
import { saveSummary } from "@/lib/summaryStore";
import { saveMeetingMeta } from "@/lib/meetingStore";
import { format } from "date-fns";

async function enrichTasksWithGemini(
  rawItems: string[],
  userName: string,
  source: string,
  reportsTo: string | undefined,
  transcript: string
): Promise<MeetingTask[]> {
  if (!process.env.GEMINI_API_KEY) {
    return rawItems.map((item) => ({
      id: generateTaskId(),
      text: item,
      priority: "medium" as const,
      status: "todo" as const,
      source,
      assignee: userName,
      reportsTo,
      createdAt: Date.now(),
    }));
  }

  const itemsList = rawItems.map((item, i) => `${i + 1}. ${item}`).join("\n");
  const prompt = `You are a project manager creating Jira-style tickets. Given these raw action items from a meeting summary, expand each into a structured ticket.

Raw action items:
${itemsList}

Meeting context (excerpt):
${transcript.slice(0, 4000)}

Return a JSON array with exactly ${rawItems.length} items in the same order. Each item must have:
- "text": a concise ticket title (5-10 words max), written as an imperative starting with a verb
- "description": 2-4 sentences of context — what needs to be done, why it matters, and any relevant details from the meeting
- "priority": "high" if urgent/blocking/ASAP/today/deadline-driven, "low" if no rush/later/nice-to-have, otherwise "medium"
- "checklist": an array of 2-4 acceptance criteria strings — specific, testable conditions that define when this task is done

Return ONLY the JSON array. No markdown fences, no explanation.`;

  try {
    const raw = await callGemini(prompt);
    const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed: Array<{ text: string; description?: string; priority: TaskPriority; checklist?: string[] }> = JSON.parse(cleaned);

    return parsed.map((t) => ({
      id: generateTaskId(),
      text: t.text,
      description: t.description,
      priority: t.priority ?? "medium",
      status: "todo" as const,
      source,
      assignee: userName,
      reportsTo,
      checklist: (t.checklist ?? []).map((item) => ({ id: generateTaskId(), text: item, done: false })),
      createdAt: Date.now(),
    }));
  } catch {
    // Fallback to plain tasks if Gemini fails
    return rawItems.map((item) => ({
      id: generateTaskId(),
      text: item,
      priority: "medium" as const,
      status: "todo" as const,
      source,
      assignee: userName,
      reportsTo,
      createdAt: Date.now(),
    }));
  }
}

export async function POST(request: NextRequest) {
  try {
    const { transcript, userName, meetingLabel } = await request.json();

    if (!transcript || !userName) {
      return NextResponse.json({ error: "transcript and userName are required" }, { status: 400 });
    }

    // ── Summarise ──────────────────────────────────────────────────────────────
    let summary;
    try {
      if (process.env.GEMINI_API_KEY) {
        summary = await geminiSummarize(transcript, userName);
      } else {
        summary = extractiveSummarize(parseTranscript(transcript), userName);
      }
    } catch (err) {
      console.error("[/api/meetings/summarize] AI error, falling back to extractive:", err);
      try {
        summary = extractiveSummarize(parseTranscript(transcript), userName);
      } catch {
        return NextResponse.json({ error: "Summarization failed" }, { status: 500 });
      }
    }

    // ── Resolve label ──────────────────────────────────────────────────────────
    const transcriptDate = extractDateFromTranscript(transcript);
    const resolvedLabel = meetingLabel || transcriptDate || format(new Date(), "MMM d, yyyy");
    summary.meetingLabel = resolvedLabel;

    // ── Persist ────────────────────────────────────────────────────────────────
    let savedId: string | null = null;
    try {
      const savedSummaries = await saveSummary(summary);
      savedId = savedSummaries[0]?.id ?? null;
    } catch (err) {
      console.error("[/api/meetings/summarize] saveSummary error:", err);
    }

    try {
      const parsedLines = parseTranscript(transcript);
      const speakers = Array.from(
        new Set(parsedLines.map((l) => l.speaker.trim()).filter(isPersonName))
      );
      await saveMeetingMeta({ source: resolvedLabel, speakers, date: new Date().toISOString() });
    } catch (err) {
      console.error("[/api/meetings/summarize] saveMeetingMeta error:", err);
    }

    let savedCount = 0;
    try {
      const rawItems = summary.actionItems.filter((item) => item && item !== "No action items detected.");
      if (rawItems.length > 0) {
        const tasks = await enrichTasksWithGemini(rawItems, userName, resolvedLabel, summary.reportsTo, transcript);
        await addTasks(tasks);
        savedCount = tasks.length;
      }
    } catch (err) {
      console.error("[/api/meetings/summarize] addTasks error:", err);
    }

    return NextResponse.json({ summary, method: summary.method, tasksExtracted: savedCount, savedId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/meetings/summarize]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
