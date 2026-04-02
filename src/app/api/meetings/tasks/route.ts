export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { parseTranscript, callGemini, extractDateFromTranscript, isPersonName } from "@/lib/summarize";
import { addTasks, generateTaskId, MeetingTask, TaskPriority } from "@/lib/taskStoreServer";
import { saveMeetingMeta } from "@/lib/meetingStore";
import { format } from "date-fns";

const ACTION_PATTERNS = [
  /\bi('ll| will| need to| should| am going to| plan to| have to)\b/i,
  /\baction item\b/i,
  /\bfollow[- ]up\b/i,
  /\btake care of\b/i,
  /\bwork on\b/i,
  /\bfinish\b/i,
  /\bcomplete\b/i,
  /\bupdate\b/i,
  /\bfix\b/i,
  /\bcreate\b/i,
  /\bsend\b/i,
  /\bcheck\b/i,
  /\bhandle\b/i,
  /\bimplement\b/i,
  /\breview\b/i,
  /\bprepare\b/i,
  /\bshare\b/i,
];

const HIGH_PRIORITY_PATTERNS = [/\burgent\b/i, /\bASAP\b/, /\bblocking\b/i, /\bcritical\b/i, /\btoday\b/i, /\bimmediately\b/i];
const LOW_PRIORITY_PATTERNS  = [/\bwhen possible\b/i, /\bno rush\b/i, /\blater\b/i, /\bsome time\b/i];

function detectPriority(text: string): TaskPriority {
  if (HIGH_PRIORITY_PATTERNS.some((p) => p.test(text))) return "high";
  if (LOW_PRIORITY_PATTERNS.some((p) => p.test(text))) return "low";
  return "medium";
}

async function extractWithGemini(transcript: string, userName: string, source: string): Promise<MeetingTask[]> {
  const prompt = `Read this meeting transcript and extract every task or action item.

Return a JSON array where each item has:
- "text": a clear, self-contained task description written as an imperative (e.g. "Update the deployment pipeline", "Send the report to the client by Friday")
- "priority": "high" if urgent/blocking/ASAP/today, "low" if no rush/later, otherwise "medium"
- "assignee": the full name of the person this task is assigned to, exactly as it appears in the transcript. Use "${userName}" for tasks assigned to them.

Return ONLY the JSON array. No markdown fences, no explanation. Example:
[{"text":"Fix the login bug before Thursday","priority":"high","assignee":"${userName}"},{"text":"Review the PR","priority":"medium","assignee":"Richard Dadzie"}]

If no tasks are found, return [].

Meeting transcript:
${transcript.slice(0, 10000)}`;

  const raw = await callGemini(prompt);
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/, "").trim();
  const parsed: Array<{ text: string; priority: TaskPriority; assignee?: string }> = JSON.parse(cleaned);

  return parsed.map((t) => ({
    id: generateTaskId(),
    text: t.text,
    priority: t.priority ?? "medium",
    status: "todo" as const,
    source,
    assignee: t.assignee ?? userName,
    createdAt: Date.now(),
  }));
}

function extractWithPatterns(transcript: string, userName: string, source: string): MeetingTask[] {
  const lines = parseTranscript(transcript);
  const firstName = userName.split(" ")[0].toLowerCase();
  const fullNameLower = userName.toLowerCase();
  const tasks: MeetingTask[] = [];

  for (const line of lines) {
    const isUserSpeaking = line.speaker.toLowerCase().includes(firstName) || line.speaker.toLowerCase().includes(fullNameLower);
    const mentionsUser = line.text.toLowerCase().includes(firstName) || line.text.toLowerCase().includes(fullNameLower);
    const hasAction = ACTION_PATTERNS.some((p) => p.test(line.text));

    if (hasAction && (isUserSpeaking || mentionsUser) && line.text.length > 10) {
      tasks.push({
        id: generateTaskId(),
        text: line.text.trim(),
        priority: detectPriority(line.text),
        status: "todo",
        source,
        assignee: isUserSpeaking ? userName : line.speaker || userName,
        createdAt: Date.now(),
      });
    }
  }
  return tasks;
}

export async function POST(request: NextRequest) {
  const { transcript, userName, meetingLabel } = await request.json();
  if (!transcript || !userName) {
    return NextResponse.json({ error: "transcript and userName are required" }, { status: 400 });
  }

  // Prefer explicit meetingLabel, then try to pull a date from the transcript itself
  const transcriptDate = extractDateFromTranscript(transcript);
  const source = meetingLabel || transcriptDate || format(new Date(), "MMM d, yyyy");

  // Extract all unique speaker names from the transcript
  const parsedLines = parseTranscript(transcript);
  const speakers = Array.from(
    new Set(parsedLines.map((l) => l.speaker.trim()).filter(isPersonName))
  );

  // Persist meeting metadata (source → speakers)
  await saveMeetingMeta({ source, speakers, date: new Date().toISOString() });

  try {
    let extracted: MeetingTask[] = [];

    if (process.env.GEMINI_API_KEY) {
      try {
        extracted = await extractWithGemini(transcript, userName, source);
      } catch {
        extracted = extractWithPatterns(transcript, userName, source);
      }
    } else {
      extracted = extractWithPatterns(transcript, userName, source);
    }

    const allTasks = await addTasks(extracted);
    return NextResponse.json({ extracted, allTasks, count: extracted.length, speakers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Task extraction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
