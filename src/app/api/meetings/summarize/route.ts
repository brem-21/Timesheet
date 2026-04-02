export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { parseTranscript, extractiveSummarize, geminiSummarize, extractDateFromTranscript, isPersonName } from "@/lib/summarize";
import { addTasks, generateTaskId } from "@/lib/taskStoreServer";
import { saveSummary } from "@/lib/summaryStore";
import { saveMeetingMeta } from "@/lib/meetingStore";
import { format } from "date-fns";

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
      const tasks = summary.actionItems
        .filter((item) => item && item !== "No action items detected.")
        .map((item) => ({
          id: generateTaskId(),
          text: item,
          priority: "medium" as const,
          status: "todo" as const,
          source: resolvedLabel,
          assignee: userName,
          reportsTo: summary.reportsTo,
          createdAt: Date.now(),
        }));
      if (tasks.length > 0) {
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
