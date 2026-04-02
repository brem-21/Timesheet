export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { parseTranscript, extractiveSummarize, geminiSummarize, extractDateFromTranscript, isPersonName } from "@/lib/summarize";
import { addTasks, generateTaskId } from "@/lib/taskStoreServer";
import { saveSummary } from "@/lib/summaryStore";
import { saveMeetingMeta } from "@/lib/meetingStore";
import { format } from "date-fns";

export async function POST(request: NextRequest) {
  const { transcript, userName, meetingLabel } = await request.json();

  if (!transcript || !userName) {
    return NextResponse.json({ error: "transcript and userName are required" }, { status: 400 });
  }

  let summary;
  try {
    if (process.env.GEMINI_API_KEY) {
      summary = await geminiSummarize(transcript, userName);
    } else {
      const lines = parseTranscript(transcript);
      summary = extractiveSummarize(lines, userName);
    }
  } catch (error) {
    console.error("[/api/meetings/summarize]", error);
    try {
      const lines = parseTranscript(transcript);
      summary = extractiveSummarize(lines, userName);
    } catch {
      return NextResponse.json({ error: "Summarization failed" }, { status: 500 });
    }
  }

  // Prefer explicit label → date in transcript → today
  const transcriptDate = extractDateFromTranscript(transcript);
  const resolvedLabel = meetingLabel || transcriptDate || format(new Date(), "MMM d, yyyy");

  summary.meetingLabel = resolvedLabel;
  const savedSummaries = await saveSummary(summary);
  const savedId = savedSummaries[0]?.id ?? null;

  // Save speaker names extracted from transcript
  const parsedLines = parseTranscript(transcript);
  const speakers = Array.from(
    new Set(parsedLines.map((l) => l.speaker.trim()).filter(isPersonName))
  );
  await saveMeetingMeta({ source: resolvedLabel, speakers, date: new Date().toISOString() });

  // Auto-save action items as tasks
  const source = resolvedLabel;
  const tasks = summary.actionItems
    .filter((item) => item && item !== "No action items detected.")
    .map((item) => ({
      id: generateTaskId(),
      text: item,
      priority: "medium" as const,
      status: "todo" as const,
      source,
      assignee: userName,
      reportsTo: summary.reportsTo,
      createdAt: Date.now(),
    }));

  let savedCount = 0;
  if (tasks.length > 0) {
    await addTasks(tasks);
    savedCount = tasks.length;
  }

  return NextResponse.json({ summary, method: summary.method, tasksExtracted: savedCount, savedId });
}
